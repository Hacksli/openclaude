import { getGlobalConfig, saveGlobalConfig, type RecentlyUsedModel } from '../config.js'
import { getAPIProvider } from './providers.js'

const MAX_RECENT_MODELS = 30

function getProviderKey(): string {
  const provider = getAPIProvider()
  if (provider === 'firstParty') return 'anthropic'
  if (provider === 'openai') {
    // Distinguish between different OpenAI-compatible providers by base URL
    const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE ?? ''
    if (baseUrl.includes('openrouter')) return 'openai:openrouter'
    if (baseUrl.includes('localhost:11434')) return 'openai:ollama'
    if (baseUrl.includes('localhost:1234')) return 'openai:lmstudio'
    if (baseUrl.includes('api.openai')) return 'openai'
    return `openai:custom`
  }
  return `openai:${provider}`
}

function recordRecentModel(model: string, provider: string): void {
  saveGlobalConfig(current => {
    const models = [...(current.recentlyUsedModels ?? [])]
    // Remove existing entry for this model+provider
    const existingIdx = models.findIndex(
      m => m.model === model && m.provider === provider
    )
    if (existingIdx !== -1) {
      models.splice(existingIdx, 1)
    }
    // Add to front (most recent)
    models.unshift({ model, provider, lastUsedAt: Date.now() })
    // Cap at MAX_RECENT_MODELS
    return {
      ...current,
      recentlyUsedModels: models.slice(0, MAX_RECENT_MODELS),
    }
  })
}

export function addRecentModel(model: string): void {
  // Resolve 'opus', 'sonnet', 'haiku' aliases to actual model names
  const m = model?.toLowerCase().trim()
  // Aliases don't need to be resolved for history — store the literal user chose
  // so the picker can re-resolve it later
  recordRecentModel(model, getProviderKey())
}

export function getRecentModels(): RecentlyUsedModel[] {
  return getGlobalConfig().recentlyUsedModels ?? []
}

export function getCurrentProviderKey(): string {
  return getProviderKey()
}
