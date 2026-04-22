<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppDrawer from './components/AppDrawer.vue'
import ConnectPanel from './components/ConnectPanel.vue'
import MessageList from './components/MessageList.vue'
import PermissionBanner from './components/PermissionBanner.vue'
import PromptComposer from './components/PromptComposer.vue'
import QueuedMessages from './components/QueuedMessages.vue'
import SessionHeader from './components/SessionHeader.vue'
import StatusBar from './components/StatusBar.vue'
import { useRemoteSession } from './composables/useRemoteSession'
import { useLocalStorage } from './composables/useStorage'
import { t } from './i18n'

const LS_URL = 'openclaude.remote.url'
const LS_TOKEN = 'openclaude.remote.token'

const storedUrl = useLocalStorage(LS_URL, window.location.origin)
const storedToken = useLocalStorage(LS_TOKEN, '')
// Налаштування відображення шапки сесії: 'full' | 'compact' | 'hidden'.
// UI-керування — у ConnectPanel; тут читаємо реактивно з того ж ключа.
const headerMode = useLocalStorage('session-header-mode', 'full')

const session = useRemoteSession()
const {
  connectionState,
  isLoading,
  spinnerVerb,
  messages,
  pendingPermissions,
  respondToPermission,
  error,
  sessionInfo,
  sessions,
  selectedSessionId,
} = session

// Роутер — єдине джерело істини для поточного екрану. Стан "showConnect/
// selectedSession/screen" більше не живе у локальних ref'ах; все
// керується маршрутом. Это дає shareable URLs (один рівень для сесії)
// і коректний back/forward у браузері.
const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)

const showConnect = computed(() => route.name === 'connect')
const routeSessionId = computed(() => {
  return route.name === 'chat' ? String(route.params.sessionId ?? '') : ''
})

onMounted(() => {
  // На старті: якщо креденшли відсутні — форсуємо /connect.
  // Якщо є — тихо підключаємось. Якщо URL уже містить /chat/:id,
  // одразу просимо підписатись на цю сесію (сокет ще у CONNECTING —
  // open-handler сам відправить select_session, бо ми зберігаємо
  // desiredSessionId у composable).
  if (!storedUrl.value || !storedToken.value) {
    if (route.name !== 'connect') router.replace({ name: 'connect' })
  } else {
    session.connect(storedUrl.value, storedToken.value)
    if (routeSessionId.value) {
      session.selectSession(routeSessionId.value)
    }
  }

  window.addEventListener('orientationchange', () => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
  })
})

// Зміна :sessionId у URL (Back/Forward, прямий перехід, auto-select
// при створенні нової) — синхронізуємо WS-підписку. Початкове
// значення обробляє onMounted, тож `immediate` не ставимо.
watch(routeSessionId, (id, prev) => {
  if (id === prev) return
  if (id && id !== selectedSessionId.value) {
    session.selectSession(id)
  } else if (!id && selectedSessionId.value) {
    session.selectSession('')
  }
})

// Якщо сесія зникла з сервера (session_gone → composable чистить
// selectedSessionId), а URL досі /chat/:thatId — відправимо юзера на
// корінь. Показуваний "empty chat" з URL /chat/X виглядав би зламано.
watch(selectedSessionId, (id, old) => {
  if (!id && old && routeSessionId.value === old) {
    router.replace({ name: 'home' })
  }
})

function handleConnect(url: string, token: string) {
  storedUrl.value = url
  storedToken.value = token
  session.connect(url, token)
  // Після успішного підключення ведемо користувача на корінь — drawer
  // там сам може відкритись для вибору сесії.
  router.replace({ name: 'home' })
}

function openConnectPanel() {
  session.disconnect()
  router.push({ name: 'connect' })
}

function handleSelectSession(sessionId: string) {
  // Навігація по роуту — selectSession викличеться через watch(routeSessionId).
  router.push({ name: 'chat', params: { sessionId } })
}

function handleCloseSession(sessionId: string) {
  if (confirm('Закрити цю сесію? Консольний процес буде завершено.')) {
    const ok = session.closeSession(sessionId, 'Закрито з веб-інтерфейсу')
    if (!ok) error.value = t.errors.connection
  }
}

// Очікування появи нової сесії після натискання "Створити сесію".
// Вказує момент (epoch ms), від якого будь-яка новіша `startedAt` у
// списку — це наш щойно спавнений worker. Використовується у watch-і
// нижче, щоб авто-перемкнутись на неї. Таймаут — щоб не лишитись у
// стані очікування назавжди, якщо щось пішло не так (openclaude не
// стартував, спавн терміналу провалився).
const awaitingNewSessionSince = ref<number | null>(null)
let awaitingTimeout: number | null = null

function handleCreateSession() {
  const ok = session.createSession()
  if (!ok) {
    error.value = t.errors.connection
    return
  }
  // Позначаємо: будь-яка сесія зі `startedAt >= now - 500ms` — наша.
  // -500ms бо між send() і реєстрацією worker може зайнятись 1-2с,
  // але ми хочемо впевнено зловити саме свою, а не попередньо-додану.
  awaitingNewSessionSince.value = Date.now() - 500
  // Скасовуємо очікування через 15с якщо worker так і не з'явився.
  if (awaitingTimeout !== null) window.clearTimeout(awaitingTimeout)
  awaitingTimeout = window.setTimeout(() => {
    awaitingNewSessionSince.value = null
    awaitingTimeout = null
  }, 15_000)
}

// Коли список сесій оновлюється, шукаємо найсвіжішу сесію зі
// `startedAt >= awaitingNewSessionSince`. Якщо знаходимо — навігуємо
// на /chat/:newest.id. Drawer-у вже закрито у handleCreateSession.
watch(sessions, list => {
  const since = awaitingNewSessionSince.value
  if (!since) return
  const newest = list
    .filter(s => s.startedAt >= since)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!newest) return
  awaitingNewSessionSince.value = null
  if (awaitingTimeout !== null) {
    window.clearTimeout(awaitingTimeout)
    awaitingTimeout = null
  }
  if (routeSessionId.value === newest.id) return
  router.push({ name: 'chat', params: { sessionId: newest.id } })
})

function onPromptSubmit(text: string) {
  if (isLoading.value) {
    queue.value.push(text)
    return
  }
  const ok = session.sendPrompt(text)
  if (!ok) error.value = t.errors.notSent
}

function removeFromQueue(index: number) {
  const [removed] = queue.value.splice(index, 1)
  if (removed !== undefined) composer.value?.setText(removed)
}

function onAllow(message?: string) {
  if (pendingPermissions.value.length) {
    const req = pendingPermissions.value[0]
    respondToPermission(req.requestId, 'allow', message)
  }
}
function onDeny() {
  if (pendingPermissions.value.length) {
    const req = pendingPermissions.value[0]
    respondToPermission(req.requestId, 'deny')
  }
}

const shortCwd = computed(() => {
  const cwd = sessionInfo.value?.cwd
  if (!cwd) return null
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 2) return cwd
  return '.../' + parts.slice(-2).join('/')
})

const composerDisabled = computed(() =>
  connectionState.value !== 'connected' || !selectedSessionId.value,
)

const hasSession = computed(() => !!selectedSessionId.value && !!sessionInfo.value)

// ─── Message queue ────────────────────────────────────────────────────────

const queue = ref<string[]>([])
const composer = ref<InstanceType<typeof PromptComposer> | null>(null)

watch(isLoading, (loading, wasLoading) => {
  if (wasLoading && !loading && queue.value.length > 0) {
    const next = queue.value.shift()!
    session.sendPrompt(next)
  }
})

watch(selectedSessionId, () => {
  queue.value = []
})
</script>

<template>
  <div class="app">
    <!-- Одиничний конект-екран — показується лише без креденшлів або за
         явним запитом з drawer. -->
    <ConnectPanel
      v-if="showConnect"
      :initial-url="storedUrl"
      :initial-token="storedToken"
      :error="error"
      :busy="connectionState === 'connecting'"
      @connect="handleConnect"
    />

    <template v-else>
      <!-- Топ-бар: лише hamburger зліва + cwd по центру + крапка справа.
           Налаштування/тема переїхали у drawer. -->
      <StatusBar
        :connection-state="connectionState"
        :is-loading="isLoading"
        :session-cwd="shortCwd"
        @open-drawer="drawerOpen = true"
      />

      <!-- Головний контент: або чат (якщо є сесія), або empty-state. -->
      <main class="canvas">
        <template v-if="hasSession">
          <SessionHeader
            v-if="sessionInfo?.metadata && headerMode !== 'hidden'"
            :metadata="sessionInfo.metadata"
            :mode="headerMode === 'compact' ? 'compact' : 'full'"
          />

          <MessageList
            :messages="messages"
            :is-loading="isLoading"
            :spinner-verb="spinnerVerb"
            :banner-shown="pendingPermissions.length > 0"
          />

          <Transition name="banner">
            <PermissionBanner
              v-if="pendingPermissions.length"
              :key="pendingPermissions[0].requestId"
              :request="pendingPermissions[0]"
              @allow="(msg: string) => onAllow(msg)"
              @deny="() => onDeny()"
            />
          </Transition>

          <div v-if="error && connectionState !== 'connected'" class="error-bar">
            {{ error }}
          </div>

          <QueuedMessages
            v-if="queue.length"
            :queue="queue"
            @remove="removeFromQueue"
          />

          <PromptComposer
            ref="composer"
            :disabled="composerDisabled"
            :is-loading="isLoading"
            @submit="onPromptSubmit"
          />
        </template>

        <div v-else class="empty-state">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          <h3>Оберіть сесію</h3>
          <p>Відкрийте меню ліворуч, щоб вибрати існуючу сесію або створити нову.</p>
          <button class="empty-cta" @click="drawerOpen = true">
            Відкрити меню
          </button>
        </div>
      </main>

      <AppDrawer
        :open="drawerOpen"
        :sessions="sessions"
        :selected-id="selectedSessionId"
        @close="drawerOpen = false"
        @select="handleSelectSession"
        @close-session="handleCloseSession"
        @create="handleCreateSession"
        @open-connect="openConnectPanel"
      />
    </template>
  </div>
</template>

<style>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}

.canvas {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.error-bar {
  background: transparent;
  color: var(--danger);
  padding: 6px 12px;
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
  font-size: var(--font-size-sm);
  border-top: 1px solid var(--border);
  word-wrap: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  max-width: 100%;
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* Empty state — коли сесія не обрана. Підкреслено мінімалістичний: іконка,
   заголовок, підказка, кнопка що відкриває drawer. */
.empty-state {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
  color: var(--fg-muted);
  min-width: 0;
}
.empty-state svg {
  color: var(--fg-dim);
}
.empty-state h3 {
  margin: 0;
  color: var(--fg);
  font-size: 16px;
  font-weight: 500;
}
.empty-state p {
  margin: 0;
  max-width: 320px;
  font-size: var(--font-size-sm);
  line-height: 1.5;
}
.empty-cta {
  margin-top: 8px;
  padding: 10px 18px;
  background: var(--fg);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-weight: 500;
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: opacity 0.15s;
}
.empty-cta:hover { opacity: 0.88; }
</style>
