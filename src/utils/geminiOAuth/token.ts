/**
 * OAuth access token refresh using a stored refresh_token.
 */

import { SAFETY_WINDOW_MS, TOKEN_URL } from './shared.js'
import type { OAuthClientConfig } from './shared.js'

type RawTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  error?: string
  error_description?: string
}

async function postToTokenEndpoint(body: URLSearchParams): Promise<RawTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'google-api-nodejs-client/9.15.1',
      Accept: '*/*',
    },
    body: body.toString(),
  })

  const data = (await response.json()) as RawTokenResponse

  if (!response.ok || data.error) {
    const detail = data.error_description ?? data.error ?? response.statusText
    throw new Error(`Token refresh failed (${response.status}): ${detail}`)
  }

  return data
}

/**
 * Refresh an access token using a stored refresh_token.
 * Returns the new access_token, updated expiry, and possibly a new refresh_token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthClientConfig,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const data = await postToTokenEndpoint(body)

  return {
    accessToken: data.access_token,
    // Google may rotate the refresh token on some events — persist the new one if returned.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000 - SAFETY_WINDOW_MS,
  }
}
