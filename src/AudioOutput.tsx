import { useEffect, useState } from "react";
import { api } from "./api";
import { Select } from "./controls";

type Output = { id: string; name: string; isDefault: boolean };

/** Controls card: which speakers or headphones Windows plays through. */
export function AudioOutput({ report }: { report: (m: string) => void }) {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("audio.outputs")
      .then(setOutputs)
      .catch(() => {});
  }, []);
  // One device has nothing to choose between.
  if (outputs.length < 2) return null;
  return (
    <div className="audio-output">
      <Select
        label="Play sound through"
        value={outputs.find((o) => o.isDefault)?.id || ""}
        onChange={(id) =>
          void api("audio.output", { id }).then(setOutputs).catch(fail)
        }
        options={outputs.map((o) => ({
          value: o.id,
          label: o.name,
          icon: /head|ear|buds/i.test(o.name) ? "headphones" : "speaker-high",
        }))}
      />
    </div>
  );
}
