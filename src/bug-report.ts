// Where bug reports go: a new issue on Yami's GitHub repository, with the
// bug template and the name of the report file to attach.
export const repoUrl = "https://github.com/sico-vibes/Yami";

export function bugReportUrl(reportFile: string) {
  const body = [
    "**What happened**",
    "",
    "**What you expected**",
    "",
    "**Steps to reproduce**",
    "1. ",
    "",
    `Report file: attach \`${reportFile}\` (Settings › Your data › Collect logs).`,
  ].join("\n");
  return `${repoUrl}/issues/new?labels=bug&body=${encodeURIComponent(body)}`;
}
