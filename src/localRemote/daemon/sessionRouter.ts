/**
 * In-memory session registry inside the daemon process.
 *
 * Tracks all connected worker sessions and their state, routes messages
 * between workers and browser clients, and broadcasts session list changes.
 */

import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import type {
  ClientEvent,
  DaemonToWorkerEvent,
  RemotePermissionRequest,
  ServerEvent,
  SessionMetadata,
  SessionSummary,
  WorkerToDaemonEvent,
} from '../types.js'
import { spawnSessionTerminal } from './spawnSessionTerminal.js'

type Send<T> = (event: T) => void

export type WorkerEntry = {
  sessionId: string
  cwd: string
  pid: number
  title: string
  startedAt: number
  serverVersion: string
  metadata?: SessionMetadata
  messages: Message[]
  isLoading: boolean
  spinnerVerb?: string
  pendingPermissions: Map<string, RemotePermissionRequest>
  send: Send<DaemonToWorkerEvent>
}

export type ClientEntry = {
  /** The sessionId this client is subscribed to (empty = lobby only). */
  subscribedSession: string
  send: Send<ServerEvent>
}

export class SessionRouter {
  readonly workers = new Map<string, WorkerEntry>()
  readonly clients = new Set<ClientEntry>()

  // ─── Worker lifecycle ────────────────────────────────────────────

  registerWorker(
    event: Extract<WorkerToDaemonEvent, { type: 'register' }>,
    send: Send<DaemonToWorkerEvent>,
  ): WorkerEntry {
    // If a worker with same sessionId is already registered, kick it.
    const existing = this.workers.get(event.sessionId)
    if (existing) {
      existing.send({ type: 'kick', code: 4001, reason: 'duplicate sessionId' })
    }

    const entry: WorkerEntry = {
      sessionId: event.sessionId,
      cwd: event.cwd,
      pid: event.pid,
      title: event.title,
      startedAt: event.startedAt,
      serverVersion: event.serverVersion,
      metadata: event.metadata,
      messages: [],
      isLoading: false,
      pendingPermissions: new Map(),
      send,
    }
    this.workers.set(event.sessionId, entry)
    send({ type: 'hello', ok: true })
    this.broadcastSessionList()
    return entry
  }

  unregisterWorker(entry: WorkerEntry): void {
    // Guard against race: if a worker reconnects with the same sessionId,
    // the old WS closing must not delete the new entry.
    const current = this.workers.get(entry.sessionId)
    if (current !== entry) {
      logForDebugging(
        `[sessionRouter] unregisterWorker skipped: stale entry for sessionId=${entry.sessionId}`,
      )
      return
    }
    this.workers.delete(entry.sessionId)

    // Notify clients subscribed to this session.
    for (const client of this.clients) {
      if (client.subscribedSession === entry.sessionId) {
        client.send({ type: 'session_gone', sessionId: entry.sessionId })
        client.subscribedSession = ''
      }
    }
    this.broadcastSessionList()
  }

  // ─── Worker events → state + relay to clients ────────────────────

  handleWorkerEvent(sessionId: string, event: WorkerToDaemonEvent): void {
    const worker = this.workers.get(sessionId)
    if (!worker) return

    switch (event.type) {
      case 'messages':
        worker.messages = event.messages
        this.relayToSubscribers(sessionId, { type: 'messages', sessionId, messages: event.messages })
        break

      case 'status':
        worker.isLoading = event.isLoading
        worker.spinnerVerb = event.isLoading ? event.spinnerVerb : undefined
        this.relayToSubscribers(sessionId, { type: 'status', sessionId, isLoading: event.isLoading, spinnerVerb: worker.spinnerVerb })
        this.broadcastSessionList()
        break

      case 'permission_req':
        worker.pendingPermissions.set(event.request.requestId, event.request)
        this.relayToSubscribers(sessionId, { type: 'permission_req', sessionId, request: event.request })
        this.broadcastSessionList()
        break

      case 'permission_clear':
        worker.pendingPermissions.delete(event.requestId)
        this.relayToSubscribers(sessionId, { type: 'permission_clear', sessionId, requestId: event.requestId })
        this.broadcastSessionList()
        break

      case 'error':
        this.relayToSubscribers(sessionId, { type: 'error', sessionId, message: event.message })
        break

      case 'bye':
        {
          const worker = this.workers.get(sessionId)
          if (worker) this.unregisterWorker(worker)
        }
        break

      // 'register' is handled separately.
    }
  }

  // ─── Client lifecycle ────────────────────────────────────────────

  addClient(send: Send<ServerEvent>, initialSession: string): ClientEntry {
    const entry: ClientEntry = { subscribedSession: '', send }
    this.clients.add(entry)

    // Always send session list first.
    send({ type: 'sessions', sessions: this.getSessionList() })

    if (initialSession) {
      this.subscribeClientToSession(entry, initialSession)
    }
    return entry
  }

  removeClient(client: ClientEntry): void {
    this.clients.delete(client)
  }

  handleClientEvent(client: ClientEntry, event: ClientEvent): void {
    switch (event.type) {
      case 'select_session':
        this.subscribeClientToSession(client, event.sessionId)
        break

      case 'prompt': {
        const worker = this.workers.get(client.subscribedSession)
        if (!worker) {
          client.send({ type: 'error', sessionId: client.subscribedSession, message: 'Session not found or disconnected.' })
          return
        }
        logForDebugging(`[sessionRouter] forward prompt to worker, text="${event.text.slice(0, 40)}", attachments=${event.attachments?.length ?? 0}`)
        worker.send({ type: 'prompt', text: event.text, attachments: event.attachments })
        break
      }

      case 'permission_response': {
        logForDebugging(
          `[sessionRouter] permission_response from client: requestId=${event.requestId}, behavior=${event.behavior}, subscribedSession=${client.subscribedSession}`,
        )
        // Зміна: раніше при відсутності прив'язки клієнта до сесії відповідь
        // на запит дозволу тихо відкидалась — і в терміналі нічого не
        // відбувалось, хоча браузер показував "успіх". Тепер:
        //   1) якщо прив'язки нема — пробуємо self-healing: знайти worker,
        //      у якого цей requestId ще висить у pendingPermissions;
        //   2) якщо worker не знайдено/неоднозначно — повертаємо клієнту
        //      явну помилку, щоб UI міг розблокувати кнопки;
        //   3) якщо worker знайдено, але requestId уже не в pending —
        //      це нормальний race (локальний TUI/hook розв'язав першим),
        //      тихо ігноруємо без error для клієнта.
        let worker = this.workers.get(client.subscribedSession)
        if (!worker) {
          // Пошук за requestId серед усіх worker-ів. Ідентифікатори
          // pending-запитів унікальні (toolUseID з Anthropic SDK), тож
          // колізія між сесіями малоімовірна.
          const candidates: WorkerEntry[] = []
          for (const w of this.workers.values()) {
            if (w.pendingPermissions.has(event.requestId)) candidates.push(w)
          }
          if (candidates.length === 1) {
            worker = candidates[0]
            // Перепідв'язуємо клієнта, щоб наступні події (prompt/
            // permission_clear) йшли правильно.
            client.subscribedSession = worker.sessionId
            logForDebugging(
              `[sessionRouter] permission_response self-healed: requestId=${event.requestId} → session=${worker.sessionId}`,
            )
          } else {
            logForDebugging(
              `[sessionRouter] permission_response dropped: no bound session and ${candidates.length} matching workers for requestId=${event.requestId}`,
            )
            client.send({
              type: 'error',
              sessionId: '',
              message: `No active session for permission ${event.requestId}. Reconnect or select a session.`,
            })
            return
          }
        }

        if (!worker.pendingPermissions.has(event.requestId)) {
          // Локальний бік уже розв'язав запит — мовчазний no-op для
          // worker-а, але потрібно повідомити клієнта що діалог закрито
          // (permission_clear), інакше UI зависає.
          logForDebugging(
            `[sessionRouter] permission_response ignored: requestId=${event.requestId} no longer pending on worker=${worker.sessionId}`,
          )
          worker.pendingPermissions.delete(event.requestId)
          client.send({ type: 'permission_clear', sessionId: worker.sessionId, requestId: event.requestId })
          this.broadcastSessionList()
          return
        }

        worker.send({
          type: 'permission_response',
          requestId: event.requestId,
          behavior: event.behavior,
          message: event.message,
        })
        break
      }

      case 'ping':
        client.send({ type: 'pong' })
        break

      case 'close_session': {
        const worker = this.workers.get(event.sessionId)
        if (!worker) {
          client.send({ type: 'error', sessionId: event.sessionId, message: `Session "${event.sessionId}" not found.` })
          return
        }
        logForDebugging(`[sessionRouter] close_session request from client for session ${event.sessionId}, reason: ${event.reason || 'none'}`)
        worker.send({ type: 'kick', code: 4002, reason: event.reason || 'closed from browser' })
        break
      }

      case 'cancel': {
        const worker = this.workers.get(client.subscribedSession)
        if (worker) {
          logForDebugging(`[sessionRouter] cancel request for session ${client.subscribedSession}`)
          worker.send({ type: 'cancel' })
        }
        break
      }

      case 'new_session': {
        // Open a fresh local terminal running `nnc`. The new worker
        // will connect back to this daemon and appear in the session list
        // via broadcastSessionList — no explicit ack beyond `error` on fail.
        logForDebugging('[sessionRouter] new_session request from client')
        const result = spawnSessionTerminal()
        if (!result.ok) {
          client.send({
            type: 'error',
            sessionId: '',
            message: `Не вдалося відкрити нову консоль: ${result.error}`,
          })
        }
        break
      }

      case 'shutdown':
        // Handle shutdown request - send notification to all workers
        logForDebugging(`[sessionRouter] shutdown request received from client, reason: ${event.reason || 'none'}`)
        // Notify all workers that daemon is shutting down
        for (const worker of this.workers.values()) {
          try {
            worker.send({ type: 'kick', code: 4000, reason: 'daemon shutdown requested' })
          } catch {
            // ignore
          }
        }
        // Send acknowledgment to client
        client.send({ type: 'error', sessionId: '', message: 'Daemon shutting down...' })
        // Schedule daemon shutdown after a short delay
        setTimeout(() => {
          logForDebugging('[sessionRouter] initiating daemon shutdown')
          process.emit('SIGTERM', 'SIGTERM')
        }, 500)
        break
    }
  }

  // ─── Internal ────────────────────────────────────────────────────

  private subscribeClientToSession(client: ClientEntry, sessionId: string): void {
    client.subscribedSession = sessionId
    const worker = this.workers.get(sessionId)
    if (!worker) {
      client.send({ type: 'error', sessionId, message: `Session "${sessionId}" not found.` })
      return
    }

    // Send snapshot for the selected session. Якщо worker.messages уже
    // заповнений (типовий випадок — worker push'нув на 'hello') — браузер
    // одразу побачить історію. Якщо ні — просимо worker-а переслати стан;
    // він прилетить через 'messages' event і relayToSubscribers передасть
    // уже підписаному клієнту. Це saft-net для ситуацій, коли worker
    // зареєстрував, але snapshot-push чомусь не спрацював (reconnect,
    // старша версія, race).
    client.send({
      type: 'hello',
      sessionId: worker.sessionId,
      cwd: worker.cwd,
      serverVersion: worker.serverVersion,
      metadata: worker.metadata,
    })
    client.send({ type: 'snapshot', sessionId: worker.sessionId, messages: worker.messages })
    client.send({ type: 'status', sessionId: worker.sessionId, isLoading: worker.isLoading, spinnerVerb: worker.spinnerVerb })
    for (const req of worker.pendingPermissions.values()) {
      client.send({ type: 'permission_req', sessionId: worker.sessionId, request: req })
    }
    // Завжди просимо свіжий стан — у worker'а може бути новіший.
    try { worker.send({ type: 'request_state' }) } catch { /* noop */ }
  }

  private relayToSubscribers(sessionId: string, event: ServerEvent): void {
    for (const client of this.clients) {
      if (client.subscribedSession === sessionId) {
        client.send(event)
      }
    }
  }

  getSessionList(): SessionSummary[] {
    const list: SessionSummary[] = []
    for (const w of this.workers.values()) {
      list.push({
        id: w.sessionId,
        cwd: w.cwd,
        pid: w.pid,
        title: w.title,
        startedAt: w.startedAt,
        isLoading: w.isLoading,
        hasPendingPermission: w.pendingPermissions.size > 0,
        providerName: w.metadata?.providerName,
        model: w.metadata?.model,
        isLocal: w.metadata?.isLocal,
      })
    }
    return list
  }

  private broadcastSessionList(): void {
    const sessions = this.getSessionList()
    const event: ServerEvent = { type: 'sessions', sessions }
    for (const client of this.clients) {
      client.send(event)
    }
  }
}
