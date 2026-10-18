/** Pull user files out of a process argv list. Directories and flags are ignored. */
export function filesFromArgv(
  argv: string[],
  existsFile: (value: string) => boolean,
  selfPath = "",
) {
  const self = selfPath.toLowerCase();
  return argv.filter((arg) => {
    if (!arg || arg.startsWith("-")) return false;
    if (self && arg.toLowerCase() === self) return false;
    return existsFile(arg);
  });
}
