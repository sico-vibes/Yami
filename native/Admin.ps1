param([string]$Mode = 'read', [string]$Name = '', [string]$Start = '', [string]$Out = '', [string]$Run = '')
$ErrorActionPreference = 'Stop'
# Tune's administrator actions. Reading needs no rights; 'service' and
# 'restore-point' run elevated (one UAC prompt each). Only these services
# and start types are accepted; nothing typed by the page reaches a command.
$services = @('DiagTrack', 'MapsBroker')
$starts = @('Automatic', 'Manual', 'Disabled')
# An elevated run cannot hand its output back, so it also writes it to $Out.
function Reply($value) {
  $json = ConvertTo-Json -InputObject $value -Compress -Depth 4
  if ($Out) { [IO.File]::WriteAllText($Out, $json) }
  $json
}
try {
  if ($Mode -eq 'read') {
    $list = @($services | ForEach-Object {
      $s = Get-Service -Name $_ -ErrorAction SilentlyContinue
      if ($s) { @{ name = $s.Name; label = $s.DisplayName; start = [string]$s.StartType; running = ($s.Status -eq 'Running') } }
    })
    ConvertTo-Json -InputObject @{ services = $list } -Compress -Depth 4
    exit
  }
  if ($Mode -eq 'service') {
    if ($services -notcontains $Name -or $starts -notcontains $Start) { throw 'Unknown service change.' }
    Set-Service -Name $Name -StartupType $Start
    if ($Start -eq 'Disabled') { Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue }
    elseif ($Run -eq '1') { Start-Service -Name $Name -ErrorAction SilentlyContinue }
    Reply @{ ok = $true }
    exit
  }
  if ($Mode -eq 'restore-point') {
    # Windows skips a new point within 24 hours of the last one unless told
    # otherwise; Yami does not change that, it reports what happened.
    $before = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue).Count
    Checkpoint-Computer -Description 'Before changes in Yami Tune' -RestorePointType MODIFY_SETTINGS
    $after = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue).Count
    Reply @{ ok = $true; created = ($after -gt $before) }
    exit
  }
  throw 'Unknown request.'
} catch { Reply @{ error = $_.Exception.Message }; exit 1 }
