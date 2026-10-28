import { useState } from "react";
import { bytes } from "../api";
import { Meter } from "../controls";
import {
  packLabels,
  type ModuleCost,
  type ModulePermission,
  type ModuleSpec,
  type PackId,
  type PackStatus,
} from "../modules";
import { Icon, Toggle } from "../ui";

export type PackCommand = "install" | "cancel" | "remove" | "installFile";

const costLabel: Record<ModuleCost, string> = {
  low: "Light",
  medium: "Some background work",
  high: "Heavy",
};
const permission: Record<ModulePermission, [string, string]> = {
  network: ["globe-simple", "Uses the internet"],
  microphone: ["microphone", "Uses the microphone"],
  screen: ["monitor", "Reads the screen"],
  clipboard: ["clipboard-text", "Reads copied text"],
  admin: ["shield-warning", "Asks for administrator approval"],
  files: ["folder", "Works with files you choose"],
};

/**
 * One module as a card. Setup passes `chosen` packs to queue; Settings passes
 * live pack statuses and actions.
 */
export function ModuleCard({
  spec,
  enabled,
  loaded,
  onToggle,
  packs,
  chosen,
  onChoose,
  onPack,
}: {
  spec: ModuleSpec;
  enabled: boolean;
  loaded?: boolean;
  onToggle: (value: boolean) => void;
  packs?: PackStatus[];
  chosen?: PackId[];
  onChoose?: (id: PackId, value: boolean) => void;
  onPack?: (action: PackCommand, id: PackId) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = (id: PackId) => packs?.find((p) => p.id === id);
  return (
    <section className={`module-card${enabled ? " on" : ""}`}>
      <header className="entry-head">
        <span className="entry-icon">
          <Icon name={spec.icon} />
        </span>
        <div className="entry-heading">
          <strong>{spec.name}</strong>
          <small>
            {costLabel[spec.cost]}
            {loaded !== undefined && enabled
              ? loaded
                ? " · Awake"
                : " · Asleep until used"
              : ""}
          </small>
        </div>
        <Toggle
          label={`${spec.name} module`}
          value={enabled}
          onChange={onToggle}
        />
      </header>
      <p className="module-blurb">{spec.blurb}</p>
      {!!spec.permissions.length && (
        <div className="module-perms">
          {spec.permissions.map((p) => (
            <span key={p} className="value-pill">
              <Icon name={permission[p][0]} size={13} />
              {permission[p][1]}
            </span>
          ))}
        </div>
      )}
      {!!spec.packs.length && (
        <div className="module-packs">
          <button
            type="button"
            className="text-button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "caret-up" : "caret-down"} size={14} />
            Optional downloads ({spec.packs.length})
          </button>
          {open && (
            <ul>
              {spec.packs.map((id) => {
                const s = status(id);
                return (
                  <li key={id}>
                    <div className="pack-name">
                      <span>{packLabels[id]}</span>
                      <small>
                        {s?.bytes ? bytes(s.bytes) + " · " : ""}
                        {s?.state === "installed"
                          ? "Installed"
                          : s?.state === "failed"
                            ? s.error || "Download failed"
                            : s?.state === "downloading"
                              ? "Downloading"
                              : s?.state === "queued"
                                ? "Waiting to download"
                                : "Downloads the first time you need it"}
                      </small>
                      {s?.state === "downloading" && s.bytes ? (
                        <Meter
                          value={(s.received || 0) / s.bytes}
                          label={`${packLabels[id]} downloaded`}
                        />
                      ) : null}
                    </div>
                    {onChoose && s?.state === "installed" ? (
                      <Icon
                        name="check-circle"
                        size={20}
                        className="pack-ready"
                      />
                    ) : onChoose ? (
                      <Toggle
                        label={`Download ${packLabels[id]} now`}
                        value={!!chosen?.includes(id)}
                        disabled={!enabled}
                        onChange={(value) => onChoose(id, value)}
                      />
                    ) : (
                      onPack && (
                        <PackAction state={s?.state} id={id} onPack={onPack} />
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function PackAction({
  state,
  id,
  onPack,
}: {
  state?: PackStatus["state"];
  id: PackId;
  onPack: (action: PackCommand, id: PackId) => void;
}) {
  if (state === "installed")
    return (
      <button className="text-button" onClick={() => onPack("remove", id)}>
        Remove
      </button>
    );
  if (state === "downloading" || state === "queued")
    return (
      <button className="text-button" onClick={() => onPack("cancel", id)}>
        Cancel
      </button>
    );
  return (
    <span className="pack-actions">
      <button
        className="text-button"
        aria-label={`Install ${packLabels[id]} from a file`}
        data-tip="Use a file you downloaded yourself. It must match the pinned checksum."
        onClick={() => onPack("installFile", id)}
      >
        From file
      </button>
      <button className="soft-button" onClick={() => onPack("install", id)}>
        <Icon name="download-simple" size={14} />
        {state === "failed" ? "Try again" : "Download"}
      </button>
    </span>
  );
}
