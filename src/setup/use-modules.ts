import { useEffect, useState } from "react";
import { api } from "../api";
import type { ModuleStatus } from "../modules";

/** Live module and pack status from the main process. */
export function useModules(report: (message: string) => void) {
  const [list, setList] = useState<ModuleStatus[] | null>(null);
  useEffect(() => {
    let alive = true;
    void api("modules.list")
      .then((next: ModuleStatus[]) => alive && setList(next))
      .catch((e) => report(e.message));
    const off = window.yami.on((event) => {
      if (event.type === "modules") setList(event.modules);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return list;
}
