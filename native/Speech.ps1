param([string]$Mode = 'recognizers', [string]$FilePath = '', [string]$Language = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
if ($Mode -eq 'recognizers') {
  ConvertTo-Json -InputObject @($installed | ForEach-Object { @{ id = $_.Id; name = $_.Name; language = $_.Culture.Name } }) -Compress
  exit 0
}
if ($Mode -ne 'transcribe') { throw 'Unknown speech operation.' }
$recognizer = if ($Language) { $installed | Where-Object { $_.Culture.Name -eq $Language } | Select-Object -First 1 } else { $installed | Select-Object -First 1 }
if (-not $recognizer) { throw 'Install a Windows speech recognition language in Windows Settings before using offline transcription.' }
$engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizer)
try {
  $engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
  $engine.SetInputToWaveFile($FilePath)
  $phrases = [Collections.Generic.List[string]]::new()
  while ($null -ne ($result = $engine.Recognize())) { if ($result.Text) { $phrases.Add($result.Text) } }
  @{ text = ($phrases -join ' '); language = $recognizer.Culture.Name; engine = 'Windows installed speech recognizer' } | ConvertTo-Json -Compress
} finally { $engine.Dispose() }
