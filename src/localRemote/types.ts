/**
 * Wire protocol for the local-remote bridge.
 *
 * Server → client events:
 *   - `hello`          : sent once after auth; server state snapshot
 *   - `snapshot`       : full message history (sent on connect or /remote on)
 *   - `messages`       : replacement of the full message list (cheap for MVP)
 *   - `permission_req` : tool permission prompt the TUI is waiting on
 *   - `permission_clear`: the prompt was resolved (by TUI, client, or cancel)
 *   - `status`         : session status (loading, idle)
 *   - `error`          : server-side error notification
 *
 * Client → server events:
 *   - `prompt`              : submit a user prompt
 *   - `permission_response` : respond to a pending permission request
 *   - `ping`                : keepalive
 */

import type { Message } from '../types/message.js'

export type PermissionBehavior = 'allow' | 'deny'

/** Image attachment sent from browser client */
export type ImageAttachment = {
  type: 'image'
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string // base64
  filename?: string
}

export type RemotePermissionRequest = {
  requestId: string
  toolName: string
  /** Best-effort text description of what the tool will do. */
  description?: string
  /** Serialised tool input (JSON-able). */
  input?: unknown
  /** When the request appeared (ms since epoch). */
  createdAt: number
}

/** Детальні метадані сесії для браузера (header-card у web UI) */
export type SessionMetadata = {
  version: string
  providerName: string
  model: string
  baseUrl: string
  isLocal: boolean
  priceLine?: string
  cwd: string
}

// ─── Server → Browser (client) events ────────────────────────────────
export type ServerEvent =
  | {
      type: 'hello'
      sessionId: string
      cwd: string
      serverVersion: string
      metadata?: SessionMetadata
    }
  | {
      type: 'snapshot'
      sessionId: string
      messages: Message[]
    }
  | {
      type: 'messages'
      sessionId: string
      messages: Message[]
    }
  | {
      type: 'permission_req'
      sessionId: string
      request: RemotePermissionRequest
    }
  | {
      type: 'permission_clear'
      sessionId: string
      requestId: string
    }
  | {
      type: 'status'
      sessionId: string
      isLoading: boolean
      spinnerVerb?: string
    }
  | {
      type: 'error'
      sessionId: string
      message: string
    }
  | {
      type: 'pong'
    }
  | {
      type: 'sessions'
      sessions: SessionSummary[]
    }
  | {
      type: 'session_gone'
      sessionId: string
    }

// ─── Browser (client) → Server events ────────────────────────────────
export type ClientEvent =
  | {
      type: 'prompt'
      text: string
      /** Optional image attachments (e.g. pasted screenshot from browser). */
      attachments?: ImageAttachment[]
    }
  | {
      type: 'permission_response'
      requestId: string
      behavior: PermissionBehavior
      /** Optional message surfaced alongside a denial. */
      message?: string
    }
  | {
      type: 'ping'
    }
  | {
      type: 'select_session'
      sessionId: string
    }
  | {
      type: 'shutdown'
      reason?: string
    }
  | {
      type: 'close_session'
      sessionId: string
      reason?: string
    }
  | {
      type: 'new_session'
    }

// ─── Worker → Daemon events ──────────────────────────────────────────
export type WorkerToDaemonEvent =
  | {
      type: 'register'
      sessionId: string
      cwd: string
      pid: number
      title: string
      startedAt: number
      serverVersion: string
      /** Структуровані метадані сесії (provider/model/price/version тощо) */
      metadata?: SessionMetadata
    }
  | {
      type: 'messages'
      messages: Message[]
    }
  | {
      type: 'status'
      isLoading: boolean
      spinnerVerb?: string
    }
  | {
      type: 'permission_req'
      request: RemotePermissionRequest
    }
  | {
      type: 'permission_clear'
      requestId: string
    }
  | {
      type: 'error'
      message: string
    }
  | {
      type: 'bye'
      reason?: string
    }

// ─── Daemon → Worker events ──────────────────────────────────────────
export type DaemonToWorkerEvent =
  | {
      type: 'hello'
      ok: true
    }
  | {
      type: 'prompt'
      text: string
      attachments?: ImageAttachment[]
    }
  | {
      type: 'permission_response'
      requestId: string
      behavior: PermissionBehavior
      message?: string
    }
  | {
      type: 'kick'
      code: number
      reason: string
    }
  | {
      type: 'shutdown'
      reason?: string
    }
  | {
      /**
       * Demand that the worker re-push its current state (messages +
       * loading) so a newly-subscribed browser gets fresh data. Safety
       * net for the "empty history until first message" race: primary
       * mechanism is worker pushing on 'hello', but if that didn't fire
       * (or the worker reconnected with no activity since) the daemon
       * uses this to kick the refresh. Unknown event in older workers
       * — harmlessly ignored.
       */
      type: 'request_state'
    }
  | {
      type: 'pong'
    }

// ─── Session summary (for /api/sessions + sessions WS event) ────────
export type SessionSummary = {
  id: string
  cwd: string
  pid: number
  title: string
  startedAt: number
  isLoading: boolean
  hasPendingPermission: boolean
  /** Коротка інфо про модель/провайдера — щоб UI не мусив чекати
      на hello з іншої сесії, щоб показати, яка нейронка в сесії. */
  providerName?: string
  model?: string
  isLocal?: boolean
}

/** Result of the `/remote on` command. */
export type StartResult = {
  url: string
  lanUrl?: string
  token: string
  port: number
  host: string
}

/** Runtime status returned by `/remote status`. */
export type ServerStatus =
  | { running: false }
  | {
      running: true
      url: string
      lanUrl?: string
      port: number
      host: string
      tokenPreview: string
      connectedToDaemon: boolean
      sessionCount?: number
    }
