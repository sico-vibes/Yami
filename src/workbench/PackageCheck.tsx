import { useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";

type Report = {
  packages: number;
  findings: { name: string; version: string; ids: string[] }[];
  details: Record<string, string>;
  checkedAt: number;
};

/**
 * A project's npm packages checked against OSV.dev's open vulnerability
 * database, on request. Only names and versions from package-lock.json go
 * out; nothing is installed or changed.
 */
export function PackageCheck({
  id,
  name,
  report,
}: {
  id: string;
  name: string;
  report: (m: string) => void;
}) {
  const [result, setResult] = useState<Report | null>(null),
    [busy, setBusy] = useState(false);
  const check = () => {
    setBusy(true);
    void api("dev.osv", { id })
      .then(setResult)
      .catch((e) => report(e.message))
      .finally(() => setBusy(false));
  };
  const open = (advisory: string) =>
    void api("open.external", {
      url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory)}`,
    }).catch((e) => report(e.message));
  return (
    <>
      <button
        className="text-button"
        disabled={busy}
        onClick={check}
        aria-label={`Check ${name}'s packages for known vulnerabilities`}
      >
        <Icon name="shield-check" size={16} />
        {busy ? "Checking…" : "Check packages"}
      </button>
      {result && (
        <div className="package-check" role="status">
          <p>
            {result.findings.length
              ? `${result.findings.length} of ${result.packages} packages have known advisories (OSV.dev).`
              : `No known advisories in ${result.packages} packages (OSV.dev).`}
          </p>
          {result.findings.slice(0, 12).map((f) => (
            <div className="package-finding" key={`${f.name}@${f.version}`}>
              <b>
                {f.name} {f.version}
              </b>
              <span>{result.details[f.ids[0]] || ""}</span>
              <span className="package-ids">
                {f.ids.slice(0, 4).map((advisory) => (
                  <button
                    key={advisory}
                    className="text-button"
                    onClick={() => open(advisory)}
                  >
                    {advisory}
                  </button>
                ))}
                {f.ids.length > 4 && <small>+{f.ids.length - 4} more</small>}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
