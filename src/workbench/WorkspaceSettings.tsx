import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Toggle } from "../ui";
import { Select } from "../controls";
export function WorkspaceSettings({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const s = data.settings,
    [recording, setRecording] = useState(false);
  const patch = (a: any) =>
    void api("workbench.settings", a).catch((e) => report(e.message));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workspace</h1>
          <p className="page-description">
            A familiar home for your terminal and agents.
          </p>
        </div>
      </div>
      <h3 className="group-title">Terminal</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Launch shortcut</strong>
            <p>
              A global shortcut to show or reopen Yami Terminal. Other apps'
              shortcuts are preserved.
            </p>
          </div>
          <button
            className="key-binding"
            onClick={() => {
              setRecording(true);
              void api("shortcuts.capture", { active: true });
            }}
            onBlur={() => {
              setRecording(false);
              void api("shortcuts.capture", { active: false });
            }}
            onKeyDown={(e) => {
              if (!recording) return;
              e.preventDefault();
              if (e.key === "Escape") {
                setRecording(false);
                void api("shortcuts.capture", { active: false });
                return;
              }
              if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;
              const shortcut = [
                e.ctrlKey ? "Ctrl" : "",
                e.metaKey ? "Win" : "",
                e.altKey ? "Alt" : "",
                e.shiftKey ? "Shift" : "",
                e.key === " " ? "Space" : e.key.toUpperCase(),
              ]
                .filter(Boolean)
                .join("+");
              if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                report("Use Ctrl, Win or Alt with the shortcut.");
                return;
              }
              setRecording(false);
              patch({ terminalShortcut: shortcut });
              void api("shortcuts.capture", { active: false });
            }}
          >
            {recording
              ? "Press shortcut…"
              : s.terminalShortcut || "Set shortcut"}
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Default shell</strong>
            <p>New sessions use this shell. Existing shells keep running.</p>
          </div>
          <Select
            label="Default terminal shell"
            value={s.terminalShell}
            onChange={(terminalShell) => patch({ terminalShell })}
            options={[
              { value: "auto", label: "Automatic", hint: "PowerShell 7 when installed" },
              { value: "pwsh", label: "PowerShell 7" },
              { value: "powershell", label: "Windows PowerShell" },
              { value: "cmd", label: "Command Prompt" },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Background</strong>
            <p>
              Independent of your Windows wallpaper. Uses a Yami background by
              default.
            </p>
          </div>
          <Select
            label="Terminal background"
            value={s.terminalBackground}
            onChange={(terminalBackground) => patch({ terminalBackground })}
            options={[
              { value: "yami", label: "Follow Yami", icon: "sparkle" },
              { value: "custom", label: "Custom image", icon: "image" },
              { value: "none", label: "None", icon: "prohibit" },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Custom background</strong>
            <p>
              {s.terminalImage.split(/[\\/]/).pop() ||
                "Choose a static JPG or PNG."}
            </p>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              void api("workbench.background").catch((e) => report(e.message))
            }
          >
            Choose image
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Background blur</strong>
            <p>{s.terminalBlur}px</p>
          </div>
          <input
            aria-label="Terminal background blur"
            type="range"
            min={0}
            max={30}
            value={s.terminalBlur}
            onChange={(e) => patch({ terminalBlur: Number(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Background opacity</strong>
            <p>{Math.round(s.terminalOpacity * 100)}%</p>
          </div>
          <input
            aria-label="Terminal background opacity"
            type="range"
            min={0}
            max={0.8}
            step={0.01}
            value={s.terminalOpacity}
            onChange={(e) => patch({ terminalOpacity: Number(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Scrollback</strong>
            <p>Bounded per terminal. Applies to new sessions.</p>
          </div>
          <input
            className="compact-input"
            aria-label="Terminal scrollback lines"
            type="number"
            min={100}
            max={10000}
            defaultValue={s.terminalScrollback}
            onBlur={(e) =>
              patch({ terminalScrollback: Number(e.target.value) })
            }
          />
        </div>
      </div>
      <h3 className="group-title">Agent activity</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Native Codex executable</strong>
            <p>
              {s.codexExecutable ||
                "Auto-detect the installed Codex CLI. Choose a native executable if it is not on PATH."}
            </p>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              void api("workbench.codexExecutable").catch((e) =>
                report(e.message),
              )
            }
          >
            Choose executable
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Transcript fallback</strong>
            <p>
              Optional bounded local transcript reads for clients whose hooks do
              not fire. Inferred activity is labeled; no transcript is uploaded.
            </p>
          </div>
          <Toggle
            label="Transcript fallback"
            value={s.transcriptFallback}
            onChange={(v) => patch({ transcriptFallback: v })}
          />
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Local agent relay</strong>
            <p>
              Receive events from connected CLIs. Off means no relay listener.
            </p>
          </div>
          <Toggle
            label="Local agent relay"
            value={s.monitor}
            onChange={(v) => patch({ monitor: v })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Activity retention</strong>
            <p>Local phase changes for recaps; 0 disables retention.</p>
          </div>
          <input
            aria-label="Activity retention days"
            className="compact-input"
            type="number"
            min={0}
            max={90}
            defaultValue={s.recapRetention}
            onBlur={(e) => patch({ recapRetention: Number(e.target.value) })}
          />
        </div>
      </div>
    </>
  );
}
