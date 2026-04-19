/**
 * Secure storage for Gemini CLI OAuth credentials.
 *
 * Credentials are loaded from ~/.gemini/oauth_creds.json (Gemini CLI's own file)
 * at startup, optionally refreshed if expired, and cached in memory via env vars
 * for the duration of the session.
 *
 * We do NOT write back to ~/.gemini/oauth_creds.json — that file belongs to
 * Gemini CLI. Instead we only cache the in-session resolved token in memory.
 */

import { isBareMode, isEnvTruthy } from './envUtils.js'
import { logForDebugging } from './debug.js'

export const GEMINI_OAUTH_STORAGE_KEY = 'gemini-oauth' as const

export type GeminiOAuthCredentialBlob = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
  projectId: string
  tier: string
}

/** In-memory cache of resolved credentials for this session. */
let sessionCredentials: GeminiOAuthCredentialBlob | null = null

export function setGeminiOAuthSessionCredentials(blob: GeminiOAuthCredentialBlob): void {
  sessionCredentials = blob
}

export function getGeminiOAuthSessionCredentials(): GeminiOAuthCredentialBlob | null {
  return sessionCredentials
}

/**
 * Initialize Gemini OAuth credentials for this session.
 *
 * Reads from Gemini CLI's ~/.gemini/oauth_creds.json, refreshes if expired,
 * then sets GEMINI_ACCESS_TOKEN and GOOGLE_CLOUD_PROJECT so the existing
 * Gemini OpenAI-compatible shim picks them up automatically.
 *
 * Returns true if credentials were successfully loaded, false otherwise.
 */
export async function initGeminiOAuthIfNeeded(
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  if (!isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI_OAUTH)) {
    return false
  }

  if (isBareMode()) {
    return false
  }

  // If already set in environment, nothing to do
  if (process.env.GEMINI_ACCESS_TOKEN?.trim()) {
    return true
  }

  try {
    const { loadGeminiCliOAuth } = await import('./geminiOAuth/index.js')
    const identity = await loadGeminiCliOAuth(onProgress)

    if (!identity) {
      logForDebugging(
        '[gemini-oauth] No Gemini CLI credentials found at ~/.gemini/oauth_creds.json',
        { level: 'warn' },
      )
      return false
    }

    // Cache in memory
    setGeminiOAuthSessionCredentials(identity)

    // Set env vars so the existing Gemini shim picks them up
    process.env.GEMINI_ACCESS_TOKEN = identity.accessToken
    if (identity.projectId) {
      process.env.GOOGLE_CLOUD_PROJECT = identity.projectId
    }

    return true
  } catch (err) {
    logForDebugging(
      `[gemini-oauth] Failed to load Gemini CLI credentials: ${err instanceof Error ? err.message : String(err)}`,
      { level: 'warn' },
    )
    return false
  }
}

/**
 * Synchronous hydration: copies already-cached session credentials into env vars.
 * Called from createOpenAIShimClient() — must be synchronous.
 */
export function hydrateGeminiOAuthFromSecureStorage(): void {
  if (!isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI_OAUTH)) {
    return
  }

  if (isBareMode()) {
    return
  }

  const cached = getGeminiOAuthSessionCredentials()
  if (!cached) {
    return
  }

  // If the cached token is still valid, only set env var if not already set.
  // If expired, clear it so the async refresh in _doOpenAIRequest will pick up the new token.
  const now = Date.now()
  if (cached.expiresAt <= now) {
    delete process.env.GEMINI_ACCESS_TOKEN
    return
  }

  if (!process.env.GEMINI_ACCESS_TOKEN?.trim()) {
    process.env.GEMINI_ACCESS_TOKEN = cached.accessToken
    if (cached.projectId) {
      process.env.GOOGLE_CLOUD_PROJECT = cached.projectId
    }
  }
}

/**
 * Check whether the session access token is about to expire and refresh if needed.
 * Called at startup from cli.tsx (same pattern as refreshGithubModelsTokenIfNeeded).
 */
export async function refreshGeminiOAuthTokenIfNeeded(): Promise<boolean> {
  if (!isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI_OAUTH)) {
    return false
  }

  if (isBareMode()) {
    return false
  }

  const cached = getGeminiOAuthSessionCredentials()
  if (!cached) {
    return false
  }

  const now = Date.now()
  if (cached.expiresAt > now) {
    return false // still valid
  }

  try {
    const { refreshAccessToken, resolveOAuthClientConfig } = await import(
      './geminiOAuth/index.js'
    )
    const { readGeminiCliCredFile } = await import('./geminiOAuth/credentials.js')
    const credFile = readGeminiCliCredFile()
    const clientConfig = resolveOAuthClientConfig(credFile)
    if (!clientConfig) {
      logForDebugging(
        '[gemini-oauth] Cannot refresh token: OAuth client config not found',
        { level: 'warn' },
      )
      return false
    }

    const refreshed = await refreshAccessToken(cached.refreshToken, clientConfig)

    const updated: GeminiOAuthCredentialBlob = {
      ...cached,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    }

    setGeminiOAuthSessionCredentials(updated)
    process.env.GEMINI_ACCESS_TOKEN = updated.accessToken

    return true
  } catch (err) {
    logForDebugging(
      `[gemini-oauth] Token refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      { level: 'warn' },
    )
    return false
  }
}
