<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../i18n'
import type { ConnectionState } from '../types'

const props = defineProps<{
  connectionState: ConnectionState
  isLoading: boolean
  sessionCwd?: string | null
}>()

const emit = defineEmits<{
  openDrawer: []
}>()

// Визначаємо лише статус крапки. Текстовий лейбл показуємо ТІЛЬКИ коли
// щось не ОК — у нормі хочемо максимально порожній верх.
const dotClass = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return props.isLoading ? 'dot pulsing' : 'dot on'
    case 'connecting':
    case 'reconnecting':
      return 'dot pulsing'
    case 'error':
      return 'dot err'
    default:
      return 'dot off'
  }
})

const statusLabel = computed(() => {
  if (props.connectionState === 'connected') {
    return props.isLoading ? t.status.thinking : null
  }
  if (props.connectionState === 'connecting') return t.status.connecting
  if (props.connectionState === 'reconnecting') return t.status.reconnecting
  if (props.connectionState === 'error') return t.status.error
  return t.status.disconnected
})
</script>

<template>
  <header class="statusbar">
    <button class="menu-btn" aria-label="Меню" @click="emit('openDrawer')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    </button>

    <div class="center">
      <span v-if="sessionCwd" class="cwd">{{ sessionCwd }}</span>
      <span v-if="statusLabel" class="status-label">{{ statusLabel }}</span>
    </div>

    <span :class="dotClass" :title="statusLabel ?? t.status.connected"></span>
  </header>
</template>

<style scoped>
.statusbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  padding-top: max(6px, env(safe-area-inset-top));
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
  background: var(--bg);
  min-height: 44px;
  font-size: var(--font-size-sm);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.menu-btn {
  background: transparent;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}
.menu-btn:hover {
  color: var(--fg);
  background: var(--bg-elev);
}
.menu-btn:active { transform: scale(0.94); }

.center {
  flex: 1 1 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  color: var(--fg-muted);
}

.cwd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
  font-weight: 500;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.status-label {
  color: var(--fg-muted);
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--fg-dim);
  transition: background-color 0.25s;
}
.dot.on { background: var(--success); }
.dot.off { background: var(--fg-dim); }
.dot.err { background: var(--danger); }
.dot.pulsing {
  background: var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
