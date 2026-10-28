import path from "node:path";

// Shell integration for tabs Yami opens: each prompt reports the folder
// (OSC 7) and marks where the prompt starts and ends and how the previous
// command exited (OSC 133, the FinalTerm marks VS Code and Windows Terminal
// read). It wraps the user's own prompt instead of replacing it.

const powershellPrompt = String.raw`
$Global:__YamiPrompt = $function:prompt
$Global:__YamiHistory = -1
function Global:prompt {
  $ok = $global:?
  $code = $Global:LASTEXITCODE
  $e = [char]27; $b = [char]7
  $last = Get-History -Count 1
  $id = if ($last) { $last.Id } else { 0 }
  $out = ''
  if ($Global:__YamiHistory -ge 0) {
    if ($id -ne $Global:__YamiHistory) {
      $exit = if ($ok) { 0 } elseif ($code) { $code } else { 1 }
      $out += "$e]133;D;$exit$b"
    } else { $out += "$e]133;D$b" }
  }
  $Global:__YamiHistory = $id
  $here = $ExecutionContext.SessionState.Path.CurrentLocation
  if ($here.Provider.Name -eq 'FileSystem') {
    $out += "$e]7;file://localhost/$($here.ProviderPath -replace '\\', '/')$b"
  }
  $out += "$e]133;A$b"
  $out += & $Global:__YamiPrompt
  $Global:LASTEXITCODE = $code
  "$out$e]133;B$b"
}
`;

const bashPromptCommand = String.raw`__yami_rc=$?; printf '\033]133;D;%s\007\033]7;file://localhost/%s\007\033]133;A\007' "$__yami_rc" "$(pwd -W 2>/dev/null || pwd)"`;

/** The arguments and extra environment that start `shell` with the marks. */
export function integratedLaunch(
  shell: string,
  enabled: boolean,
  env: NodeJS.ProcessEnv = process.env,
): { args: string[]; env: Record<string, string> } {
  const name = path.basename(shell).toLowerCase();
  if (/^(pwsh|powershell)\.exe$/.test(name))
    return enabled
      ? {
          args: [
            "-NoLogo",
            "-NoExit",
            "-EncodedCommand",
            Buffer.from(powershellPrompt, "utf16le").toString("base64"),
          ],
          env: {},
        }
      : { args: ["-NoLogo"], env: {} };
  if (name === "bash.exe")
    return {
      args: ["--login", "-i"],
      env: enabled ? { PROMPT_COMMAND: bashPromptCommand } : {},
    };
  if (name === "cmd.exe" && enabled)
    return {
      args: [],
      env: {
        PROMPT:
          "$e]133;D$e\\$e]7;$P$e\\$e]133;A$e\\" +
          (env.PROMPT || "$P$G") +
          "$e]133;B$e\\",
      },
    };
  return { args: [], env: {} };
}

/** Exposed for the tests, which run the prompt through PowerShell. */
export const integrationScripts = { powershellPrompt, bashPromptCommand };
