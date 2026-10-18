$ErrorActionPreference = "Stop"
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name "YamiForeground" -Namespace "YamiWheel" -PassThru | Out-Null
$foreground = [int64][YamiWheel.YamiForeground]::GetForegroundWindow()
$shell = New-Object -ComObject Shell.Application
$paths = New-Object System.Collections.Generic.List[string]
foreach ($window in @($shell.Windows())) {
  try {
    if ([int64]$window.HWND -ne $foreground) { continue }
    foreach ($item in @($window.Document.SelectedItems())) {
      if ($item.Path) { $paths.Add([string]$item.Path) }
    }
  } catch {}
}
@{ paths = @($paths) } | ConvertTo-Json -Compress
