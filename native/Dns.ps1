param([string]$Mode = 'read', [int]$Index = 0, [string]$Profile = '')
$ErrorActionPreference = 'Stop'
# Fixed profiles only; nothing typed by the page reaches a command line.
$profiles = @{
  cloudflare = @('1.1.1.1', '1.0.0.1')
  cloudflareFamily = @('1.1.1.3', '1.0.0.3')
  quad9 = @('9.9.9.9', '149.112.112.112')
  adguard = @('94.140.14.14', '94.140.15.15')
  google = @('8.8.8.8', '8.8.4.4')
}
try {
  if ($Mode -eq 'read') {
    $adapters = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
      $dns = (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
      @{ index = $_.ifIndex; name = $_.Name; description = $_.InterfaceDescription; servers = @($dns) }
    })
    ConvertTo-Json -InputObject @{ adapters = $adapters } -Compress -Depth 4
    exit
  }
  if ($Mode -ne 'apply' -or $Index -le 0) { throw 'Unknown DNS request.' }
  if ($Profile -eq 'automatic') {
    Set-DnsClientServerAddress -InterfaceIndex $Index -ResetServerAddresses
  } elseif ($profiles.ContainsKey($Profile)) {
    Set-DnsClientServerAddress -InterfaceIndex $Index -ServerAddresses $profiles[$Profile]
  } else { throw 'Unknown DNS profile.' }
  Clear-DnsClientCache
  @{ ok = $true } | ConvertTo-Json -Compress
} catch { @{ error = $_.Exception.Message } | ConvertTo-Json -Compress; exit 1 }
