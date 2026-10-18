$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $projectRoot '.artifacts'
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$audioFile = Join-Path $artifactRoot ("speech-fixture-" + [Guid]::NewGuid().ToString('N') + '.wav')
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile($audioFile, $format)
  $synth.Speak('This is a local speech recognition test. The meeting starts at ten in the morning.')
  $synth.SetOutputToNull()
  $result = & (Join-Path $projectRoot 'native\Speech.ps1') -Mode transcribe -FilePath $audioFile
  $parsed = $result | ConvertFrom-Json
  if (-not $parsed.text -or $parsed.text -notmatch 'meeting|morning|speech') { throw "The synthetic fixture was not recognized: $($parsed.text)" }
  @{ passed = $true; method = 'Synthetic PCM WAV, installed Windows recognizer; no microphone or network'; recognized = $parsed.text } | ConvertTo-Json -Compress
} finally {
  $synth.Dispose()
  if (Test-Path -LiteralPath $audioFile) { Remove-Item -LiteralPath $audioFile -Force }
}
