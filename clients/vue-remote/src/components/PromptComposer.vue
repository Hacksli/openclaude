<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { t } from '../i18n'

const props = defineProps<{
  disabled: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  submit: [text: string]
}>()

const text = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

function autosize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

watch(text, autosize, { flush: 'post' })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submit()
  }
}

async function submit() {
  const trimmed = text.value.trim()
  if (!trimmed || props.disabled) return
  emit('submit', trimmed)
  text.value = ''
  await nextTick()
  autosize()
}

async function setText(value: string) {
  text.value = value
  await nextTick()
  autosize()
  textarea.value?.focus()
}

function onFocus() {
  // Скролити до текстового поля при фокусі для мобільних пристроїв
  nextTick(() => {
    textarea.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

defineExpose({ setText })
</script>

<template>
  <footer class="composer" :class="{ disabled, loading: isLoading }">
    <!-- Send тепер всередині input-wrap — інтегрована кнопка в полі вводу
         (паттерн ChatGPT/Claude.ai). Візуально прив'язана до правого краю
         текстового поля, висота і розмір узгоджені. -->
    <div class="input-wrap">
      <textarea
        ref="textarea"
        v-model="text"
        :placeholder="disabled ? t.composer.placeholderDisabled : t.composer.placeholder"
        :disabled="disabled"
        rows="1"
        autocomplete="off"
        autocapitalize="sentences"
        @keydown="onKeydown"
        @focus="onFocus"
      ></textarea>
      <button
        type="button"
        class="send"
        :disabled="disabled || !text.trim()"
        :aria-label="isLoading ? t.composer.interrupt : t.composer.send"
        @click="submit"
      >
        <svg v-if="isLoading" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.composer {
  flex: 0 0 auto;
  display: flex;
  padding: 10px 12px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
  border-top: 1px solid var(--border);
  background: var(--bg);
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.input-wrap {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: flex-end;  /* send тягнеться до низу при multi-line textarea */
  gap: 8px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  padding: 6px 6px 6px 14px; /* менший right padding — там сидить send */
  border-radius: 20px; /* pill-shape */
  transition: border-color 0.15s;
  min-height: 40px;
}
.input-wrap:focus-within {
  border-color: var(--accent);
}
.composer.disabled .input-wrap {
  opacity: 0.55;
}

.prompt-prefix {
  color: var(--user);
  font-weight: 700;
  line-height: var(--line-height);
  user-select: none;
  flex-shrink: 0;
  margin-top: 1px;
}
.composer.disabled .prompt-prefix {
  color: var(--fg-dim);
}

textarea {
  flex: 1 1 0;
  min-width: 0;
  background: transparent;
  border: none;
  color: var(--fg);
  padding: 5px 0;   /* вертикально центрує 1-рядкове введення до 28px send */
  font: inherit;
  font-size: var(--font-size-base);
  resize: none;
  outline: none;
  line-height: var(--line-height);
  max-height: 200px;
  caret-color: var(--accent);
  align-self: center;
}
textarea::placeholder {
  color: var(--fg-dim);
}
textarea:disabled {
  cursor: not-allowed;
}

.send {
  /* flex-end → кнопка лишається внизу при multi-line textarea, не
     з'їжджає до середини. Шляхом align-self: flex-end в `.input-wrap`
     з align-items: flex-end — те саме, але явно. */
  align-self: flex-end;
  width: 34px;
  min-width: 34px;
  height: 34px;
  background: var(--fg);
  color: var(--bg);
  border: none;
  cursor: pointer;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 50%;
  transition: opacity 0.15s, transform 0.1s, background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.send:not(:disabled):hover { opacity: 0.85; }
.send:not(:disabled):active { transform: scale(0.92); }
.send:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}
.composer.loading .send {
  background: var(--accent);
  color: var(--bg);
}
</style>
