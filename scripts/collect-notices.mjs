import fs from "node:fs";
import path from "node:path";
const project = process.cwd(),
  output = path.resolve("Documentation/assets/third-party");
fs.mkdirSync(output, { recursive: true });
const root = JSON.parse(fs.readFileSync("package.json", "utf8"));
const visited = new Set(),
  inventory = [];
function resolvePackage(name, from) {
  let dir = from;
  while (true) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw Error(`Cannot resolve ${name}`);
    dir = parent;
  }
}
function visit(name, from) {
  const dir = resolvePackage(name, from);
  if (visited.has(dir)) return;
  visited.add(dir);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8"),
  );
  const id = `${pkg.name.replaceAll("/", "__").replaceAll("@", "")}-${pkg.version}`;
  const folder = path.join(output, id);
  fs.mkdirSync(folder, { recursive: true });
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        /^(licen[cs]e|copying|notice|ofl)(\.|-|$)/i.test(f) &&
        fs.statSync(path.join(dir, f)).isFile(),
    );
  if (!files.length && fs.existsSync(path.join(dir, "README.md")))
    files.push("README.md");
  const notices = [];
  for (const file of files) {
    const content = fs
      .readFileSync(path.join(dir, file), "utf8")
      .replace(/\r\n/g, "\n");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 900) {
      const target =
        lines.length > 900
          ? `${file}.part-${Math.floor(i / 900) + 1}.txt`
          : `${file}.txt`;
      fs.writeFileSync(
        path.join(folder, target),
        lines.slice(i, i + 900).join("\n"),
      );
      notices.push(`${id}/${target}`);
    }
  }
  inventory.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license || "See upstream terms",
    repository:
      typeof pkg.repository === "object" ? pkg.repository.url : pkg.repository,
    notices,
    missingNotice: !files.length,
  });
  for (const dependency of Object.keys(pkg.dependencies || {}))
    visit(dependency, dir);
}
for (const name of Object.keys(root.dependencies || {})) visit(name, project);
inventory.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(
  path.join(output, "inventory.json"),
  JSON.stringify({
    scope:
      "Installed runtime npm dependency graph. Electron/Chromium notices are separately included by Electron packaging. Development-only packages are outside this runtime inventory.",
    packages: inventory,
  }) + "\n",
);
fs.writeFileSync(
  path.join(output, "Yami-LICENSE.txt"),
  fs.readFileSync("LICENSE", "utf8"),
);
fs.writeFileSync(
  path.join(output, "GeoNames-attribution.txt"),
  "City data: GeoNames (https://www.geonames.org/), cities15000 dataset.\nAdapted to the bundled city lookup JSON for Yami.\nLicensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/\n",
);
console.log(
  `Collected ${inventory.length} runtime package records. ${inventory.filter((p) => p.missingNotice).length} packages have no top-level notice file; inspect inventory.json.`,
);
