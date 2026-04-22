<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { t } from '../i18n'
import type { RemotePermissionRequest } from '../types'

const props = defineProps<{
  request: RemotePermissionRequest
}>()

const emit = defineEmits<{
  allow: [requestId: string, message?: string]
  deny: [requestId: string, message?: string]
}>()

// ─── AskUserQuestion detection ──────────────────────────────────────────────

type QuestionOption = { label: string; description?: string }
type Question = { question: string; header?: string; options: QuestionOption[]; multiSelect?: boolean }

const askQuestions = computed<Question[] | null>(() => {
  if (props.request.toolName !== 'AskUserQuestion') return null
  const inp = props.request.input as { questions?: Question[] } | null
  if (!inp?.questions?.length) return null
  return inp.questions
})

// Стан відповіді по кожному питанню. selected = обрані labels (для multi
// їх може бути кілька; для single — рівно одна). customText — текст
// опції "Інше"; якщо otherSelected=true і customText непорожній, він
// включається в фінальну відповідь. Патерн повторює логіку TUI-варіанта
// QuestionView + __other__ input.
type AnswerState = {
  selected: string[]
  customText: string
  otherSelected: boolean
}

const answers = reactive<Record<string, AnswerState>>({})
const currentIdx = ref(0)

function getAnswer(q: Question): AnswerState {
  const cur = answers[q.question]
  if (cur) return cur
  const fresh: AnswerState = { selected: [], customText: '', otherSelected: false }
  answers[q.question] = fresh
  return fresh
}

function isSelected(q: Question, label: string): boolean {
  return getAnswer(q).selected.includes(label)
}

function toggleOption(q: Question, label: string) {
  const a = getAnswer(q)
  if (q.multiSelect) {
    const idx = a.selected.indexOf(label)
    if (idx >= 0) a.selected = a.selected.filter(l => l !== label)
    else a.selected = [...a.selected, label]
  } else {
    // single-select: обрання стандартної опції знімає "Інше"
    a.selected = [label]
    a.otherSelected = false
  }
}

function toggleOther(q: Question) {
  const a = getAnswer(q)
  if (q.multiSelect) {
    a.otherSelected = !a.otherSelected
  } else {
    // single-select: "Інше" скасовує вибір інших опцій
    a.otherSelected = true
    a.selected = []
  }
}

function isAnswered(q: Question): boolean {
  const a = getAnswer(q)
  if (a.selected.length > 0) return true
  if (a.otherSelected && a.customText.trim().length > 0) return true
  return false
}

const currentQuestion = computed<Question | null>(() => {
  const qs = askQuestions.value
  if (!qs) return null
  return qs[currentIdx.value] ?? null
})

const totalQuestions = computed(() => askQuestions.value?.length ?? 0)
const isFirstQuestion = computed(() => currentIdx.value === 0)
const isLastQuestion = computed(() => currentIdx.value === totalQuestions.value - 1)
const canAdvance = computed(() => {
  const q = currentQuestion.value
  return q ? isAnswered(q) : false
})

function goPrev() {
  if (currentIdx.value > 0) currentIdx.value--
}
function goNext() {
  if (!canAdvance.value) return
  if (currentIdx.value < totalQuestions.value - 1) currentIdx.value++
}

function serializeAnswer(state: AnswerState): string {
  const parts = [...state.selected]
  if (state.otherSelected && state.customText.trim()) {
    parts.push(state.customText.trim())
  }
  return parts.join(', ')
}

const allAnswered = computed(() => {
  const qs = askQuestions.value
  if (!qs) return false
  return qs.every(q => isAnswered(q))
})

function submitAnswers() {
  const qs = askQuestions.value
  if (!qs) return
  const flat: Record<string, string> = {}
  for (const q of qs) {
    flat[q.question] = serializeAnswer(getAnswer(q))
  }
  emit('allow', props.request.requestId, JSON.stringify({ answers: flat }))
}

function onAllowClick() {
  emit('allow', props.request.requestId)
}

function onDenyClick() {
  emit('deny', props.request.requestId)
}

// ─── Generic permission (non-AskUserQuestion) ────────────────────────────────

const inputText = computed(() => {
  if (askQuestions.value) return ''
  const v = props.request.input
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
})
</script>

<template>
  <!-- ── AskUserQuestion: step-by-step multi-choice UI ─────────────────────── -->
  <div v-if="askQuestions && currentQuestion" class="banner ask" role="dialog">
    <div class="header">
      <span class="tool">{{ request.toolName }}</span>
      <span v-if="totalQuestions > 1" class="step-indicator">
        {{ currentIdx + 1 }} / {{ totalQuestions }}
      </span>
    </div>

    <!-- Крапки-прогрес (клікабельні — дозволяють стрибати між уже відкритими питаннями) -->
    <div v-if="totalQuestions > 1" class="steps">
      <button
        v-for="(q, i) in askQuestions"
        :key="q.question"
        type="button"
        class="step-dot"
        :class="{ active: i === currentIdx, done: isAnswered(q) }"
        :aria-label="`Питання ${i + 1}`"
        @click="currentIdx = i"
      />
    </div>

    <div class="question-block">
      <div class="question-text">{{ currentQuestion.question }}</div>
      <div class="options">
        <button
          v-for="opt in currentQuestion.options"
          :key="opt.label"
          type="button"
          class="option"
          :class="{ selected: isSelected(currentQuestion, opt.label) }"
          @click="toggleOption(currentQuestion, opt.label)"
        >
          <span class="option-marker">{{
            isSelected(currentQuestion, opt.label)
              ? (currentQuestion.multiSelect ? '☑' : '◉')
              : (currentQuestion.multiSelect ? '☐' : '○')
          }}</span>
          <span class="option-content">
            <span class="option-label">{{ opt.label }}</span>
            <span v-if="opt.description" class="option-desc">{{ opt.description }}</span>
          </span>
        </button>

        <!-- Auto-added "Other" (free text) — еквівалент TUI __other__. -->
        <div class="option other" :class="{ selected: getAnswer(currentQuestion).otherSelected }">
          <button
            type="button"
            class="option-head"
            @click="toggleOther(currentQuestion)"
          >
            <span class="option-marker">{{
              getAnswer(currentQuestion).otherSelected
                ? (currentQuestion.multiSelect ? '☑' : '◉')
                : (currentQuestion.multiSelect ? '☐' : '○')
            }}</span>
            <span class="option-content">
              <span class="option-label">Інше</span>
              <span class="option-desc">Напишіть свій варіант відповіді</span>
            </span>
          </button>
          <textarea
            v-if="getAnswer(currentQuestion).otherSelected"
            v-model="getAnswer(currentQuestion).customText"
            class="other-input"
            rows="2"
            placeholder="Ваш варіант…"
          />
        </div>
      </div>
    </div>

    <!-- Навігація між питаннями + фінальні дії -->
    <div class="actions">
      <button
        type="button"
        class="nav-btn"
        :disabled="isFirstQuestion"
        @click="goPrev"
      >
        ← Назад
      </button>
      <button
        v-if="!isLastQuestion"
        type="button"
        class="nav-btn primary"
        :disabled="!canAdvance"
        @click="goNext"
      >
        Далі →
      </button>
      <button
        v-else
        type="button"
        class="allow"
        :disabled="!allAnswered"
        @click="submitAnswers"
      >
        {{ t.permission.allow }}
      </button>
    </div>
  </div>

  <!-- ── Generic permission banner ─────────────────────────────────────────── -->
  <div v-else class="banner" role="alertdialog">
    <div class="header">
      <span class="badge">{{ t.permission.badge }}</span>
      <span class="tool">{{ request.toolName }}</span>
    </div>
    <div v-if="request.description" class="description">
      {{ request.description }}
    </div>
    <pre v-if="inputText" class="input">{{ inputText }}</pre>

    <div class="actions">
      <button
        type="button"
        class="deny"
        @click="onDenyClick"
      >
        {{ t.permission.deny }}
      </button>
      <button
        type="button"
        class="allow"
        @click="onAllowClick"
      >
        {{ t.permission.allow }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.banner {
  margin: 8px 10px 0 10px;
  margin-left: max(10px, env(safe-area-inset-left));
  margin-right: max(10px, env(safe-area-inset-right));
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slide-in 0.18s ease-out;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

/* Жовтий акцент на звичайному permission, індіго на AskUserQuestion —
   ОДИН піксель бордера зверху, не вся рамка, щоб не кричало */
.banner {
  border-top: 2px solid var(--warning);
}
.banner.ask {
  border-top-color: var(--accent);
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-muted);
  font-size: var(--font-size-sm);
}

.badge {
  display: none;
}

.tool {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.description {
  color: var(--fg-muted);
  font-size: var(--font-size-sm);
  line-height: 1.45;
  padding-left: 14px;
  position: relative;
}
.description::before {
  content: "│";
  position: absolute;
  left: 0;
  color: var(--fg-dim);
}

.input {
  background: var(--bg);
  border: 1px solid var(--border-strong);
  padding: 6px 10px;
  border-radius: 0;
  font-size: var(--font-size-sm);
  max-height: 200px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #c7ccd4;
}

/* ─── AskUserQuestion styles ─────────────────────────────────────────────── */

.question-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.question-text {
  font-size: var(--font-size-base);
  color: var(--fg);
  font-weight: 500;
  padding-left: 2px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
  font: inherit;
  font-size: var(--font-size-sm);
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  border-radius: var(--radius-sm);
  min-height: 44px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.option:hover {
  border-color: var(--accent-dim);
  background: var(--bg-chip);
}
.option:active {
  transform: scale(0.99);
}
.option.selected {
  border-color: var(--accent-dim);
  background: rgba(177, 185, 249, 0.1);
  color: var(--accent-dim);
}

.option-marker {
  flex-shrink: 0;
  font-size: 13px;
  margin-top: 1px;
  color: var(--fg-muted);
}
.option.selected .option-marker {
  color: var(--accent-dim);
}

/* "Інше" — контейнер з кнопкою-головою + textarea усередині */
.option.other {
  padding: 0;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}
.option.other .option-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  min-height: 44px;
  width: 100%;
  box-sizing: border-box;
}
.other-input {
  margin: 0 12px 10px;
  padding: 6px 8px;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font: inherit;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  resize: vertical;
  min-height: 44px;
  max-height: 140px;
  outline: none;
  box-sizing: border-box;
  width: calc(100% - 24px);
  transition: border-color 0.15s;
}
.other-input:focus {
  border-color: var(--accent-dim);
}

/* Step-indicator та крапки прогресу */
.step-indicator {
  margin-left: auto;
  color: var(--fg-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.steps {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-left: 2px;
}
.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: transparent;
  cursor: pointer;
  padding: 0;
  min-height: auto;
  min-width: auto;
  flex: 0 0 auto;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.step-dot:hover {
  border-color: var(--accent-dim);
}
.step-dot.done {
  background: var(--accent-dim);
  border-color: var(--accent-dim);
}
.step-dot.active {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.3);
}

/* Навігаційні кнопки "Назад / Далі" */
.nav-btn {
  color: var(--fg-muted);
  border: 1px solid var(--border-strong);
  padding: 8px 18px;
  min-height: 44px;
  font-size: var(--font-size-base);
  font-weight: 500;
}
.nav-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent-dim);
  background: transparent;
}
.nav-btn.primary {
  color: var(--accent);
  border-color: var(--accent-dim);
}
.nav-btn.primary:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), 0.1);
  border-color: var(--accent);
}
.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.option-label {
  font-weight: 500;
}

.option-desc {
  color: var(--fg-muted);
  font-size: 11.5px;
  line-height: 1.4;
  white-space: normal;
}

/* ─── Actions ────────────────────────────────────────────────────────────── */

.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

button {
  /* 44px min-height satisfies Apple HIG touch target guidelines */
  min-height: 44px;
  padding: 8px 22px;
  border-radius: var(--radius);
  font: inherit;
  font-weight: 600;
  font-size: var(--font-size-base);
  cursor: pointer;
  background: transparent;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.1s;
  flex: 1 1 auto;
  min-width: 100px;
}

.allow {
  color: var(--success);
  border: 1px solid var(--success);
}
.allow:hover:not(:disabled) {
  background: var(--success);
  color: var(--bg);
  box-shadow: 0 4px 12px rgba(78, 186, 101, 0.25);
}
.allow:active:not(:disabled) {
  transform: scale(0.985);
}
.allow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.deny {
  color: var(--danger);
  border: 1px solid var(--danger);
}
.deny:hover {
  background: var(--danger);
  color: var(--bg);
  box-shadow: 0 4px 12px rgba(255, 107, 128, 0.25);
}
.deny:active {
  transform: scale(0.985);
}

.link {
  background: transparent;
  border: none;
  color: var(--fg-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 6px 4px;
  min-height: auto;
  flex: 0 0 auto;
  min-width: auto;
}
.link:hover {
  color: var(--accent);
  text-decoration: underline;
  background: transparent;
}
</style>
