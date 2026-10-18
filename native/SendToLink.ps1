param(
  [Parameter(Mandatory = $true)][string]$Shortcut,
  [Parameter(Mandatory = $true)][string]$Target,
  [string]$Arguments = "",
  [string]$WorkDir = ""
)
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($Shortcut)
$link.TargetPath = $Target
$link.Arguments = $Arguments
if ($WorkDir) { $link.WorkingDirectory = $WorkDir }
$link.WindowStyle = 7
$link.Description = "Open the Yami file wheel"
$link.Save()
Write-Output "ok"
