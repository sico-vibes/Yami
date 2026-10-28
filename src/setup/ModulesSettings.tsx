import { api } from "../api";
import { modules, type ModuleId, type PackId } from "../modules";
import { ModuleCard } from "./ModuleCard";
import { useModules } from "./use-modules";

/** Settings › Modules: switch modules and manage their downloads. */
export function ModulesSettings({
  report,
}: {
  report: (message: string) => void;
}) {
  const list = useModules(report);
  const call = (method: string, args: object) =>
    void api(method, args).catch((e) => report(e.message));
  if (!list) return <p className="setting-note">Reading modules…</p>;
  const status = (id: ModuleId) => list.find((m) => m.id === id);
  return (
    <>
      <p className="setting-note">
        A module that is off never loads, so it uses no memory, timers or
        network. Downloads are checked against pinned checksums before use.
      </p>
      <div className="module-grid">
        {modules.map((spec) => {
          const s = status(spec.id);
          return (
            <ModuleCard
              key={spec.id}
              spec={spec}
              enabled={!!s?.enabled}
              loaded={s?.loaded}
              onToggle={(enabled) =>
                call("modules.set", { id: spec.id, enabled })
              }
              packs={s?.packs}
              onPack={(action, id: PackId) => call("packs." + action, { id })}
            />
          );
        })}
      </div>
      <div className="workbench-actions">
        <button
          className="soft-button"
          onClick={() => void api("show", { tab: "setup" })}
        >
          Run setup again
        </button>
      </div>
    </>
  );
}
