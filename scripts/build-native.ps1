$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectRoot 'native\bin'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'native\Media.ps1') -Destination $targetDir -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'native\Radios.ps1') -Destination $targetDir -Force
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path -Parent $compiler
$source = Join-Path $projectRoot 'native\Host.cs'
$jobsSource = Join-Path $projectRoot 'native\ProcessJobs.cs'
$fingerprint = [IO.File]::ReadAllText($source) + "`n" + [IO.File]::ReadAllText($jobsSource)
$hasher = [Security.Cryptography.SHA256]::Create()
try { $digest = ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($fingerprint)))).Replace('-', '').ToLowerInvariant().Substring(0,12) } finally { $hasher.Dispose() }
$executable = "Yami.Native-$digest.exe"
$target = Join-Path $targetDir $executable
if (-not (Test-Path -LiteralPath $target)) {
& $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$target" /r:System.Web.Extensions.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll "/r:$framework\WPF\UIAutomationClient.dll" "/r:$framework\WPF\UIAutomationTypes.dll" "/r:$framework\WPF\WindowsBase.dll" $source $jobsSource
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$manifestTarget = Join-Path $targetDir 'host-manifest.json'
[IO.File]::WriteAllText("$manifestTarget.tmp", (@{ executable = $executable } | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath "$manifestTarget.tmp" -Destination $manifestTarget -Force
foreach ($helperName in @('Hook')) {
  $helperSource = Join-Path $projectRoot "native\$helperName.cs"
  if (-not (Test-Path -LiteralPath $helperSource)) { continue }
  $helperTarget = Join-Path $targetDir "Yami.$helperName.exe"
  if ((Test-Path -LiteralPath $helperTarget) -and (Get-Item -LiteralPath $helperTarget).LastWriteTime -gt (Get-Item -LiteralPath $helperSource).LastWriteTime) { continue }
  & $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$helperTarget" /r:System.Web.Extensions.dll $helperSource
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$speechSource = Join-Path $projectRoot 'native\Speech.ps1'
if (Test-Path -LiteralPath $speechSource) { Copy-Item -LiteralPath $speechSource -Destination $targetDir -Force }
