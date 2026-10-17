$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot '.artifacts'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
try {
  $synthesizer.SetOutputToWaveFile((Join-Path $outputDir 'dictation-check.wav'), $format)
  $synthesizer.Speak("Let's meet at nine. Actually, make it ten.")
  $synthesizer.SetOutputToNull()
  $synthesizer.SetOutputToWaveFile((Join-Path $outputDir 'voice-check.wav'), $format)
  $synthesizer.Speak('Say the word ready.')
  $synthesizer.SetOutputToNull()
  $synthesizer.SetOutputToWaveFile((Join-Path $outputDir 'vision-check.wav'), $format)
  $synthesizer.Speak('What code is shown in the picture? Say only the code.')
} finally { $synthesizer.Dispose() }
Write-Output 'Created local 16 kHz test speech.'
