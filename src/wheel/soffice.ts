export function sofficeArgs(input: string, outdir: string, target: string) {
  const format =
    target === "jpg" || target === "jpeg"
      ? "jpg"
      : target === "png"
        ? "png"
        : "pdf";
  if (format === "pdf" && target !== "pdf")
    throw new Error("LibreOffice is only used here for PDF, PNG, and JPG.");
  return [
    "--headless",
    "--norestore",
    "--convert-to",
    format,
    "--outdir",
    outdir,
    input,
  ];
}

export function sofficeCandidates() {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
  ].filter(Boolean) as string[];
  return [
    ...roots.map((root) => `${root}\\LibreOffice\\program\\soffice.exe`),
    "soffice",
    "soffice.exe",
  ];
}
