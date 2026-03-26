param(
  [string]$PortName = "",
  [int]$BaudRate = 115200,
  [int]$DurationSec = 20,
  [int]$ReadTimeoutMs = 300,
  [int]$KickIntervalMs = 1500,
  [string]$OutputFile = "logs/zynq_console_capture.txt",
  [switch]$EnableDtr,
  [switch]$EnableRts
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PortName)) {
  $ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
  if ($ports.Count -eq 0) {
    throw "No serial port detected. Connect board and retry."
  }
  $PortName = [string]$ports[0]
}

if ($PortName -notmatch '^(?i)COM\d+$') {
  throw "Invalid port name '$PortName'. Expected format like COM5."
}

$outputDir = Split-Path -Parent $OutputFile
if (-not [string]::IsNullOrWhiteSpace($outputDir) -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$serial = [System.IO.Ports.SerialPort]::new(
  $PortName,
  $BaudRate,
  [System.IO.Ports.Parity]::None,
  8,
  [System.IO.Ports.StopBits]::One
)
$serial.ReadTimeout = $ReadTimeoutMs
$serial.WriteTimeout = $ReadTimeoutMs
$serial.DtrEnable = $EnableDtr.IsPresent
$serial.RtsEnable = $EnableRts.IsPresent

$builder = New-Object System.Text.StringBuilder

try {
  Write-Host "Opening port $PortName @ $BaudRate ..."
  $serial.Open()
  Write-Host "Capture started for $DurationSec seconds. You can reset/reboot board now."

  $deadline = [DateTime]::UtcNow.AddSeconds($DurationSec)
  $lastKick = [DateTime]::UtcNow.AddMilliseconds(-1 * $KickIntervalMs)

  while ([DateTime]::UtcNow -lt $deadline) {
    if (([DateTime]::UtcNow - $lastKick).TotalMilliseconds -ge $KickIntervalMs) {
      $kick = [System.Text.Encoding]::ASCII.GetBytes("`r`n")
      $serial.Write($kick, 0, $kick.Length)
      $lastKick = [DateTime]::UtcNow
    }

    $available = $serial.BytesToRead
    if ($available -gt 0) {
      $buffer = New-Object byte[] $available
      [void]$serial.Read($buffer, 0, $buffer.Length)
      $text = [System.Text.Encoding]::ASCII.GetString($buffer)
      [void]$builder.Append($text)
      continue
    }

    Start-Sleep -Milliseconds 30
  }

  $content = $builder.ToString()
  Set-Content -Path $OutputFile -Value $content -Encoding UTF8

  Write-Host "Capture finished. Bytes: $($content.Length)"
  Write-Host "Saved to: $OutputFile"
}
finally {
  if ($serial.IsOpen) {
    $serial.Close()
    Write-Host "Port closed."
  }
  $serial.Dispose()
}
