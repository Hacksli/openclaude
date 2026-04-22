/**
 * Мінімалістичний перемикач тем. Зберігає вибір у localStorage; якщо його
 * нема, стартує з system-preference (prefers-color-scheme). Активна тема
 * встановлюється як `data-theme` на <html> — CSS у main.css читає цей
 * атрибут. Слухає зміну system preference лише коли користувач НЕ робив
 * явний вибір (щоб не перекривати його налаштуванням OS).
 */

import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'theme'

type Theme = 'light' | 'dark'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const stored = readStored()
const initial: Theme = stored ?? systemTheme()
const theme = ref<Theme>(initial)
// Чи користувач явно щось обирав (true — ігноруємо system changes)
const explicit = ref<boolean>(stored !== null)

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if (explicit.value) return
    theme.value = mq.matches ? 'light' : 'dark'
  }
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else if ((mq as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener) {
    ;(mq as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onChange)
  }
}

watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
})

export function useTheme() {
  function setTheme(next: Theme) {
    theme.value = next
    explicit.value = true
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* noop */ }
  }
  function toggle() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }
  return { theme, setTheme, toggle }
}
