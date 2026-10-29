param([string]$Root = '')
$ErrorActionPreference = 'Stop'
# Installed apps for Tune, from the Uninstall entries Windows' own Apps page
# reads: this user's, the machine's, and 32-bit apps on 64-bit Windows.
# Updates, system components and entries without an uninstaller are left out.
# $Root (tests only) reads one fake key instead.
try {
  $paths = if ($Root) { @($Root + '\*') } else {
    @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
  }
  $apps = @(foreach ($p in $paths) {
    Get-ItemProperty -Path $p -ErrorAction SilentlyContinue | Where-Object {
      $_.DisplayName -and $_.UninstallString -and $_.SystemComponent -ne 1 -and -not $_.ParentKeyName -and $_.ReleaseType -notmatch 'Update|Hotfix'
    } | ForEach-Object {
      @{
        key = [string]$_.PSPath
        name = [string]$_.DisplayName
        publisher = [string]$_.Publisher
        version = [string]$_.DisplayVersion
        sizeKb = [int]($_.EstimatedSize)
        user = ([string]$_.PSPath) -match 'HKEY_CURRENT_USER'
        uninstall = [string]$_.UninstallString
      }
    }
  })
  ConvertTo-Json -InputObject @{ apps = $apps } -Compress -Depth 4
} catch { @{ error = $_.Exception.Message } | ConvertTo-Json -Compress }
