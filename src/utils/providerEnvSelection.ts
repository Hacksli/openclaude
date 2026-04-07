import { isEnvTruthy } from './envUtils.js'

export const EXPLICIT_PROVIDER_ENV_VAR = 'CLAUDE_CODE_EXPLICIT_PROVIDER'

const PROVIDER_FLAG_KEYS = [
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_GEMINI',
  'CLAUDE_CODE_USE_GITHUB',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
] as const

export function clearProviderSelectionFlags(
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of PROVIDER_FLAG_KEYS) {
    delete env[key]
  }
}

function getExplicitProvider(processEnv: NodeJS.ProcessEnv): string | undefined {
  const explicitProvider = processEnv[EXPLICIT_PROVIDER_ENV_VAR]?.trim()
  if (explicitProvider) return explicitProvider

  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_GEMINI)) return 'gemini'
  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_GITHUB)) return 'github'
  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_OPENAI)) return 'openai'
  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_BEDROCK)) return 'bedrock'
  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_VERTEX)) return 'vertex'
  if (isEnvTruthy(processEnv.CLAUDE_CODE_USE_FOUNDRY)) return 'foundry'

  return undefined
}

function isGithubModel(model: string | undefined): boolean {
  return (model ?? '').trim().toLowerCase().startsWith('github:')
}

export function filterSettingsEnvForExplicitProvider(
  env: Record<string, string> | undefined,
  processEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  if (!env) return {}

  const explicitProvider = getExplicitProvider(processEnv)
  if (!explicitProvider) {
    return env
  }

  const filtered = { ...env }
  for (const key of PROVIDER_FLAG_KEYS) {
    delete filtered[key]
  }

  if (explicitProvider === 'github') {
    if (!isGithubModel(filtered.OPENAI_MODEL)) {
      delete filtered.OPENAI_MODEL
    }
    return filtered
  }

  if (isGithubModel(filtered.OPENAI_MODEL)) {
    delete filtered.OPENAI_MODEL
  }

  return filtered
}
