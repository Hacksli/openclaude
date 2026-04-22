/**
 * WebSocket client that connects a running Neural Network session (worker)
 * to the remote daemon.
 *
 * Translates local session events (via localRemoteEvents) into
 * WorkerToDaemonEvent messages and relays incoming DaemonToWorkerEvent
 * messages back to the session (via sessionRegistry).
 */

import { randomUUID } from 'node:crypto'
import { WebSocket } from 'ws'
import { logForDebugging } from '../utils/debug.js'
import { isEligibleBridgeMessage } from '../bridge/bridgeMessaging.js'
import * as events from './localRemoteEvents.js'
import { getPromptSubmitter, settlePermission } from './sessionRegistry.js'
import { getCachedRemoteSnapshot } from './index.js'
import { collectSessionMetadata } from './sessionMetadata.js'
import type { SessionMetadata } from './types.js'
import type { DaemonToWorkerEvent, WorkerToDaemonEvent } from './types.js'
import type { Message } from '../types/message.js'

export type WorkerConnectionOptions = {
  /** ws://host:port — base URL of the daemon. */
  daemonUrl: string
  /** Bearer token. */
  token: string
  /** Working directory of this session. */
  cwd: string
  /** Human-readable session title. */
  title: string
}

export type WorkerConnectionHandle = {
  /** Disconnect and stop retrying. */
  dispose: () => void
  /** Whether we have an active WS to the daemon. */
  isConnected: () => boolean
  /** How many sessions the daemon has (last known). */
  sessionCount: number
}

export function createWorkerConnection(
  opts: WorkerConnectionOptions,
): WorkerConnectionHandle {
  const sessionId = randomUUID()
  const startedAt = Date.now()

  let ws: WebSocket | null = null
  let disposed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = 250
  const MAX_RETRY_DELAY = 5000
  let sessionCount = 0

  const unsubscribers: Array<() => void> = []

  function send(event: WorkerToDaemonEvent): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(event)) } catch { /* noop */ }
    }
  }

  // ─── Session → Daemon relay ──────────────────────────────────────

  function filterMessages(messages: Message[]): Message[] {
    return messages.filter(m => {
      if (isEligibleBridgeMessage(m)) return true
      if (m.type === 'system') {
        const sub = (m as { subtype?: string }).subtype
        return sub === 'turn_duration'
      }
      return false
    })
  }

  function subscribeToSession(): void {
    unsubscribers.push(
      events.on('messagesChanged', (messages: Message[]) => {
        send({ type: 'messages', messages: filterMessages(messages) })
      }),
    )
    unsubscribers.push(
      events.on('loadingChanged', (isLoading: boolean, spinnerVerb?: string) => {
        send({ type: 'status', isLoading, spinnerVerb })
      }),
    )
    unsubscribers.push(
      events.on('permissionPending', request => {
        send({ type: 'permission_req', request })
      }),
    )
    unsubscribers.push(
      events.on('permissionResolved', requestId => {
        send({ type: 'permission_clear', requestId })
      }),
    )
  }

  function unsubscribeFromSession(): void {
    for (const u of unsubscribers) u()
    unsubscribers.length = 0
  }

  // ─── Daemon → Session relay ──────────────────────────────────────

  function handleDaemonEvent(event: DaemonToWorkerEvent): void {
    switch (event.type) {
      case 'hello': {
        logForDebugging('[workerConnection] registered with daemon')
        retryDelay = 250 // reset backoff on success
        // Initial snapshot push: REPL викликає publishMessages/Loading
        // одразу на mount, можливо ДО того як наш WS відкрився і
        // підписався на event-шину. Без цього sync перший браузер що
        // підключиться, отримав би порожню історію від демона (в
        // worker.messages ще нічого не було), аж поки користувач не
        // відправить нове повідомлення. Читаємо кешовані значення з
        // localRemote/index.ts та пушимо в демон.
        const snapshot = getCachedRemoteSnapshot()
        if (snapshot.messages) {
          send({ type: 'messages', messages: filterMessages(snapshot.messages) })
        }
        if (snapshot.loading) {
          send({
            type: 'status',
            isLoading: snapshot.loading.isLoading,
            spinnerVerb: snapshot.loading.spinnerVerb,
          })
        }
        break
      }

      case 'prompt': {
        const submitter = getPromptSubmitter()
        if (!submitter) {
          send({ type: 'error', message: 'No active session.' })
          return
        }
        try {
          submitter(event.text)
        } catch (err) {
          logForDebugging(`[workerConnection] prompt submission failed: ${String(err)}`)
          send({ type: 'error', message: 'Prompt rejected by session.' })
        }
        break
      }

      case 'permission_response': {
        // Зміна: раніше результат settlePermission ігнорувався — якщо
        // settler уже знятий (локальне розв'язання або cleanup React), то
        // браузер не отримував жодного сигналу. Тепер, якщо settler не
        // знайдено, надсилаємо назад у daemon явну помилку, щоб клієнт
        // міг розблокувати UI і показати причину.
        const ok = settlePermission(
          event.requestId,
          event.behavior,
          event.message,
        )
        if (!ok) {
          logForDebugging(
            `[workerConnection] permission_response without settler: requestId=${event.requestId}`,
          )
          send({
            type: 'error',
            message: `No pending permission for ${event.requestId}.`,
          })
        }
        break
      }

      case 'request_state': {
        // Демон просить свіжий snapshot — типово коли браузер щойно
        // підписався. Читаємо кеш і пушимо. Аналогічно до логіки в 'hello'.
        const snap = getCachedRemoteSnapshot()
        if (snap.messages) {
          send({ type: 'messages', messages: filterMessages(snap.messages) })
        }
        if (snap.loading) {
          send({
            type: 'status',
            isLoading: snap.loading.isLoading,
            spinnerVerb: snap.loading.spinnerVerb,
          })
        }
        break
      }

      case 'kick':
        logForDebugging(`[workerConnection] kicked: ${event.reason}`)
        if (event.code === 4000) {
          // Daemon is shutting down, gracefully disconnect
          setTimeout(() => {
            logForDebugging('[workerConnection] daemon requested shutdown, disconnecting...')
            // Stop retrying and close connection
            disposed = true
            if (retryTimer) {
              clearTimeout(retryTimer)
              retryTimer = null
            }
            const oldWs = ws
            if (oldWs) {
              try { oldWs.close(1000) } catch { /* noop */ }
              if (ws === oldWs) ws = null
            }
          }, 100)
        }
        if (event.code === 4002) {
          // Session closed from browser UI — exit the process
          setTimeout(() => {
            logForDebugging('[workerConnection] session closed from browser, exiting...')
            disposed = true
            if (retryTimer) {
              clearTimeout(retryTimer)
              retryTimer = null
            }
            const oldWs = ws
            if (oldWs) {
              try { oldWs.close(1000) } catch { /* noop */ }
              if (ws === oldWs) ws = null
            }
            process.exit(0)
          }, 100)
        }
        break
    }
  }

  // ─── Connection lifecycle ────────────────────────────────────────

  function connect(): void {
    if (disposed) return

    const wsUrl = `${opts.daemonUrl}/ws/worker?token=${encodeURIComponent(opts.token)}`
    logForDebugging(`[workerConnection] connecting to ${opts.daemonUrl}`)

    try {
      ws = new WebSocket(wsUrl)
    } catch {
      scheduleRetry()
      return
    }

    ws.on('open', () => {
      // Register this session. metadata — щоб browser міг зразу показати
      // header-картку з provider/моделлю/ціною/cwd/версією (без потреби
      // парсити TUI stdout).
      let metadata: SessionMetadata | undefined
      try {
        metadata = collectSessionMetadata()
      } catch (err) {
        logForDebugging(`[workerConnection] metadata collect failed: ${String(err)}`)
      }
      send({
        type: 'register',
        sessionId,
        cwd: opts.cwd,
        pid: process.pid,
        title: opts.title,
        startedAt,
        serverVersion: '1',
        metadata,
      })
      subscribeToSession()
    })

    ws.on('message', raw => {
      let parsed: DaemonToWorkerEvent
      try {
        parsed = JSON.parse(raw.toString('utf-8'))
      } catch { return }
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return
      handleDaemonEvent(parsed)
    })

    const thisWs = ws
    const onCloseOrError = () => {
      // Guard against race: if connect() already created a new WS,
      // don't null it when the old one finally closes.
      if (ws === thisWs) {
        ws = null
        unsubscribeFromSession()
      }
      scheduleRetry()
    }
    thisWs.on('close', onCloseOrError)
    thisWs.on('error', () => {
      // Error fires before close; close handler does cleanup.
    })
  }

  function scheduleRetry(): void {
    if (disposed) return
    const jitter = Math.random() * retryDelay * 0.3
    const delay = retryDelay + jitter
    retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY)
    logForDebugging(`[workerConnection] reconnecting in ${Math.round(delay)}ms`)
    retryTimer = setTimeout(() => {
      retryTimer = null
      tryReconnectWithAutoSpawn()
    }, delay)
  }

  async function tryReconnectWithAutoSpawn(): Promise<void> {
    if (disposed) return

    // Quick probe: is daemon reachable?
    const host = opts.daemonUrl.replace(/^ws:\/\//, '')
    try {
      const resp = await fetch(`http://${host}/healthz`, {
        signal: AbortSignal.timeout(500),
      })
      if (resp.ok) {
        connect()
        return
      }
    } catch {
      // Daemon not reachable — try auto-spawn.
    }

    try {
      const { autoSpawnDaemon } = await import('./daemon/autoSpawn.js')
      const ok = await autoSpawnDaemon()
      if (ok) {
        connect()
        return
      }
    } catch (err) {
      logForDebugging(`[workerConnection] auto-spawn failed: ${String(err)}`)
    }

    // Still failed — schedule another retry.
    scheduleRetry()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    unsubscribeFromSession()
    const oldWs = ws
    if (oldWs) {
      try {
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.send(JSON.stringify({ type: 'bye', reason: '/remote off' }))
        }
        oldWs.close(1000)
      } catch { /* noop */ }
      if (ws === oldWs) ws = null
    }
  }

  // Start initial connection.
  connect()

  return {
    dispose,
    isConnected: () => ws !== null && ws.readyState === WebSocket.OPEN,
    get sessionCount() { return sessionCount },
  }
}
