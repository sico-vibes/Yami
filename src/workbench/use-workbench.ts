import { useEffect, useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
export function useWorkbench(report: (text: string) => void) {
  const [data, setData] = useState<WorkbenchState | null>(null);
  useEffect(() => {
    let alive = true;
    api("workbench.state")
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e) => report(e.message));
    const remove = window.yami.on((e) => {
      if (e.type === "workbench-state") setData(e.state);
    });
    return () => {
      alive = false;
      remove();
    };
  }, []);
  return data;
}
