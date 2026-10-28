param([string]$Action = '', [double]$Seconds = 0)
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
  # Actions go to the playing app's own media session (Spotify, a browser, …),
  # so shuffle, repeat and seek work where the app supports them.
  if ($Action) {
    $info = $session.GetPlaybackInfo()
    $done = switch ($Action) {
      'toggle' { Await-WinRT ($session.TryTogglePlayPauseAsync()) ([bool]) }
      'next' { Await-WinRT ($session.TrySkipNextAsync()) ([bool]) }
      'previous' { Await-WinRT ($session.TrySkipPreviousAsync()) ([bool]) }
      'seek' { Await-WinRT ($session.TryChangePlaybackPositionAsync([long]($Seconds * 10000000))) ([bool]) }
      'shuffle' { Await-WinRT ($session.TryChangeShuffleActiveAsync(-not [bool]$info.IsShuffleActive)) ([bool]) }
      'repeat' {
        $next = switch ([string]$info.AutoRepeatMode) { 'None' { 'List' } 'List' { 'Track' } default { 'None' } }
        Await-WinRT ($session.TryChangeAutoRepeatModeAsync([Windows.Media.MediaPlaybackAutoRepeatMode]$next)) ([bool])
      }
      default { throw 'Unknown media action' }
    }
    if (-not $done) { throw 'The player did not accept that.' }
    Start-Sleep -Milliseconds 250
  }
  $properties = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $timeline = $session.GetTimelineProperties()
  $playback = $session.GetPlaybackInfo()
  $controls = $playback.Controls
  @{
    active=$true; title=$properties.Title; artist=$properties.Artist; app=$session.SourceAppUserModelId
    playing=($playback.PlaybackStatus.ToString() -eq 'Playing')
    position=$timeline.Position.TotalSeconds; duration=$timeline.EndTime.TotalSeconds
    shuffle=[bool]$playback.IsShuffleActive; repeat=[string]$playback.AutoRepeatMode
    canSeek=[bool]$controls.IsPlaybackPositionEnabled; canShuffle=[bool]$controls.IsShuffleEnabled; canRepeat=[bool]$controls.IsRepeatEnabled
  } | ConvertTo-Json -Compress
} catch { @{active=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress }
