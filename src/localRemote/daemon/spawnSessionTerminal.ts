/**
 * Spawn a new, visible terminal window running `openclaude` in a fresh
 * session. Invoked by the daemon when a browser client requests
 * `new_session`. Platform-specific: uses `cmd /c start` on Windows,
 * `osascript` → Terminal.app on macOS, and `x-terminal-emulator` on Linux.
 *
 * Fire-and-forget: we detach + unref the spawn handle so the child outlives
 * the daemon process. The newly-spawned openclaude worker will connect back
 * to this daemon over the standard /remote bridge and appear in the session
 * list automatically — no further IPC is needed.
 */

import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { logForDebugging } from '../../utils/debug.js'

export type SpawnResult =
  | { ok: true }
  | { ok: false; error: string }

export function spawnSessionTerminal(opts?: { cwd?: string }): SpawnResult {
  const cwd = opts?.cwd && opts.cwd.trim() ? opts.cwd : homedir()
  const platform = process.platform

  // Сесія, спавнена з веб-інтерфейсу, має одразу:
  //   1) обійти стартовий model-picker (він — TUI-only, браузер його не
  //      побачить і користувач не зможе вибрати модель → відбере остання
  //      збережена);
  //   2) автоматично підняти /remote on, щоб нова сесія з'явилась
  //      у списку у браузері без додаткових дій користувача.
  const envForChild: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CODE_SKIP_MODEL_PICKER: '1',
    OPENCLAUDE_REMOTE_ON: '1',
  }

  try {
    if (platform === 'win32') {
      // `start "" cmd /k openclaude` opens a new cmd window that stays open
      // after openclaude exits (/k). The empty "" is the window title —
      // required by `start` because it otherwise treats the next quoted
      // token as the title.
      const child = spawn(
        'cmd.exe',
        ['/c', 'start', '', 'cmd.exe', '/k', 'openclaude'],
        {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
          env: envForChild,
        },
      )
      child.unref()
      logForDebugging(`[spawnSessionTerminal] spawned cmd window in ${cwd}`)
      return { ok: true }
    }

    if (platform === 'darwin') {
      // Escape backslashes and double quotes for the AppleScript literal.
      const escapedCwd = cwd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      // `env FOO=1 BAR=1 openclaude` передає змінні, бо AppleScript
      // do-script запускає окремий shell, який не успадковує env дочірнього
      // процесу osascript.
      const script = `tell application "Terminal" to do script "cd \\"${escapedCwd}\\" && env CLAUDE_CODE_SKIP_MODEL_PICKER=1 OPENCLAUDE_REMOTE_ON=1 openclaude"`
      const child = spawn('osascript', ['-e', script], {
        detached: true,
        stdio: 'ignore',
        env: envForChild,
      })
      child.unref()
      logForDebugging(`[spawnSessionTerminal] spawned Terminal.app in ${cwd}`)
      return { ok: true }
    }

    // Linux / other: try x-terminal-emulator (Debian alternatives system),
    // which on most desktops resolves to the user's preferred terminal.
    const child = spawn(
      'x-terminal-emulator',
      ['-e', 'openclaude'],
      {
        cwd,
        detached: true,
        stdio: 'ignore',
        env: envForChild,
      },
    )
    child.unref()
    logForDebugging(`[spawnSessionTerminal] spawned x-terminal-emulator in ${cwd}`)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logForDebugging(`[spawnSessionTerminal] failed: ${msg}`)
    return { ok: false, error: msg }
  }
}
