<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { t } from '../i18n'
import type { ImageAttachment } from '../types'

const props = defineProps<{
  disabled: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  submit: [text: string, attachments?: ImageAttachment[]]
  cancel: []
}>()

const text = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const attachments = ref<ImageAttachment[]>([])
const isDragging = ref(false)

function autosize() {
  const el = textarea.value
  if (!el) return
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
  const maxRows = 4
  const maxHeight = lineHeight * maxRows
  // Temporarily disable overflow so scrollHeight reflects content,
  // not the clipped viewport.
  el.style.overflowY = 'hidden'
  el.style.height = 'auto'
  const scrollH = el.scrollHeight
  el.style.height = Math.min(scrollH, maxHeight) + 'px'
  el.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden'
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
  if (!trimmed && attachments.value.length === 0) return
  if (props.disabled) return
  emit('submit', trimmed, attachments.value.length > 0 ? attachments.value : undefined)
  text.value = ''
  attachments.value = []
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
  nextTick(() => {
    textarea.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// ─── File attachment handling ───────────────────────────────────────────────

function openFilePicker() {
  fileInput.value?.click()
}

function fileToAttachment(file: File): Promise<ImageAttachment | null> {
  return new Promise((resolve) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      if (!base64) {
        resolve(null)
        return
      }
      resolve({
        type: 'image',
        media_type: file.type as ImageAttachment['media_type'],
        data: base64,
        filename: file.name,
      })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

async function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files) return
  await addFiles(Array.from(files))
  target.value = ''
}

async function addFiles(files: File[]) {
  const results = await Promise.all(files.map(fileToAttachment))
  const valid = results.filter((a): a is ImageAttachment => a !== null)
  if (valid.length > 0) {
    attachments.value = [...attachments.value, ...valid]
  }
}

function removeAttachment(index: number) {
  attachments.value = attachments.value.filter((_, i) => i !== index)
}

// ─── Drag & Drop ────────────────────────────────────────────────────────────

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    await addFiles(Array.from(files))
  }
}

// ─── Paste from clipboard ───────────────────────────────────────────────────

async function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const imageItems: DataTransferItem[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      imageItems.push(item)
    }
  }
  if (imageItems.length === 0) return
  e.preventDefault()
  const files = imageItems.map(item => item.getAsFile()).filter((f): f is File => f !== null)
  await addFiles(files)
}

function formatFileSize(base64: string): string {
  const bytes = Math.ceil((base64.length * 3) / 4)
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

defineExpose({ setText })
</script>

<template>
  <footer
    class="composer"
    :class="{ disabled, loading: isLoading, dragging: isDragging }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Attachment preview chips -->
    <div v-if="attachments.length > 0" class="attachments">
      <div
        v-for="(att, idx) in attachments"
        :key="idx"
        class="attachment-chip"
      >
        <img
          v-if="att.data"
          :src="`data:${att.media_type};base64,${att.data}`"
          class="attachment-thumb"
          alt=""
        />
        <span class="attachment-name">{{ att.filename || 'image' }}</span>
        <span class="attachment-size">{{ formatFileSize(att.data) }}</span>
        <button
          type="button"
          class="attachment-remove"
          @click="removeAttachment(idx)"
          title="Видалити"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Drag overlay -->
    <div v-if="isDragging" class="drag-overlay">
      <span>Відпустіть файли для завантаження</span>
    </div>

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
        @paste="onPaste"
      ></textarea>
      <button
        type="button"
        class="attach"
        :disabled="disabled"
        :aria-label="t.composer.attach || 'Прикріпити файл'"
        @click="openFilePicker"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>
      <button
        v-if="isLoading && !text.trim() && attachments.length === 0"
        type="button"
        class="cancel-btn"
        :aria-label="t.composer.interrupt"
        @click="emit('cancel')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
        <span>Стоп</span>
      </button>
      <button
        v-else
        type="button"
        class="send"
        :disabled="disabled || (!text.trim() && attachments.length === 0)"
        :aria-label="t.composer.send"
        @click="submit()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      style="display: none"
      @change="onFileSelect"
    />
  </footer>
</template>

<style scoped>
.composer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
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
  position: relative;
}

.composer.dragging {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), 0.05);
}

/* ─── Attachments ────────────────────────────────────────────────────────── */

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  color: var(--fg-muted);
  max-width: 100%;
  box-sizing: border-box;
}

.attachment-thumb {
  width: 24px;
  height: 24px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.attachment-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.attachment-size {
  color: var(--fg-dim);
  font-size: 11px;
  flex-shrink: 0;
}

.attachment-remove {
  background: transparent;
  border: none;
  color: var(--fg-dim);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  min-height: auto;
  min-width: auto;
  flex-shrink: 0;
}
.attachment-remove:hover {
  color: var(--danger);
}

/* ─── Drag overlay ───────────────────────────────────────────────────────── */

.drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--accent-rgb), 0.1);
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
  z-index: 10;
  pointer-events: none;
}
.drag-overlay span {
  color: var(--accent);
  font-weight: 500;
  font-size: var(--font-size-base);
}

/* ─── Input wrap ─────────────────────────────────────────────────────────── */

.input-wrap {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  padding: 6px 6px 6px 14px;
  border-radius: 20px;
  transition: border-color 0.15s;
  min-height: 40px;
  box-sizing: border-box;
  overflow: hidden;
}
.input-wrap:focus-within {
  border-color: var(--accent);
}
.composer.disabled .input-wrap {
  opacity: 0.55;
}

textarea {
  flex: 1 1 0;
  min-width: 0;
  background: transparent;
  border: none;
  color: var(--fg);
  padding: 6px 0;
  font: inherit;
  font-size: var(--font-size-base);
  resize: none;
  outline: none;
  line-height: var(--line-height);
  max-height: 200px;
  caret-color: var(--accent);
  align-self: flex-end;
  overflow-y: auto;
  overflow-wrap: break-word;
  word-break: break-word;
}
textarea::placeholder {
  color: var(--fg-dim);
}
textarea:disabled {
  cursor: not-allowed;
}

/* ─── Buttons ────────────────────────────────────────────────────────────── */

.attach {
  align-self: center;
  width: 34px;
  min-width: 34px;
  height: 34px;
  background: transparent;
  color: var(--fg-muted);
  border: none;
  cursor: pointer;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 50%;
  transition: opacity 0.15s, transform 0.1s, background 0.15s, color 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.attach:not(:disabled):hover {
  background: var(--bg-chip);
  color: var(--accent);
}
.attach:not(:disabled):active {
  transform: scale(0.92);
}
.attach:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.send {
  align-self: center;
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
/* Cancel button — показується замість send під час isLoading */
.cancel-btn {
  align-self: center;
  height: 34px;
  padding: 0 12px;
  background: var(--danger);
  color: var(--bg);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  flex-shrink: 0;
  transition: opacity 0.15s, transform 0.1s;
  animation: pulse-stop 1.2s ease-in-out infinite;
}
.cancel-btn:hover { opacity: 0.88; }
.cancel-btn:active { transform: scale(0.92); }

@keyframes pulse-stop {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
