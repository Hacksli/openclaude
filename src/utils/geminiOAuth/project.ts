/**
 * Google Code Assist API: resolves user email and projectId via loadCodeAssist / onboardUser.
 * Used once after first login (or when projectId is unknown) to populate the stored credentials.
 */

import { CODE_ASSIST_ENDPOINTS, TIER_FREE, TIER_STANDARD, USERINFO_URL } from './shared.js'

type UserInfo = { email: string }

type LoadCodeAssistResponse = {
  currentTier?: { id: string }
  allowedTiers?: Array<{ id: string; isDefault?: boolean }>
  cloudaicompanionProject?: string | { id: string }
}

type LroResponse = {
  done?: boolean
  name?: string
  response?: {
    cloudaicompanionProject?: string | { id: string }
  }
  error?: { message?: string }
}

const USER_AGENT = 'google-api-nodejs-client/9.15.1'

function getPlatformStr(): string {
  switch (process.platform) {
    case 'darwin': return 'MACOS'
    case 'win32': return 'WINDOWS'
    default: return 'PLATFORM_UNSPECIFIED'
  }
}

function clientMetadata(): string {
  return JSON.stringify({
    ideType: 'ANTIGRAVITY',
    platform: getPlatformStr(),
    pluginType: 'GEMINI',
  })
}

function codeAssistHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'X-Goog-Api-Client': `gl-node/${process.versions.node}`,
    'Client-Metadata': clientMetadata(),
  }
}

async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch user info (${res.status})`)
  }
  const data = (await res.json()) as UserInfo
  return data.email
}

async function pollLro(
  endpoint: string,
  operationName: string,
  accessToken: string,
): Promise<LroResponse> {
  const maxAttempts = 24
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    try {
      const res = await fetch(`${endpoint}/v1internal/${operationName}`, {
        headers: codeAssistHeaders(accessToken),
      })
      if (!res.ok) continue
      const data = (await res.json()) as LroResponse
      if (data.done) return data
    } catch {
      // continue polling
    }
  }
  throw new Error(
    'Onboarding timed out. Set the GOOGLE_CLOUD_PROJECT env var and try again.',
  )
}

function extractProjectId(
  project: string | { id: string } | undefined,
): string | undefined {
  if (!project) return undefined
  if (typeof project === 'string') return project.trim() || undefined
  return project.id?.trim() || undefined
}

/**
 * Resolve the user's email, projectId, and tier via the Code Assist API.
 * Tries prod → daily → autopush endpoints. Falls back to GOOGLE_CLOUD_PROJECT env var.
 */
export async function resolveGoogleProject(
  accessToken: string,
): Promise<{ email: string; projectId: string; tier: string }> {
  const email = await getUserEmail(accessToken)

  const envProject =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
    undefined

  const headers = codeAssistHeaders(accessToken)
  const loadBody = JSON.stringify({
    cloudaicompanionProject: envProject ?? '',
    metadata: {
      ideType: 'ANTIGRAVITY',
      platform: getPlatformStr(),
      pluginType: 'GEMINI',
      duetProject: envProject ?? '',
    },
  })

  let loadResponse: LoadCodeAssistResponse | null = null
  let workingEndpoint: string | null = null

  for (const endpoint of CODE_ASSIST_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers,
        body: loadBody,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        if (
          text.includes('SECURITY_POLICY_VIOLATED') ||
          text.includes('VPC_SERVICE_CONTROLS')
        ) {
          // VPC-SC environment — treat as standard tier, use env project
          return {
            email,
            projectId: envProject ?? '',
            tier: TIER_STANDARD,
          }
        }
        continue
      }

      loadResponse = (await res.json()) as LoadCodeAssistResponse
      workingEndpoint = endpoint
      break
    } catch {
      continue
    }
  }

  if (!loadResponse || !workingEndpoint) {
    // All endpoints failed — fall back to env project
    if (envProject) {
      return { email, projectId: envProject, tier: TIER_STANDARD }
    }
    throw new Error(
      'Failed to connect to Google Code Assist API.\n' +
        'Set the GOOGLE_CLOUD_PROJECT env var or ensure network access to Google APIs.',
    )
  }

  // Already onboarded
  if (loadResponse.currentTier) {
    const projectId =
      extractProjectId(loadResponse.cloudaicompanionProject) ?? envProject
    if (!projectId) {
      throw new Error(
        'Could not determine Google Cloud project ID.\n' +
          'Set the GOOGLE_CLOUD_PROJECT env var.',
      )
    }
    return { email, projectId, tier: loadResponse.currentTier.id }
  }

  // Need onboarding
  const allowedTiers = loadResponse.allowedTiers ?? []
  let tier: string
  if (allowedTiers.length === 0) {
    tier = TIER_FREE
  } else {
    tier = allowedTiers.find(t => t.isDefault)?.id ?? allowedTiers[0]?.id ?? TIER_FREE
  }

  if (tier !== TIER_FREE && !envProject) {
    throw new Error(
      `Your account tier (${tier}) requires a Google Cloud project.\n` +
        'Set the GOOGLE_CLOUD_PROJECT env var.',
    )
  }

  const onboardBody = JSON.stringify({
    tierId: tier,
    metadata: {
      ideType: 'ANTIGRAVITY',
      platform: getPlatformStr(),
      pluginType: 'GEMINI',
    },
    ...(envProject
      ? { cloudaicompanionProject: envProject, duetProject: envProject }
      : {}),
  })

  const onboardRes = await fetch(`${workingEndpoint}/v1internal:onboardUser`, {
    method: 'POST',
    headers,
    body: onboardBody,
  })

  if (!onboardRes.ok) {
    const text = await onboardRes.text().catch(() => '')
    throw new Error(`Onboarding failed (${onboardRes.status}): ${text}`)
  }

  const onboardData = (await onboardRes.json()) as LroResponse

  let finalData = onboardData
  if (!onboardData.done && onboardData.name) {
    finalData = await pollLro(workingEndpoint, onboardData.name, accessToken)
  }

  const projectId =
    extractProjectId(finalData.response?.cloudaicompanionProject) ?? envProject

  if (!projectId) {
    throw new Error(
      'Onboarding succeeded but no project ID was returned.\n' +
        'Set the GOOGLE_CLOUD_PROJECT env var.',
    )
  }

  return { email, projectId, tier }
}
