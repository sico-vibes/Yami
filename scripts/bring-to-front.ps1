param([Parameter(Mandatory = $true)][long]$Handle)
# Brings one window to the front for the desktop checks, the same way Yami's
# native host does for dictation: attach to the foreground window's input
# thread, then ask for the foreground. Prints the foreground handle after.
$ErrorActionPreference = 'Stop'
Add-Type -Name Front -Namespace YamiCheck -MemberDefinition @'
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, System.IntPtr pid);
[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from, uint to, bool attach);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
[DllImport("user32.dll")] public static extern bool BringWindowToTop(System.IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int command);
'@
$target = [IntPtr]$Handle
$front = [YamiCheck.Front]::GetForegroundWindow()
$frontThread = [YamiCheck.Front]::GetWindowThreadProcessId($front, [IntPtr]::Zero)
$mine = [YamiCheck.Front]::GetCurrentThreadId()
[void][YamiCheck.Front]::AttachThreadInput($mine, $frontThread, $true)
try {
  [void][YamiCheck.Front]::ShowWindow($target, 5)
  [void][YamiCheck.Front]::BringWindowToTop($target)
  [void][YamiCheck.Front]::SetForegroundWindow($target)
} finally {
  [void][YamiCheck.Front]::AttachThreadInput($mine, $frontThread, $false)
}
Start-Sleep -Milliseconds 200
[YamiCheck.Front]::GetForegroundWindow().ToInt64()
