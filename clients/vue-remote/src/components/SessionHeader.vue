<script setup lang="ts">
import { computed } from 'vue'
import type { SessionMetadata } from '../types'

const props = defineProps<{
  metadata: SessionMetadata
  /** full — повна картка; compact — однорядковий чіп лише з моделлю */
  mode?: 'full' | 'compact'
}>()

const shortCwd = computed(() => {
  const cwd = props.metadata.cwd
  return cwd.length > 60 ? '…' + cwd.slice(-59) : cwd
})
</script>

<template>
  <!-- Compact: одна тонка смужка з чіпом provider + назва моделі. -->
  <section v-if="mode === 'compact'" class="session-header-compact">
    <span class="provider-chip" :class="{ local: metadata.isLocal }">
      <span class="provider-dot" aria-hidden="true"></span>
      <span class="provider-name">{{ metadata.providerName }}</span>
    </span>
    <span class="compact-model">{{ metadata.model }}</span>
  </section>

  <!-- Full: картка з провайдером, моделлю та метаданими -->
  <section v-else class="session-header">
    <div class="row top-row">
      <span class="provider-chip" :class="{ local: metadata.isLocal }">
        <span class="provider-dot" aria-hidden="true"></span>
        <span class="provider-name">{{ metadata.providerName }}</span>
      </span>
      <span class="version">v{{ metadata.version }}</span>
    </div>

    <div class="model">{{ metadata.model }}</div>

    <dl class="meta">
      <div v-if="metadata.priceLine" class="meta-row">
        <dt>Ціна</dt>
        <dd>{{ metadata.priceLine }}</dd>
      </div>
      <div class="meta-row">
        <dt>Директорія</dt>
        <dd class="cwd">{{ shortCwd }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.session-header {
  flex: 0 0 auto;
  margin: 12px 12px 0 12px;
  padding: 14px 16px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* Compact: підкреслено мінімалістичний однорядковий bar */
.session-header-compact {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: transparent;
  border-bottom: 1px solid var(--border);
  min-width: 0;
  overflow: hidden;
}

.compact-model {
  font-size: var(--font-size-sm);
  color: var(--fg);
  font-weight: 500;
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.top-row {
  justify-content: space-between;
}

.provider-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 8px;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  color: var(--fg);
  font-weight: 500;
  min-width: 0;
  flex-shrink: 0;
}
.provider-chip .provider-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.provider-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.provider-chip.local .provider-dot {
  background: var(--success);
}

.version {
  font-size: 11.5px;
  color: var(--fg-dim);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.model {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  word-break: break-all;
  line-height: 1.3;
}

.meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  margin: 0;
  padding: 0;
}
.meta-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 10px;
  min-width: 0;
  font-size: var(--font-size-sm);
}
.meta-row dt {
  color: var(--fg-muted);
  font-weight: 400;
}
.meta-row dd {
  margin: 0;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.meta-row .cwd {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--fg-muted);
}
</style>
