$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
  function Await-WinRT($operation, $resultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $task = $method.MakeGenericMethod($resultType).Invoke($null,@($operation))
    if (-not $task.Wait(5000)) { throw 'Media session timed out' }
    $task.Result
  }
  $manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $session = $manager.GetCurrentSession()
  if ($null -eq $session) { @{active=$false} | ConvertTo-Json -Compress; exit }
  $properties = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $timeline = $session.GetTimelineProperties()
  @{active=$true; title=$properties.Title; artist=$properties.Artist; app=$session.SourceAppUserModelId; playing=($session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'); position=$timeline.Position.TotalSeconds; duration=$timeline.EndTime.TotalSeconds} | ConvertTo-Json -Compress
} catch { @{active=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress }
