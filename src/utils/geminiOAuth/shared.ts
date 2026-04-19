/** Constants and types for Gemini CLI OAuth (subscription-based auth). */

export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json'

/** Code Assist API endpoints — tried in order: prod → daily → autopush. */
export const CODE_ASSIST_ENDPOINTS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://autopush-cloudcode-pa.sandbox.googleapis.com',
]

export const TIER_FREE = 'free-tier'
export const TIER_LEGACY = 'legacy-tier'
export const TIER_STANDARD = 'standard-tier'

/** Safety window: refresh 5 minutes before actual expiry. */
export const SAFETY_WINDOW_MS = 5 * 60 * 1000

export type OAuthClientConfig = {
  clientId: string
  clientSecret: string
}

/**
 * Normalized credential shape used internally, regardless of source.
 *
 * Sources:
 *   - ~/.gemini/oauth_creds.json (older Gemini CLI, snake_case, google-auth-library format)
 *   - Windows Credential Manager (newer Gemini CLI, nested { token: { accessToken, ... }, clientId })
 */
export type GeminiCliCredFile = {
  access_token?: string
  refresh_token?: string
  /** JWT — contains azp/aud fields with the OAuth client_id (older format). */
  id_token?: string
  token_type?: string
  scope?: string
  expiry_date?: number // ms timestamp (same unit as Date.now())
  /**
   * OAuth client_id — available directly in newer Gemini CLI keychain format.
   * When present, used instead of extracting from id_token.azp.
   */
  clientId?: string
}

export type GeminiOAuthIdentity = {
  accessToken: string
  refreshToken: string
  /** Expiry timestamp in ms (already adjusted with 5-min safety window). */
  expiresAt: number
  /** May be empty if Code Assist API was unreachable. */
  email: string
  /** May be empty if Code Assist API was unreachable or user has no project. */
  projectId: string
  /** May be empty if Code Assist API was unreachable. */
  tier: string
}
