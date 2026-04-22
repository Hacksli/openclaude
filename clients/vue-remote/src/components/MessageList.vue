<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { renderMessage } from '../composables/renderMessage'
import { t } from '../i18n'
import type { WireMessage } from '../types'
import Message from './Message.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'

const props = defineProps<{
  messages: WireMessage[]
  isLoading?: boolean
  spinnerVerb?: string | null
  /** Кнопка скролу ховається коли з'являється PermissionBanner поверх. */
  bannerShown?: boolean
}>()

const scrollRoot = ref<HTMLElement | null>(null)
const pinned = ref(true)

const rendered = computed(() =>
  props.messages
    .map(renderMessage)
    .filter(m => !m.isEmpty && !m.isMeta),
)

function onScroll() {
  const el = scrollRoot.value
  if (!el) return
  const threshold = 80
  pinned.value = el.scrollHeight - el.clientHeight - el.scrollTop < threshold
}

watch(
  () => props.messages,
  async () => {
    if (!pinned.value) return
    await nextTick()
    const el = scrollRoot.value
    if (el) el.scrollTop = el.scrollHeight
  },
  { flush: 'post' },
)

async function jumpToBottom() {
  pinned.value = true
  await nextTick()
  const el = scrollRoot.value
  if (el) el.scrollTop = el.scrollHeight
}

defineExpose({ jumpToBottom })
</script>

<template>
  <div class="stream" ref="scrollRoot" @scroll.passive="onScroll">
    <div v-if="rendered.length === 0" class="empty">
      {{ t.messages.waiting }}
    </div>
    <div class="messages">
      <Message
        v-for="(m, idx) in rendered"
        :key="m.uuid || idx"
        :message="m"
      />
      <ThinkingIndicator v-if="isLoading" :verb="spinnerVerb ?? undefined" />
    </div>

    <div v-if="!pinned && !props.bannerShown && rendered.length > 0" class="jump-wrap">
      <button
        type="button"
        class="jump-latest"
        @click="jumpToBottom"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 4v12M5 11l5 5 5-5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stream {
  flex: 1 1 auto;
  /* min-height:0 lets the flex item shrink below its content height */
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  /* Prevent any wide content (code blocks, long tokens) from pushing the
     layout wider than the viewport and sending the send button off-screen */
  overflow-x: hidden;
  padding: 8px 10px;
  padding-left: max(10px, env(safe-area-inset-left));
  padding-right: max(10px, env(safe-area-inset-right));
  position: relative;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
  background: var(--bg);
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100%;
  /* Ensure the column never forces horizontal overflow */
  min-width: 0;
  max-width: 100%;
}

.empty {
  margin: auto;
  color: var(--fg-dim);
  font-size: var(--font-size-sm);
  padding: 48px 16px;
  text-align: center;
  letter-spacing: 0.3px;
  line-height: 1.55;
}

.jump-latest {
  position: fixed;
  bottom: 80px; /* above the prompt composer (~60px) + padding */
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elev);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  padding: 6px 16px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: background 0.15s, transform 0.1s;
  z-index: 99;
}
.jump-latest:hover {
  background: rgba(var(--accent-rgb), 0.12);
}
.jump-latest:active {
  transform: translateX(-50%) scale(0.97);
}

.arrow-down {
  margin-right: 6px;
  line-height: 1;
  display: inline-block;
}
</style>
