param([string]$Mode = 'read', [int]$Index = 0, [string]$Profile = '', [string]$Encrypt = 'off', [string]$Out = '')
$ErrorActionPreference = 'Stop'
# Fixed profiles only; nothing typed by the page reaches a command line.
$profiles = @{
  cloudflare = @('1.1.1.1', '1.0.0.1')
  cloudflareFamily = @('1.1.1.3', '1.0.0.3')
  quad9 = @('9.9.9.9', '149.112.112.112')
  adguard = @('94.140.14.14', '94.140.15.15')
  google = @('8.8.8.8', '8.8.4.4')
  # Yami's network shield on this PC first (IPv4 and IPv6, so neither family
  # goes around it), and Quad9 for when Yami is not running.
  yami = @('127.0.0.1', '::1', '9.9.9.9')
}
# The DNS-over-HTTPS address each profile publishes.
$templates = @{
  cloudflare = 'https://cloudflare-dns.com/dns-query'
  cloudflareFamily = 'https://family.cloudflare-dns.com/dns-query'
  quad9 = 'https://dns.quad9.net/dns-query'
  adguard = 'https://dns.adguard-dns.com/dns-query'
  google = 'https://dns.google/dns-query'
}
$interfaces = 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\InterfaceSpecificParameters'
function DohKey($guid, $ip) { "$interfaces\$guid\DohInterfaceSettings\Doh\$ip" }
function Encrypted($guid, $servers) {
  if (-not $servers.Count) { return $false }
  foreach ($ip in $servers) {
    $flags = (Get-ItemProperty -Path (DohKey $guid $ip) -Name DohFlags -ErrorAction SilentlyContinue).DohFlags
    if ($flags -ne 1) { return $false }
  }
  $true
}
try {
  if ($Mode -eq 'read') {
    $adapters = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
      $dns = @((Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses)
      @{ index = $_.ifIndex; name = $_.Name; description = $_.InterfaceDescription; servers = $dns; encrypted = (Encrypted $_.InterfaceGuid $dns) }
    })
    ConvertTo-Json -InputObject @{ adapters = $adapters } -Compress -Depth 4
    exit
  }
  if ($Mode -ne 'apply' -or $Index -le 0) { throw 'Unknown DNS request.' }
  if ($Encrypt -ne 'on' -and $Encrypt -ne 'off') { throw 'Unknown encryption choice.' }
  if ($Profile -eq 'automatic') {
    Set-DnsClientServerAddress -InterfaceIndex $Index -ResetServerAddresses
  } elseif ($profiles.ContainsKey($Profile)) {
    # Leaving the shield: its IPv6 entry goes back to automatic as well.
    $v6 = @((Get-DnsClientServerAddress -InterfaceIndex $Index -AddressFamily IPv6 -ErrorAction SilentlyContinue).ServerAddresses)
    if ($Profile -ne 'yami' -and $v6 -contains '::1') { Set-DnsClientServerAddress -InterfaceIndex $Index -ResetServerAddresses }
    Set-DnsClientServerAddress -InterfaceIndex $Index -ServerAddresses $profiles[$Profile]
  } else { throw 'Unknown DNS profile.' }
  $guid = (Get-NetAdapter -InterfaceIndex $Index).InterfaceGuid
  $known = @($templates.Keys | ForEach-Object { $profiles[$_] })
  # Clear this adapter's encryption for the servers Yami knows; others stay.
  foreach ($ip in $known) {
    if (Test-Path (DohKey $guid $ip)) { Remove-Item (DohKey $guid $ip) -Recurse -Force }
  }
  if ($Encrypt -eq 'on' -and $templates.ContainsKey($Profile)) {
    foreach ($ip in $profiles[$Profile]) {
      $doh = @{ ServerAddress = $ip; DohTemplate = $templates[$Profile]; AutoUpgrade = $true; AllowFallbackToUdp = $false }
      if (Get-DnsClientDohServerAddress -ServerAddress $ip -ErrorAction SilentlyContinue) {
        Set-DnsClientDohServerAddress @doh | Out-Null
      } else { Add-DnsClientDohServerAddress @doh | Out-Null }
      New-Item -Path (DohKey $guid $ip) -Force | New-ItemProperty -Name DohFlags -Value 1 -PropertyType QWord -Force | Out-Null
    }
  }
  # A known server no adapter still encrypts goes back to plain lookups.
  foreach ($ip in $known) {
    $inUse = Get-ChildItem $interfaces -ErrorAction SilentlyContinue | Where-Object { Test-Path (DohKey $_.PSChildName $ip) }
    $entry = Get-DnsClientDohServerAddress -ServerAddress $ip -ErrorAction SilentlyContinue
    if (-not $inUse -and $entry -and $entry.AutoUpgrade) {
      Set-DnsClientDohServerAddress -ServerAddress $ip -AutoUpgrade $false | Out-Null
    }
  }
  Clear-DnsClientCache
  $json = @{ ok = $true } | ConvertTo-Json -Compress
  # An elevated run cannot hand its output back, so it also writes it to $Out.
  if ($Out) { [IO.File]::WriteAllText($Out, $json) }
  $json
} catch {
  $json = @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
  if ($Out) { [IO.File]::WriteAllText($Out, $json) }
  $json
  exit 1
}
