/**
 * Збирає метадані сесії (provider, модель, baseUrl, ціна, версія, cwd)
 * у структурованому вигляді, щоб worker міг відправити їх демону при
 * реєстрації, а демон — далі браузеру разом з `hello`. Це те саме, що
 * TUI друкує у startup-банер, але без ANSI/ASCII-box, придатне для
 * рендеру у веб-клієнті.
 */

import { detectProvider, formatStartupPricingLine } from '../components/StartupScreen.js'
import { getSelectedFavoriteModel } from '../utils/favorites.js'

export type SessionMetadata = {
  version: string
  providerName: string
  model: string
  baseUrl: string
  isLocal: boolean
  /** Готовий рядок ціни (наприклад "$0.33 / $1.95 per Mtok · 1M ctx"), якщо є */
  priceLine?: string
  cwd: string
}

export function collectSessionMetadata(): SessionMetadata {
  const p = detectProvider()
  const pricing = getSelectedFavoriteModel()?.pricing
  const priceLine = pricing ? formatStartupPricingLine(pricing) : undefined
  return {
    version: (MACRO.DISPLAY_VERSION ?? MACRO.VERSION) as string,
    providerName: p.name,
    model: p.model,
    baseUrl: p.baseUrl,
    isLocal: p.isLocal,
    priceLine: priceLine || undefined,
    cwd: process.cwd(),
  }
}
