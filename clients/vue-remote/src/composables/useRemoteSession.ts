// Connects to a Neural Network Coder `/remote` server over WebSocket and exposes
// its state as Vue refs. Handles:
//   - bearer-token auth via ?token= query
//   - automatic WS upgrade (wss when the origin is https)
//   - exponential-backoff reconnect (capped at 20s)
//   - snapshot / incremental message updates
//   - permission request / response relay
//   - keepalive pings every 30s

import { ref, shallowRef, type Ref } from 'vue'
import { t } from '../i18n'
import type {
  ClientEvent,
  ConnectionState,
  ImageAttachment,
  PermissionBehavior,
  RemotePermissionRequest,
  ServerEvent,
  SessionInfo,
  SessionSummary,
  WireMessage,
} from '../types'

const PING_INTERVAL_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 20_000

export interface RemoteSession {
  connectionState: Ref<ConnectionState>
  isLoading: Ref<boolean>
  spinnerVerb: Ref<string | null>
  messages: Ref<WireMessage[]>
  pendingPermissions: Ref<RemotePermissionRequest[]>
  /**
   * requestId, для якого зараз відправлено permission_response і ми
   * чекаємо на підтвердження (permission_clear) або помилку.
   * UI може використовувати його, щоб задизейблити кнопки під час очікування.
   */
  respondingRequestId: Ref<string | null>
  error: Ref<string | null>
  sessionInfo: Ref<SessionInfo | null>
  /** The URL the user entered, even if the socket is down. */
  currentUrl: Ref<string>
  /** Live session list pushed by the daemon. */
  sessions: Ref<SessionSummary[]>
  /** The currently selected session id (empty = none). */
  selectedSessionId: Ref<string>
  /** When true, all incoming permission requests are auto-approved. */
  autoAllow: Ref<boolean>

  connect: (url: string, token: string) => void
  disconnect: () => void
  sendPrompt: (text: string, attachments?: ImageAttachment[]) => boolean
  selectSession: (sessionId: string) => void
  respondToPermission: (
    requestId: string,
    behavior: PermissionBehavior,
    message?: string,
  ) => boolean
  setAutoAllow: (value: boolean) => void
  /** Gracefully shutdown the daemon (requires authentication). */
  cancel: () => boolean
  shutdownDaemon: (reason?: string) => Promise<boolean>
  /** Close a specific worker session from the browser. */
  closeSession: (sessionId: string, reason?: string) => boolean
  /** Ask the daemon to open a new local terminal running nnc. */
  createSession: () => boolean
}

export function useRemoteSession(): RemoteSession {
  const connectionState = ref<ConnectionState>('disconnected')
  const isLoading = ref(false)
  const spinnerVerb = ref<string | null>(null)
  const messages = shallowRef<WireMessage[]>([])
  const pendingPermissions = ref<RemotePermissionRequest[]>([])
  // Стан "очікуємо відповіді сервера на permission_response": раніше діалог
  // закривався оптимістично (як тільки ws.send не кинув), і якщо сервер
  // тихо губив повідомлення — користувач цього не бачив. Тепер діалог
  // лишається відкритим до повернення permission_clear або error.
  const respondingRequestId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const sessionInfo = ref<SessionInfo | null>(null)
  const currentUrl = ref('')
  const sessions = ref<SessionSummary[]>([])
  const selectedSessionId = ref('')
  const autoAllow = ref(false)

  let ws: WebSocket | null = null
  let desiredUrl = ''
  let desiredToken = ''
  // Сесія, на яку користувач клацнув (або в якій він зараз). Окремо від
  // selectedSessionId.value щоб: (а) передати в URL при відкритті сокета
  // та (б) автоматично перепідписатись після реконекту — без цього, коли
  // WS переривався (сон, рестарт демона, мережа), клік на сесію після
  // відновлення нічого не робив на сервері, і допомагало лише перезавантаження
  // сторінки.
  let desiredSessionId = ''
  let explicitlyClosed = false
  let backoff = INITIAL_BACKOFF_MS
  let reconnectTimer: number | null = null
  let pingTimer: number | null = null

  function buildWsUrl(baseUrl: string, tokenValue: string, sessionId?: string): string {
    let url: URL
    try {
      url = new URL(baseUrl)
    } catch {
      throw new Error(t.connect.errorInvalidUrl)
    }
    const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
    let wsUrl = `${proto}//${url.host}/ws/client?token=${encodeURIComponent(tokenValue)}`
    if (sessionId) {
      wsUrl += `&sessionId=${encodeURIComponent(sessionId)}`
    }
    return wsUrl
  }

  function clearTimers() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (pingTimer !== null) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  function scheduleReconnect() {
    if (explicitlyClosed) return
    connectionState.value = 'reconnecting'
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      openSocket()
    }, backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }

  /**
   * Примусовий переконект — використовується коли сокет у "зомбі"-стані:
   * readyState == OPEN, але TCP мертвий (типовий сценарій на мобільному
   * PWA після пробудження з фону або зміни мережі). Закриваємо сокет —
   * `close` handler запустить scheduleReconnect, а ми скидаємо backoff,
   * щоб переконект спрацював миттєво, а не через секунди очікування.
   */
  function forceReconnect(reason: string) {
    if (explicitlyClosed) return
    if (!desiredUrl || !desiredToken) return
    backoff = INITIAL_BACKOFF_MS
    clearTimers()
    if (ws) {
      try { ws.close(1000, reason) } catch { /* noop */ }
      ws = null
    }
    // Відкриваємо новий сокет ВІДРАЗУ (без backoff-затримки) — користувач
    // щойно взаємодіяв / повернувся до вкладки, і чекати 1с зайве.
    openSocket()
  }

  function openSocket() {
    if (!desiredUrl || !desiredToken) return
    let wsUrl: string
    try {
      // Передаємо desiredSessionId у query-рядок — демон підпише клієнта
      // відразу у addClient(), тож snapshot прилітає без окремого
      // select_session, і race-умова "клік до completed open" зникає.
      wsUrl = buildWsUrl(desiredUrl, desiredToken, desiredSessionId || undefined)
    } catch (err) {
      error.value = (err as Error).message
      connectionState.value = 'error'
      return
    }

    connectionState.value = connectionState.value === 'reconnecting'
      ? 'reconnecting'
      : 'connecting'
    error.value = null

    let socket: WebSocket
    try {
      socket = new WebSocket(wsUrl)
    } catch (err) {
      error.value = `${t.errors.openFailed}: ${String(err)}`
      connectionState.value = 'error'
      scheduleReconnect()
      return
    }
    ws = socket

    socket.addEventListener('open', () => {
      connectionState.value = 'connected'
      backoff = INITIAL_BACKOFF_MS
      error.value = null
      // Скидаємо очікування відповіді на permission — нова з'єднання
      // означає новий цикл, старе очікування більше не актуальне.
      respondingRequestId.value = null
      pingTimer = window.setInterval(() => {
        send({ type: 'ping' })
      }, PING_INTERVAL_MS)
      // Захист від race-умов: навіть якщо desiredSessionId не потрапив у
      // query (встановили після відкриття, або query загубився проксі) —
      // явно підписуємось на open. Повторна підписка на тій же сесії
      // серверу не зашкодить (subscribeClientToSession ідемпотентний —
      // просто шле свіжий snapshot).
      if (desiredSessionId) {
        send({ type: 'select_session', sessionId: desiredSessionId })
      }
    })

    socket.addEventListener('message', ev => {
      // Ігноруємо повідомлення від сокета, який вже не актуальний
      // (forceReconnect міг відкрити новий сокет поки старий ще доганяє).
      if (ws !== socket) return
      markInbound()
      let parsed: unknown
      try {
        parsed = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return
      handleServerEvent(parsed as ServerEvent)
    })

    socket.addEventListener('close', ev => {
      // Захист від race: якщо forceReconnect вже створив новий сокет,
      // не зануляємо ws — це новий живий сокет.
      if (ws === socket) {
        ws = null
      }
      clearTimers()
      isLoading.value = false
      if (ev.code === 4001) {
        error.value = t.errors.superseded
        connectionState.value = 'error'
        explicitlyClosed = true
        return
      }
      if (ev.code === 4000) {
        error.value = t.errors.stopped
        connectionState.value = 'disconnected'
        explicitlyClosed = true
        return
      }
      if (explicitlyClosed) {
        connectionState.value = 'disconnected'
        return
      }
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      // close will follow; don't preempt state here, just note the issue.
      if (connectionState.value !== 'reconnecting') {
        error.value = t.errors.connection
      }
    })
  }

  /** Перевіряє, що подія належить поточній вибраній сесії. */
  function isEventForCurrentSession(event: ServerEvent): boolean {
    switch (event.type) {
      case 'hello':
      case 'snapshot':
      case 'messages':
      case 'permission_req':
      case 'permission_clear':
      case 'status':
      case 'error':
        return event.sessionId === selectedSessionId.value
      case 'sessions':
      case 'session_gone':
      case 'pong':
        return true
      default:
        return true
    }
  }

  function handleServerEvent(event: ServerEvent): void {
    // Відкидаємо повідомлення від іншої сесії (race при швидкому
    // перемиканні або реконнекті).
    if (!isEventForCurrentSession(event)) {
      return
    }

    switch (event.type) {
      case 'hello':
        sessionInfo.value = {
          sessionId: event.sessionId,
          cwd: event.cwd,
          serverVersion: event.serverVersion,
          metadata: event.metadata,
        }
        return
      case 'snapshot':
      case 'messages':
        messages.value = event.messages ?? []
        return
      case 'permission_req': {
        // Auto-allow: when enabled, immediately approve simple permission
        // requests. Skip auto-allow for AskUserQuestion — those require
        // actual user input (multiple-choice questions, free text, etc.).
        const isAskUserQuestion = event.request.toolName === 'AskUserQuestion'
        if (autoAllow.value && !isAskUserQuestion) {
          send({ type: 'permission_response', requestId: event.request.requestId, behavior: 'allow' })
          return
        }
        // Додаємо в кінець черги — так декілька підряд не перезапишуть
        // один одного; UI бачить завжди перший (head-of-queue).
        pendingPermissions.value = [...pendingPermissions.value, event.request]
        return
      }
      case 'permission_clear':
        pendingPermissions.value = pendingPermissions.value.filter(r => r.requestId !== event.requestId)
        // Скидаємо "очікування відповіді", якщо сервер підтвердив саме цей
        // запит — тепер UI може дозволити нові дії.
        if (respondingRequestId.value === event.requestId) {
          respondingRequestId.value = null
        }
        return
      case 'status':
        isLoading.value = event.isLoading
        spinnerVerb.value = event.isLoading ? (event.spinnerVerb ?? null) : null
        return
      case 'error':
        error.value = event.message ?? t.errors.server
        // Якщо ми чекали на відповідь по permission_response і сервер
        // повернув помилку — розблоковуємо UI, щоб користувач міг
        // спробувати ще раз (напр., після реконекту).
        if (respondingRequestId.value !== null) {
          respondingRequestId.value = null
        }
        return
      case 'sessions':
        sessions.value = event.sessions ?? []
        return
      case 'pong':
        // Daemon відповів на ping — оновлюємо lastInboundAt, щоб
        // watchdog не спрацював на зайвий forceReconnect.
        markInbound()
        return
      case 'session_gone':
        if (selectedSessionId.value === event.sessionId) {
          selectedSessionId.value = ''
          messages.value = []
          pendingPermissions.value = []
          // Якщо ми чекали підтвердження для цієї сесії — скидаємо, UI
          // повинен реагувати на зникнення сесії як на завершення.
          respondingRequestId.value = null
          sessionInfo.value = null
          isLoading.value = false
        }
        return
      default:
        return
    }
  }

  function send(event: ClientEvent): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(event))
      return true
    } catch {
      return false
    }
  }

  function connect(url: string, token: string) {
    if (!url.trim() || !token.trim()) {
      error.value = t.connect.errorRequired
      connectionState.value = 'error'
      return
    }
    // Replacing the current session — reset everything first.
    explicitlyClosed = true
    if (ws) {
      try { ws.close(1000, 'replace') } catch { /* noop */ }
      ws = null
    }
    clearTimers()

    desiredUrl = url.trim()
    desiredToken = token.trim()
    desiredSessionId = ''
    currentUrl.value = desiredUrl
    messages.value = []
    pendingPermissions.value = []
    // При повному переконекті вся сесія скидається — зокрема й очікування
    // підтвердження на permission_response (воно не переживе зміну з'єднання).
    respondingRequestId.value = null
    sessionInfo.value = null
    isLoading.value = false
    backoff = INITIAL_BACKOFF_MS
    explicitlyClosed = false

    openSocket()
  }

  function disconnect() {
    explicitlyClosed = true
    clearTimers()
    if (ws) {
      try { ws.close(1000, 'client-disconnect') } catch { /* noop */ }
      ws = null
    }
    connectionState.value = 'disconnected'
  }

  function selectSession(sessionId: string) {
    selectedSessionId.value = sessionId
    desiredSessionId = sessionId
    messages.value = []
    pendingPermissions.value = []
    // Перемикання сесії анулює попереднє очікування відповіді —
    // новий server-snapshot перерендерить актуальний діалог, якщо є.
    respondingRequestId.value = null
    // УВАГА: НЕ занулювати sessionInfo тут. App.vue має watch, який на
    // перехід sessionInfo: {…} → null повертає користувача на список
    // сесій (для випадку "сесія зникла на сервері"). Якщо чистити тут —
    // watch помилково спрацьовує на кожен клік по сесії і миттєво
    // скидає screen='chat' → 'sessions'; користувачу здається, що клік
    // не працює. Новий 'hello' від сервера перезапише sessionInfo вже
    // для правильної сесії — при цьому екран chat залишиться.
    isLoading.value = false
    if (ws && ws.readyState === WebSocket.OPEN) {
      send({ type: 'select_session', sessionId })
    } else if (!ws || ws.readyState === WebSocket.CLOSED) {
      // Сокет мертвий — піднімаємо новий негайно (після 'open' надішле
      // select_session з URL-параметра / open-handler). Раніше клік
      // "нічого не робив" саме у цьому стані: залишались чекати
      // scheduleReconnect з можливим backoff-ом.
      forceReconnect('session-click-stale-socket')
    }
    // CONNECTING — чекаємо, open-handler сам відправить select_session.
  }

  function sendPrompt(text: string, attachments?: ImageAttachment[]): boolean {
    const trimmed = text.trim()
    if (!trimmed && (!attachments || attachments.length === 0)) return false
    return send({ type: 'prompt', text: trimmed, attachments })
  }

  function respondToPermission(
    requestId: string,
    behavior: PermissionBehavior,
    message?: string,
  ): boolean {
    // Раніше тут було "оптимістичне" закриття діалогу одразу після send:
    //   if (ok) pendingPermission.value = null
    // Це маскувало випадки, коли відповідь не доходила до worker-а
    // (тихий дроп у sessionRouter або відсутній settler). Тепер діалог
    // залишається видимим до приходу permission_clear/error від сервера,
    // а ми лише фіксуємо "очікуємо підтвердження" у respondingRequestId.
    respondingRequestId.value = requestId
    const ok = send({ type: 'permission_response', requestId, behavior, message })
    if (!ok) {
      // send провалився (сокет не OPEN) — миттєво знімаємо очікування,
      // щоб кнопки знову були активні, і виставляємо явну помилку.
      respondingRequestId.value = null
      error.value = t.errors.connection
    }
    return ok
  }

  async function shutdownDaemon(reason?: string): Promise<boolean> {
    // Try to send WebSocket shutdown event first
    if (ws && ws.readyState === WebSocket.OPEN) {
      const ok = send({ type: 'shutdown', reason })
      if (ok) {
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 100))
        return true
      }
    }

    // Fallback: try HTTP API endpoint
    try {
      const url = new URL(desiredUrl)
      const shutdownUrl = `${url.protocol}//${url.host}/api/shutdown`
      const response = await fetch(shutdownUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${desiredToken}`
        }
      })

      if (response.ok) {
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500))
        return true
      }
      return false
    } catch {
      return false
    }
  }

  function closeSession(sessionId: string, reason?: string): boolean {
    return send({ type: 'close_session', sessionId, reason })
  }

  function createSession(): boolean {
    return send({ type: 'new_session' })
  }

  // ─── Відновлення зв'язку після пробудження з фону / зміни мережі ──────────
  //
  // На мобільному PWA (і в Chrome DevTools "Throttling → Offline" теж)
  // WebSocket після тривалого сну залишається у readyState=OPEN, але TCP
  // насправді мертвий: ws.send() не кидає помилку, сервер нічого не бачить,
  // "клік по сесії" ніби нічого не робить і допомагає лише reload сторінки.
  //
  // Ловимо три сигнали що варто перевірити сокет:
  //   • visibilitychange → visible  (вкладка ожила)
  //   • online                      (мережа відновилась)
  //   • focus                       (вікно отримало фокус — резерв)
  //
  // Якщо сокет не OPEN — примусовий переконект (forceReconnect). Якщо
  // OPEN — надсилаємо ping. На зомбі-сокеті ping теж тихо "успіхне",
  // але ми ставимо короткий watchdog: якщо протягом 4с сервер не відповів
  // НІЧОГО (pong або інший трафік — ми не парсимо типи, просто лічимо
  // активність на onmessage), закриваємо і перепідключаємось.
  let lastInboundAt = Date.now()
  const WATCHDOG_MS = 4000

  function markInbound() { lastInboundAt = Date.now() }

  function pokeConnection(reason: string) {
    if (explicitlyClosed) return
    if (!desiredUrl) return
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Сокет закритий/закривається → пересоздаємо одразу.
      forceReconnect(`poke:${reason}`)
      return
    }
    // OPEN, але може бути "зомбі". Шлемо ping і стартуємо watchdog —
    // якщо за WATCHDOG_MS нічого не прилетить, forceReconnect.
    const baseline = lastInboundAt
    send({ type: 'ping' })
    window.setTimeout(() => {
      if (explicitlyClosed) return
      if (lastInboundAt === baseline) {
        // Ні pong від сервера, ні інших повідомлень — сокет мертвий.
        forceReconnect(`watchdog:${reason}`)
      }
    }, WATCHDOG_MS)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pokeConnection('visibility')
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => pokeConnection('online'))
    window.addEventListener('focus', () => pokeConnection('focus'))
  }

  function setAutoAllow(value: boolean) {
    autoAllow.value = value
  }

  function cancel(): boolean {
    return send({ type: 'cancel' })
  }

  return {
    connectionState,
    isLoading,
    spinnerVerb,
    messages,
    pendingPermissions,
    respondingRequestId,
    error,
    sessionInfo,
    currentUrl,
    sessions,
    selectedSessionId,
    autoAllow,
    connect,
    disconnect,
    cancel,
    sendPrompt,
    selectSession,
    respondToPermission,
    setAutoAllow,
    shutdownDaemon,
    closeSession,
    createSession,
  }
}
