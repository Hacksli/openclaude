<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SessionSummary } from '../types'

const props = defineProps<{
  sessions: SessionSummary[]
  selectedId: string
  canCloseSessions?: boolean
  /** drawer-режим: без "← налашт." кнопки, дрібніший padding */
  compact?: boolean
}>()

const emit = defineEmits<{
  select: [sessionId: string]
  close: [sessionId: string]
  back: []
}>()

const closingId = ref<string | null>(null)

function shortCwd(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 2) return cwd
  return '.../' + parts.slice(-2).join('/')
}

function timeAgo(startedAt: number): string {
  const diff = Date.now() - startedAt
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'щойно'
  if (mins < 60) return `${mins}хв тому`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}г тому`
  return `${Math.floor(hours / 24)}д тому`
}

const PAGE_SIZE = 10
const page = ref(1)

const sortedSessions = computed(() =>
  [...props.sessions].sort((a, b) => b.startedAt - a.startedAt)
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedSessions.value.length / PAGE_SIZE))
)

const paginatedSessions = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return sortedSessions.value.slice(start, start + PAGE_SIZE)
})

function onClose(sessionId: string) {
  if (closingId.value === sessionId) return
  closingId.value = sessionId
  emit('close', sessionId)
  // Reset the closing state after a short delay
  setTimeout(() => {
    closingId.value = null
  }, 2000)
}
</script>

<template>
  <section class="session-picker">
    <div class="header">
      <h2>Сесії <span class="count">{{ sessions.length }}</span></h2>
      <button
        class="close-drawer-btn"
        @click="emit('back')"
        title="Закрити меню"
        aria-label="Закрити меню"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="sessions.length === 0" class="empty">
      Немає активних сесій. Запусти сесію і набери /remote on.
    </div>

    <ul v-else class="list">
      <li
        v-for="s in paginatedSessions"
        :key="s.id"
        :class="{ active: s.id === selectedId, closing: closingId === s.id }"
        @click="emit('select', s.id)"
      >
        <div class="row-main">
          <span class="cwd">{{ shortCwd(s.cwd) }}</span>
          <span class="time">{{ timeAgo(s.startedAt) }}</span>
        </div>
        <div class="row-meta">
          <!-- Замість PID показуємо модель (+ dot-індикатор cloud/local).
               Fallback — PID, якщо worker ще не встиг прислати metadata
               (стара версія nnc без snapshot-push). -->
          <span v-if="s.model" class="model-chip" :class="{ local: s.isLocal }">
            <span class="model-dot" aria-hidden="true"></span>
            <span class="model-name">{{ s.model }}</span>
          </span>
          <span v-else class="pid">PID {{ s.pid }}</span>
          <span v-if="s.isLoading" class="badge thinking">думає</span>
          <span v-if="s.hasPendingPermission" class="badge perm">дозвіл</span>
        </div>
        <button
          v-if="canCloseSessions"
          class="close-btn"
          :class="{ busy: closingId === s.id }"
          :aria-label="`Закрити сесію ${shortCwd(s.cwd)}`"
          @click.stop="onClose(s.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>

    <nav v-if="totalPages > 1" class="pagination" aria-label="Пагінація сесій">
      <button
        type="button"
        class="page-btn"
        :disabled="page <= 1"
        @click="page--"
        aria-label="Попередня сторінка"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="page-btn"
        :disabled="page >= totalPages"
        @click="page++"
        aria-label="Наступна сторінка"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  </section>
</template>

<style scoped>
.session-picker {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* Нема горизонтального padding — li займають повну ширину до країв drawer-а */
  padding: 0;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  min-width: 0;
}

.header h2 {
  margin: 0;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header .count {
  color: var(--fg-dim);
  font-weight: 400;
  margin-left: 6px;
}

.back {
  background: transparent;
  border: none;
  color: var(--accent);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 6px 0;
  min-height: 32px;
  flex-shrink: 0;
}
.back:hover { text-decoration: underline; }

.close-drawer-btn {
  margin-left: auto;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}
.close-drawer-btn:hover {
  color: var(--fg);
  background: var(--bg-elev);
}
.close-drawer-btn:active { transform: scale(0.94); }

.empty {
  color: var(--fg-muted);
  font-size: var(--font-size-sm);
  padding: 32px 16px;
  text-align: center;
  line-height: 1.55;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.list li {
  /* Повна ширина, без рамок і радіусів — тільки тонкий роздільник знизу.
     Active-стан підкреслюємо лівою акцент-смужкою (3px), не рамкою.
     Правий padding 44px — щоб текст/бейджі не налазили на absolute
     close-кнопку у верхньому куті. */
  position: relative;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  padding: 14px 44px 14px 16px;
  margin: 0;
  cursor: pointer;
  transition: background 0.15s;
  background: transparent;
  min-width: 0;
}
.list li:hover {
  background: var(--bg-elev);
}
.list li.active {
  background: var(--bg-elev);
}
.list li.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
}

.row-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.cwd {
  /* flex:1 + min-width:0 is what lets text-overflow:ellipsis actually work
     inside a flex row — without it, the item refuses to shrink below its
     intrinsic content width and pushes siblings off-screen. */
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: var(--font-size-sm);
  color: var(--fg-muted);
  flex-shrink: 0;
  margin-left: 4px;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  min-width: 0;
}

.pid {
  font-size: var(--font-size-sm);
  color: var(--fg-dim);
}

/* Model chip: компактний індикатор нейронки сесії. Крапка тим же кольором
   що accent (хмара) або success (локально), далі моно-назва моделі. */
.model-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--fg-muted);
  font-family: var(--font-mono);
}
.model-chip .model-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.model-chip.local .model-dot {
  background: var(--success);
}
.model-chip .model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
  letter-spacing: 0.2px;
}
.badge.thinking {
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  background: rgba(var(--accent-rgb), 0.06);
}
.badge.perm {
  color: var(--warning, #f5a623);
  border: 1px solid rgba(245, 166, 35, 0.4);
  background: rgba(245, 166, 35, 0.06);
}

/* Close button — absolute у верхньому правому куті картки. На desktop
   прихована до hover; на touch (без hover) — бачимо завжди, але
   приглушено. Іконка — тонкий stroke-only X, без жодних рамок. */
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--fg-dim);
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s, transform 0.1s;
}
.list li:hover .close-btn {
  opacity: 1;
}
.close-btn:hover {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.12);
}
.close-btn:active { transform: scale(0.9); }
.close-btn.busy {
  opacity: 0.35 !important;
  pointer-events: none;
}
/* Touch-first: на пристроях без hover завжди показуємо кнопку. */
@media (hover: none) {
  .close-btn { opacity: 0.5; }
  .list li.active .close-btn { opacity: 0.8; }
}

.list li.closing {
  opacity: 0.5;
  border-color: var(--danger);
}

/* ─── Pagination ────────────────────────────────────────────────────────── */

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.page-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.page-btn:hover:not(:disabled) {
  background: var(--bg-elev);
  color: var(--fg);
}
.page-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  min-width: 42px;
  text-align: center;
}
</style>
