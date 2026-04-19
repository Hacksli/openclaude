/**
 * Locates and reads Gemini CLI's stored OAuth credentials.
 *
 * Newer Gemini CLI versions (after the HybridTokenStorage migration) store
 * credentials in the system keychain:
 *   - Windows: Windows Credential Manager (keytar service="gemini-cli-oauth", account="main-account")
 *   - macOS: macOS Keychain
 *   - Linux: libsecret / kwallet
 *
 * Older versions (and a migration fallback) use:
 *   ~/.gemini/oauth_creds.json with shape:
 *   { access_token, refresh_token, id_token, token_type, scope, expiry_date (ms) }
 *
 * We also need the OAuth client_id/secret (for token refresh):
 *   - client_id: extracted from the id_token JWT's "azp" or "aud" field
 *   - client_secret: extracted from @google/gemini-cli npm package files
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { GeminiCliCredFile, OAuthClientConfig } from './shared.js'

function sanitize(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t || undefined
}

// ---------------------------------------------------------------------------
// Windows Credential Manager (newer Gemini CLI)
// ---------------------------------------------------------------------------

/**
 * Read a credential blob from Windows Credential Manager using PowerShell + Win32 CredRead.
 * Returns the raw string value stored as the credential's password, or null if not found.
 */
function readFromWindowsCredentialManager(service: string, account: string): string | null {
  if (process.platform !== 'win32') return null
  const target = `${service}/${account}`
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    // Minimal PowerShell script that calls Win32 CredRead via P/Invoke.
    // -NoProfile -NonInteractive: minimize startup time.
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCredRead {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL {
        public uint Flags; public uint Type; public string TargetName; public string Comment;
        public long LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob;
        public uint Persist; public uint AttributeCount; public IntPtr Attributes;
        public string TargetAlias; public string UserName;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr pCred);
    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr cred);
    public static string Read(string target) {
        IntPtr pCred;
        if (!CredRead(target, 1, 0, out pCred)) return "";
        try {
            var cred = (CREDENTIAL)Marshal.PtrToStructure(pCred, typeof(CREDENTIAL));
            if (cred.CredentialBlobSize == 0) return "";
            byte[] blob = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, blob, 0, blob.Length);
            return Encoding.Unicode.GetString(blob);
        } finally { CredFree(pCred); }
    }
}
"@
[WinCredRead]::Read("${target.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")
`
    const result = execFileSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', script,
    ], {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return result || null
  } catch {
    return null
  }
}

/**
 * Parse credential data stored by Gemini CLI into our normalized GeminiCliCredFile format.
 *
 * Handles two formats:
 *
 * 1. Older format — oauth_creds.json / google-auth-library Credentials (snake_case, flat):
 *    { access_token, refresh_token, expiry_date, id_token, token_type, scope }
 *
 * 2. Newer keychain format — OAuthCredentials (camelCase, nested):
 *    { serverName, token: { accessToken, refreshToken, expiresAt, tokenType, scope },
 *      clientId, tokenUrl, updatedAt }
 */
function parseCredentialBlob(raw: string): GeminiCliCredFile | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return null

    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined
    const num = (v: unknown): number | undefined =>
      typeof v === 'number' && isFinite(v) ? v
      : typeof v === 'string' && v ? (Number(v) || undefined)
      : undefined

    // Newer format: credentials are nested under "token" object
    const token = obj.token && typeof obj.token === 'object'
      ? obj.token as Record<string, unknown>
      : null

    const cred: GeminiCliCredFile = token
      ? {
          // Newer format — unwrap nested token object
          access_token: str(token.accessToken),
          refresh_token: str(token.refreshToken),
          token_type: str(token.tokenType),
          scope: str(token.scope),
          expiry_date: num(token.expiresAt),
          // clientId stored at top level (not inside token)
          clientId: str(obj.clientId),
          // id_token not present in newer keychain format
        }
      : {
          // Older format — flat snake_case fields from oauth_creds.json
          access_token: str(obj.access_token),
          refresh_token: str(obj.refresh_token),
          id_token: str(obj.id_token),
          token_type: str(obj.token_type),
          scope: str(obj.scope),
          expiry_date: num(obj.expiry_date),
        }

    return cred.access_token || cred.refresh_token ? cred : null
  } catch {
    return null
  }
}

/**
 * Try to read Gemini CLI credentials from the system keychain (Windows Credential Manager).
 * Newer Gemini CLI versions store credentials here instead of oauth_creds.json.
 */
function readGeminiCliCredFromKeychain(): GeminiCliCredFile | null {
  if (process.platform === 'win32') {
    const raw = readFromWindowsCredentialManager('gemini-cli-oauth', 'main-account')
    if (raw) return parseCredentialBlob(raw)
  }
  // macOS / Linux keychain reading would go here if needed in the future.
  return null
}

// ---------------------------------------------------------------------------
// Gemini CLI credential file (legacy / fallback)
// ---------------------------------------------------------------------------

/** Returns the path to the Gemini CLI oauth_creds.json file. */
export function getGeminiCliCredPath(): string {
  return join(homedir(), '.gemini', 'oauth_creds.json')
}

/**
 * Read Gemini CLI OAuth credentials from all available sources.
 *
 * Priority:
 *   1. Windows Credential Manager / system keychain (newer Gemini CLI ≥ HybridTokenStorage)
 *   2. ~/.gemini/oauth_creds.json (older Gemini CLI / migration fallback)
 *
 * Returns null if no credentials are found in any source.
 */
export function readGeminiCliCredFile(): GeminiCliCredFile | null {
  // 1. Try system keychain first (newer Gemini CLI stores credentials here after migration)
  const keychainCred = readGeminiCliCredFromKeychain()
  if (keychainCred) return keychainCred

  // 2. Fall back to the JSON file (older Gemini CLI / non-Windows platforms)
  const filePath = getGeminiCliCredPath()
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as GeminiCliCredFile
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Extract client_id from id_token JWT (no signature verification needed)
// ---------------------------------------------------------------------------

function extractClientIdFromIdToken(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined
  try {
    const parts = idToken.split('.')
    if (parts.length < 2) return undefined
    const raw = parts[1]
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>
    // azp = authorized party (the OAuth client that requested the token)
    const azp = typeof payload.azp === 'string' ? payload.azp.trim() : undefined
    if (azp && azp.endsWith('.apps.googleusercontent.com')) return azp
    // aud as fallback
    const aud = typeof payload.aud === 'string' ? payload.aud.trim() : undefined
    if (aud && aud.endsWith('.apps.googleusercontent.com')) return aud
  } catch {
    // ignore
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Find @google/gemini-cli-core in npm global / common locations
// ---------------------------------------------------------------------------

function findFiles(dir: string, predicate: (name: string) => boolean, maxDepth = 5): string[] {
  if (maxDepth <= 0 || !existsSync(dir)) return []
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      try {
        const st = statSync(full)
        if (st.isDirectory()) {
          results.push(...findFiles(full, predicate, maxDepth - 1))
        } else if (st.isFile() && predicate(entry)) {
          results.push(full)
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return results
}

function extractClientSecretFromSource(source: string): string | undefined {
  const m = source.match(/(GOCSPX-[A-Za-z0-9_-]+)/)
  return m?.[1]
}

/** Returns candidate npm global node_modules directories to search. */
function candidateNpmGlobalDirs(): string[] {
  const dirs: string[] = []

  // Windows: %APPDATA%\npm\node_modules
  const appData = process.env.APPDATA
  if (appData) {
    dirs.push(join(appData, 'npm', 'node_modules'))
  }

  // Windows: %LOCALAPPDATA%\npm\node_modules
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    dirs.push(join(localAppData, 'npm', 'node_modules'))
  }

  // Unix common paths
  dirs.push(
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    join(homedir(), '.npm-global', 'lib', 'node_modules'),
    join(homedir(), '.local', 'lib', 'node_modules'),
  )

  // Try npm root -g
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const npmRoot = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (npmRoot) dirs.push(npmRoot)
  } catch {
    // npm not available or failed
  }

  // Try to find from `where gemini` / `which gemini`
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const binResult = execFileSync(cmd, ['gemini'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const binPath = binResult.split('\n')[0]?.trim()
    if (binPath) {
      // Walk up from bin directory looking for node_modules
      let d = dirname(binPath)
      for (let i = 0; i < 6; i++) {
        dirs.push(join(d, 'node_modules'))
        const parent = dirname(d)
        if (parent === d) break
        d = parent
      }
    }
  } catch {
    // not found
  }

  return dirs
}

function findClientSecretInDirs(dirs: string[]): string | undefined {
  // Try in order: @google/gemini-cli/bundle (newer bundled layout),
  // then @google/gemini-cli-core/dist (older separate package layout).
  const searchPaths: Array<{ dir: string; predicate: (n: string) => boolean; depth: number }> = []

  for (const dir of dirs) {
    // Newer: bundled into @google/gemini-cli/bundle — any .js chunk file
    searchPaths.push({
      dir: join(dir, '@google', 'gemini-cli', 'bundle'),
      predicate: (n: string) => n.endsWith('.js'),
      depth: 1,
    })
    // Older: separate @google/gemini-cli-core/dist/oauth2.js
    searchPaths.push({
      dir: join(dir, '@google', 'gemini-cli-core', 'dist'),
      predicate: (n: string) => n.endsWith('.js'),
      depth: 5,
    })
  }

  for (const { dir, predicate, depth } of searchPaths) {
    if (!existsSync(dir)) continue
    const candidates = findFiles(dir, predicate, depth)
    for (const file of candidates) {
      try {
        const src = readFileSync(file, 'utf8')
        const secret = extractClientSecretFromSource(src)
        if (secret) return secret
      } catch {
        // skip
      }
    }
  }
  return undefined
}

function extractGeminiCliCredentials(credFile: GeminiCliCredFile | null): OAuthClientConfig | null {
  // Prefer clientId stored directly in the credential (newer keychain format).
  // Fall back to extracting from id_token JWT azp field (older oauth_creds.json format).
  const clientId =
    credFile?.clientId?.trim() ||
    extractClientIdFromIdToken(credFile?.id_token)
  if (!clientId) return null

  // Find client_secret from npm global @google/gemini-cli bundle files
  const clientSecret = findClientSecretInDirs(candidateNpmGlobalDirs())
  if (!clientSecret) return null

  return { clientId, clientSecret }
}

/**
 * Resolve Gemini CLI OAuth client credentials (needed for token refresh).
 *
 * Priority:
 *   1. OPENCLAUDE_GEMINI_OAUTH_CLIENT_ID / OPENCLAUDE_GEMINI_OAUTH_CLIENT_SECRET
 *   2. GEMINI_CLI_OAUTH_CLIENT_ID / GEMINI_CLI_OAUTH_CLIENT_SECRET
 *   3. client_id from id_token JWT + client_secret from gemini-cli-core npm package
 */
export function resolveOAuthClientConfig(credFile?: GeminiCliCredFile | null): OAuthClientConfig | null {
  const envClientId =
    sanitize(process.env.OPENCLAUDE_GEMINI_OAUTH_CLIENT_ID) ??
    sanitize(process.env.GEMINI_CLI_OAUTH_CLIENT_ID)
  const envClientSecret =
    sanitize(process.env.OPENCLAUDE_GEMINI_OAUTH_CLIENT_SECRET) ??
    sanitize(process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET)

  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret }
  }

  return extractGeminiCliCredentials(credFile ?? null)
}
