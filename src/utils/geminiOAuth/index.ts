/**
 * Gemini CLI OAuth — main orchestrator.
 *
 * Primary path: read existing Gemini CLI credentials from ~/.gemini/oauth_creds.json
 * and reuse them without requiring the user to re-authenticate.
 *
 * If the access token is expired, we refresh it using the stored refresh_token
 * and the client_id/secret extracted from the Gemini CLI installation.
 *
 * WARNING: This is an unofficial integration. Google does not officially sanction
 * use of Gemini CLI OAuth in third-party tools. Account restrictions may apply.
 */

import {
  getGeminiCliCredPath,
  readGeminiCliCredFile,
  resolveOAuthClientConfig,
} from './credentials.js'
import { resolveGoogleProject } from './project.js'
import { refreshAccessToken } from './token.js'
import { SAFETY_WINDOW_MS } from './shared.js'
import type { GeminiOAuthIdentity } from './shared.js'

export type { GeminiOAuthIdentity } from './shared.js'

/**
 * Read Gemini CLI credentials from disk and return a resolved identity.
 *
 * Steps:
 *   1. Read ~/.gemini/oauth_creds.json
 *   2. If access token is still valid → use as-is
 *   3. If expired → refresh using the refresh_token
 *   4. Resolve email + projectId via Code Assist API (or env var)
 *
 * Returns null if no Gemini CLI credentials are found on disk.
 * Throws if credentials are found but refresh/project resolution fails.
 */
export async function loadGeminiCliOAuth(
  onProgress?: (msg: string) => void,
): Promise<GeminiOAuthIdentity | null> {
  const log = onProgress ?? (() => {})

  const credFile = readGeminiCliCredFile()
  if (!credFile) {
    return null
  }

  const { access_token, refresh_token, expiry_date } = credFile

  if (!access_token || !refresh_token) {
    return null
  }

  const now = Date.now()
  const isExpired = expiry_date !== undefined && expiry_date - SAFETY_WINDOW_MS <= now

  let accessToken = access_token
  let refreshToken = refresh_token
  let expiresAt = (expiry_date ?? now + 3600 * 1000) - SAFETY_WINDOW_MS

  if (isExpired) {
    log('Gemini CLI access token expired — refreshing…')

    const clientConfig = resolveOAuthClientConfig(credFile)
    if (!clientConfig) {
      // Can't refresh without client credentials — try the existing token anyway.
      // Google tokens are sometimes still accepted briefly after expiry_date.
      log(
        'Warning: Could not find Gemini CLI OAuth client credentials for refresh. ' +
        'Attempting to continue with existing token. ' +
        'If API calls fail, run: gemini auth login',
      )
    } else {
      try {
        const refreshed = await refreshAccessToken(refreshToken, clientConfig)
        accessToken = refreshed.accessToken
        refreshToken = refreshed.refreshToken
        expiresAt = refreshed.expiresAt
        log('Token refreshed successfully.')
      } catch (err) {
        log(
          `Warning: Token refresh failed (${err instanceof Error ? err.message.split('\n')[0] : String(err)}). ` +
          'Attempting to continue with existing token.',
        )
      }
    }
  }

  // Resolve email + projectId from Code Assist API.
  // This is optional — the basic Gemini API only needs the access token.
  // If it fails (no project, free tier, network error), skip gracefully.
  let email = ''
  let projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() ?? ''
  let tier = ''

  try {
    log('Resolving Google project via Code Assist API…')
    const identity = await resolveGoogleProject(accessToken)
    email = identity.email
    projectId = identity.projectId
    tier = identity.tier
    log(`Signed in as ${identity.email} (project: ${identity.projectId}, tier: ${identity.tier})`)
  } catch (err) {
    // Code Assist API is optional — the Gemini OpenAI-compatible endpoint
    // works with just the access token. Log and continue.
    log(
      `Note: Could not resolve Google Cloud project (${err instanceof Error ? err.message.split('\n')[0] : String(err)}). ` +
      'Continuing without project info — set GOOGLE_CLOUD_PROJECT if needed.',
    )
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    email,
    projectId,
    tier,
  }
}

/**
 * Return the path where Gemini CLI stores credentials (for user-facing messages).
 */
export { getGeminiCliCredPath, resolveOAuthClientConfig } from './credentials.js'
export { refreshAccessToken } from './token.js'
