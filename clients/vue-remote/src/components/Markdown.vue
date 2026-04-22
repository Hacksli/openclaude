<script setup lang="ts">
import { computed } from 'vue'
import { Marked } from 'marked'

const marked = new Marked({
  gfm: true,
  breaks: true,
})

const props = defineProps<{
  text: string
}>()

const html = computed(() =>
  marked.parse(props.text, { async: false }) as string
)
</script>

<template>
  <div
    class="md"
    v-html="html"
  />
</template>

<style scoped>
.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4),
.md :deep(h5),
.md :deep(h6) {
  margin: 0.8em 0 0.3em;
  font-weight: 600;
  color: var(--accent);
}
.md :deep(h1) { font-size: 1.3em; }
.md :deep(h2) { font-size: 1.15em; }
.md :deep(h3) { font-size: 1.05em; }

.md :deep(p) {
  margin: 0.2em 0;
}

.md :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.md :deep(a:hover) {
  text-decoration: underline;
}

.md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.md :deep(pre) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  overflow-x: auto;
  font-size: var(--font-size-sm);
  line-height: 1.45;
}
.md :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
}

.md :deep(blockquote) {
  border-left: 3px solid var(--accent);
  margin: 0.4em 0;
  padding: 0.2em 0.6em;
  color: var(--fg-muted);
}

.md :deep(ul),
.md :deep(ol) {
  padding-left: 1.4em;
  margin: 0.2em 0;
}

.md :deep(table) {
  border-collapse: collapse;
  margin: 0.4em 0;
  font-size: var(--font-size-sm);
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid var(--border);
  padding: 4px 8px;
}
.md :deep(th) {
  background: var(--bg-elev);
  font-weight: 600;
}

.md :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0.6em 0;
}

.md :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
}
</style>
