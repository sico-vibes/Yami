$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectRoot 'native\bin'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
foreach ($script in @('Media.ps1', 'Radios.ps1', 'ExplorerSelection.ps1', 'SendToLink.ps1')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "native\$script") -Destination $targetDir -Force
}
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path -Parent $compiler
$sources = @(
  (Join-Path $projectRoot 'native\Host.cs'),
  (Join-Path $projectRoot 'native\Wheel.cs')
)
$target = Join-Path $targetDir 'Yami.Native.exe'
$newestSource = ($sources | ForEach-Object { (Get-Item -LiteralPath $_).LastWriteTime } | Measure-Object -Maximum).Maximum
if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).LastWriteTime -gt $newestSource) { exit 0 }
& $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$target" /r:System.Web.Extensions.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll "/r:$framework\WPF\UIAutomationClient.dll" "/r:$framework\WPF\UIAutomationTypes.dll" "/r:$framework\WPF\WindowsBase.dll" $sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
