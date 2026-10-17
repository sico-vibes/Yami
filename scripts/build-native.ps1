$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectRoot 'native\bin'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'native\Media.ps1') -Destination $targetDir -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'native\Radios.ps1') -Destination $targetDir -Force
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path -Parent $compiler
$source = Join-Path $projectRoot 'native\Host.cs'
$target = Join-Path $targetDir 'Yami.Native.exe'
if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).LastWriteTime -gt (Get-Item -LiteralPath $source).LastWriteTime) { exit 0 }
& $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$target" /r:System.Web.Extensions.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll "/r:$framework\WPF\UIAutomationClient.dll" "/r:$framework\WPF\UIAutomationTypes.dll" "/r:$framework\WPF\WindowsBase.dll" $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
