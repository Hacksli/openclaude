<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '../i18n'
import { useLocalStorage } from '../composables/useStorage'

const props = defineProps<{
  initialUrl: string
  initialToken: string
  error: string | null
  busy: boolean
}>()

const emit = defineEmits<{
  connect: [url: string, token: string]
}>()

const url = ref(props.initialUrl)
const token = ref(props.initialToken)
const showToken = ref(false)

const currentOrigin = `${window.location.protocol}//${window.location.host}`
const showFillOrigin = computed(() => !url.value.startsWith(currentOrigin))

watch(() => props.initialUrl, v => {
  if (v && !url.value) url.value = v
})

watch(() => props.initialToken, v => {
  if (v && !token.value) token.value = v
})

function onSubmit(e: Event) {
  e.preventDefault()
  emit('connect', url.value.trim(), token.value.trim())
}

function fillCurrentOrigin() {
  url.value = currentOrigin
}

// Налаштування відображення шапки сесії. Зберігається у localStorage,
// читається у App.vue. Значення: 'full' | 'compact' | 'hidden'.
const headerMode = useLocalStorage('session-header-mode', 'full')
const headerOptions = [
  { value: 'full', label: 'Повна' },
  { value: 'compact', label: 'Коротка' },
  { value: 'hidden', label: 'Схована' },
] as const
</script>

<template>
  <section class="connect-panel">
    <form @submit="onSubmit">
      <h2>{{ t.connect.title }}</h2>
      <p class="hint">{{ t.connect.hint }}</p>

      <label>
        <span class="label-row">
          <span>{{ t.connect.url }}</span>
          <button
            v-if="showFillOrigin"
            type="button"
            class="link"
            @click="fillCurrentOrigin"
          >
            {{ t.connect.useCurrentOrigin }}
          </button>
        </span>
        <input
          v-model="url"
          type="text"
          :placeholder="t.connect.placeholderUrl"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          inputmode="url"
          required
        />
      </label>

      <label>
        <span class="label-row">
          <span>{{ t.connect.token }}</span>
          <button type="button" class="link" @click="showToken = !showToken">
            {{ showToken ? t.connect.hide : t.connect.show }}
          </button>
        </span>
        <input
          v-model="token"
          :type="showToken ? 'text' : 'password'"
          :placeholder="t.connect.placeholderToken"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          required
        />
      </label>

      <button type="submit" class="primary" :disabled="busy">
        {{ busy ? t.connect.submitting : t.connect.submit }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <!-- Вподобання інтерфейсу. Збережуться у localStorage і застосуються
         незалежно від того, натискав користувач "Підключитись" чи ні. -->
    <section class="prefs">
      <h3>Інтерфейс</h3>
      <div class="pref-row">
        <label class="pref-label" for="header-mode">Шапка сесії</label>
        <div class="segmented" role="radiogroup" aria-label="Шапка сесії">
          <button
            v-for="opt in headerOptions"
            :key="opt.value"
            type="button"
            class="seg"
            :class="{ active: headerMode === opt.value }"
            role="radio"
            :aria-checked="headerMode === opt.value"
            @click="headerMode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.connect-panel {
  flex: 1;
  padding: 24px 16px;
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
}

form {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  background: transparent;
  min-width: 0;
}

h2 {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg);
  letter-spacing: 0.2px;
}

.hint {
  margin: 0 0 20px 0;
  color: var(--fg-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

code {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--accent);
  font-size: var(--font-size-sm);
}

label {
  display: block;
  margin-bottom: 14px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-size: var(--font-size-sm);
  color: var(--fg-muted);
  margin-bottom: 8px;
  min-width: 0;
}
.label-row > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.link {
  background: transparent;
  border: none;
  color: var(--accent);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 4px 0;
  flex-shrink: 0;
}
.link:hover {
  text-decoration: underline;
}

input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  padding: 10px 12px;
  min-height: 44px;
  font: inherit;
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color 0.15s;
}
input:focus {
  border-color: var(--accent);
}

button.primary {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  min-height: 44px;
  background: var(--fg);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-weight: 500;
  font-size: var(--font-size-base);
  cursor: pointer;
  margin-top: 14px;
  transition: opacity 0.15s, transform 0.1s;
}
button.primary:hover:not(:disabled) {
  opacity: 0.88;
}
button.primary:active:not(:disabled) {
  transform: scale(0.985);
}
button.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  font-size: var(--font-size-sm);
  margin: 14px 0 0 0;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

/* ─── Preferences section ─────────────────────────────────────────────── */

.prefs {
  margin-top: 20px;
  padding: 22px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.prefs h3 {
  margin: 0 0 14px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  min-width: 0;
}
.pref-label {
  color: var(--fg);
  font-size: var(--font-size-base);
  min-width: 0;
}

.segmented {
  display: inline-flex;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 2px;
}
.seg {
  background: transparent;
  border: none;
  color: var(--fg-muted);
  font: inherit;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  min-height: 28px;
  transition: background 0.12s, color 0.12s;
}
.seg:hover:not(.active) {
  color: var(--fg);
}
.seg.active {
  background: var(--bg);
  color: var(--fg);
}
</style>
