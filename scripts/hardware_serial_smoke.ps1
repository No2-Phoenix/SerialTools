param(
  [string]$PortName = "",
  [int]$BaudRate = 115200,
  [int]$ReadTimeoutMs = 500,
  [int]$ResponseWaitMs = 1000,
  [string]$HexPayload = "55 AA 01 02",
  [switch]$SkipWrite
)

$ErrorActionPreference = "Stop"

function Convert-HexToBytes {
  param([string]$HexText)
  $tokens = $HexText -split "\s+" | Where-Object { $_ -ne "" }
  if ($tokens.Count -eq 0) {
    return @()
  }

  $bytes = New-Object System.Collections.Generic.List[byte]
  foreach ($token in $tokens) {
    if ($token -notmatch '^[0-9A-Fa-f]{1,2}$') {
      throw "Invalid hex token: $token"
    }
    $bytes.Add([Convert]::ToByte($token, 16))
  }
  return $bytes.ToArray()
}

$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
Write-Host "Detected ports: $($ports -join ', ')"

if ([string]::IsNullOrWhiteSpace($PortName)) {
  if ($ports.Count -eq 0) {
    throw "No serial port detected. Connect hardware and retry."
  }
  $PortName = [string]$ports[0]
}

if ($PortName -notmatch '^(?i)COM\d+$') {
  throw "Invalid port name '$PortName'. Expected format like COM5."
}

if (-not ($ports -contains $PortName)) {
  Write-Warning "Port '$PortName' not in detected list. Attempting anyway."
}

$serial = [System.IO.Ports.SerialPort]::new($PortName, $BaudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.ReadTimeout = $ReadTimeoutMs
$serial.WriteTimeout = $ReadTimeoutMs

try {
  Write-Host "Opening port $PortName @ $BaudRate ..."
  $serial.Open()
  Write-Host "Port opened."

  if (-not $SkipWrite) {
    $payload = Convert-HexToBytes -HexText $HexPayload
    if ($payload.Length -gt 0) {
      Write-Host "Writing bytes: $(([System.BitConverter]::ToString($payload)).Replace('-', ' '))"
      $serial.Write($payload, 0, $payload.Length)
      Start-Sleep -Milliseconds 120
    }
  }

  $deadline = [DateTime]::UtcNow.AddMilliseconds($ResponseWaitMs)
  while ([DateTime]::UtcNow -lt $deadline -and $serial.BytesToRead -eq 0) {
    Start-Sleep -Milliseconds 20
  }

  $available = $serial.BytesToRead
  Write-Host "Bytes available to read: $available"

  if ($available -gt 0) {
    $buffer = New-Object byte[] $available
    [void]$serial.Read($buffer, 0, $buffer.Length)
    $hex = ([System.BitConverter]::ToString($buffer)).Replace('-', ' ')
    Write-Host "Read bytes: $hex"
  } else {
    Write-Host "No incoming bytes read during smoke test window."
  }

  Write-Host "Hardware serial smoke test completed."
}
finally {
  if ($serial.IsOpen) {
    $serial.Close()
    Write-Host "Port closed."
  }
  $serial.Dispose()
}
