<script setup lang="ts">
import { ref, watch } from 'vue'
import SessionPicker from './SessionPicker.vue'
import { useTheme } from '../composables/useTheme'
import type { SessionSummary } from '../types'

const props = defineProps<{
  open: boolean
  sessions: SessionSummary[]
  selectedId: string
}>()

const emit = defineEmits<{
  close: []
  select: [sessionId: string]
  closeSession: [sessionId: string]
  create: []
  openConnect: []
}>()

const { theme, toggle: toggleTheme } = useTheme()

// Short lockout після тапу на "створити" — новий worker реєструється
// за 1-2 секунди, і ми не хочемо дозволити повторні кліки.
const creating = ref(false)

// Esc → close drawer. Підписуємось лише коли drawer відкритий, щоб не
// конкурувати з іншими хоткеями.
watch(() => props.open, open => {
  if (!open) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') emit('close')
  }
  window.addEventListener('keydown', onKey)
  const stopper = watch(() => props.open, opened => {
    if (!opened) {
      window.removeEventListener('keydown', onKey)
      stopper()
    }
  })
})

function onSelect(id: string) {
  emit('select', id)
  emit('close')
}

function onCreate() {
  if (creating.value) return
  creating.value = true
  emit('create')
  emit('close')
  setTimeout(() => { creating.value = false }, 2000)
}

function onOpenConnect() {
  emit('openConnect')
  emit('close')
}
</script>

<template>
  <!-- Scrim: напівпрозорий фон поверх чату, клік по ньому закриває drawer -->
  <Transition name="scrim">
    <div
      v-if="open"
      class="scrim"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <!-- Панель: висувається зліва -->
  <Transition name="drawer">
    <aside
      v-if="open"
      class="drawer"
      role="dialog"
      aria-label="Меню"
    >
      <SessionPicker
        :sessions="sessions"
        :selected-id="selectedId"
        :can-close-sessions="true"
        :compact="true"
        @select="onSelect"
        @close="(id) => emit('closeSession', id)"
        @back="emit('close')"
      />

      <footer class="footer">
        <!-- Вторинні перемикачі (тема, конекшн) — приглушені, компактні -->
        <div class="secondary-actions">
          <button class="footer-btn" @click="toggleTheme">
            <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>{{ theme === 'dark' ? 'Світла тема' : 'Темна тема' }}</span>
          </button>
          <button class="footer-btn" @click="onOpenConnect">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Налаштування</span>
          </button>
        </div>

        <!-- Primary CTA: створити нову сесію. Повна ширина — головна дія
             шухляди. -->
        <button
          class="create-session-cta"
          :disabled="creating"
          @click="onCreate"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Створити нову сесію</span>
        </button>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
  backdrop-filter: blur(2px);
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(340px, 85vw);
  background: var(--bg);
  border-right: 1px solid var(--border);
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
}

/* Transitions: slide + fade — швидкі (180ms), щоб не дратувати при частих
   відкриттях. */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.18s ease-out;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 0.18s ease-out;
}
.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}

.footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.secondary-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: var(--fg-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
  min-height: 40px;
}
.footer-btn:hover {
  background: var(--bg-elev);
  color: var(--fg);
}
.footer-btn svg {
  flex-shrink: 0;
}

/* Primary CTA: створити нову сесію. Повноширинна, з fg-фоном для
   максимального контрасту — головна дія drawer-а. */
.create-session-cta {
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--fg);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-weight: 500;
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.create-session-cta:hover:not(:disabled) { opacity: 0.88; }
.create-session-cta:active:not(:disabled) { transform: scale(0.985); }
.create-session-cta:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
