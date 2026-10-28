import { useEffect, useState } from "react";
import { frames, revealFrame } from "./ascii-reveal";

// A loading state for lazy screens: a short line of drifting glyphs that
// resolves into the label, once. It runs at about 30 frames a second for at
// most 0.7 s and then stops; with reduced motion it shows the label at once.
// (After the idea in quanhoangindex/ascii-reveal; written for Yami.)

function reduced() {
  return (
    document.documentElement.dataset.reduced === "true" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AsciiSkeleton({ label }: { label: string }) {
  const [frame, setFrame] = useState(() => (reduced() ? frames : 0));
  useEffect(() => {
    if (frame >= frames) return;
    const id = setTimeout(() => setFrame((f) => f + 1), 33);
    return () => clearTimeout(id);
  }, [frame]);
  return (
    <p className="ascii-skeleton" role="status" aria-label={label}>
      <span aria-hidden="true">{revealFrame(label, frame)}</span>
    </p>
  );
}
