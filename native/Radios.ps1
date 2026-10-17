$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $resultType = [System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]
  $task = $method.MakeGenericMethod($resultType).Invoke($null,@([Windows.Devices.Radios.Radio]::GetRadiosAsync()))
  if (-not $task.Wait(5000)) { throw 'Radio state timed out' }
  $result = @{}
  foreach($radio in $task.Result) { if ($radio.Kind.ToString() -eq 'Bluetooth') { $result.bluetooth = ($radio.State.ToString() -eq 'On') } }
  $result | ConvertTo-Json -Compress
} catch { '{}' }
