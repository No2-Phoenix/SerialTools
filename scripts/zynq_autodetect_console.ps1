param(
  [string]$PortName = "",
  [int[]]$BaudRates = @(115200, 57600, 38400, 19200, 9600, 230400, 460800),
  [int]$ProbeSec = 4,
  [bool]$KickPrompt = $true,
  [switch]$EnableDtr,
  [switch]$EnableRts
)

$ErrorActionPreference = "Stop"

function Probe-Baud {
  param(
    [string]$PortName,
    [int]$BaudRate,
    [int]$ProbeSec,
    [bool]$EnableDtr,
    [bool]$EnableRts
  )

  $serial = [System.IO.Ports.SerialPort]::new(
    $PortName,
    $BaudRate,
    [System.IO.Ports.Parity]::None,
    8,
    [System.IO.Ports.StopBits]::One
  )
  $serial.ReadTimeout = 250
  $serial.WriteTimeout = 250
  $serial.DtrEnable = $EnableDtr
  $serial.RtsEnable = $EnableRts

  try {
    $serial.Open()
    $deadline = [DateTime]::UtcNow.AddSeconds($ProbeSec)
    $totalBytes = 0

    while ([DateTime]::UtcNow -lt $deadline) {
      if ($KickPrompt) {
        $serial.Write("`r`n")
      }

      $available = $serial.BytesToRead
      if ($available -gt 0) {
        $buffer = New-Object byte[] $available
        [void]$serial.Read($buffer, 0, $buffer.Length)
        $totalBytes += $buffer.Length
      }

      Start-Sleep -Milliseconds 120
    }

    return $totalBytes
  }
  finally {
    if ($serial.IsOpen) {
      $serial.Close()
    }
    $serial.Dispose()
  }
}

$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
Write-Host "Detected ports: $($ports -join ', ')"

if ([string]::IsNullOrWhiteSpace($PortName)) {
  if ($ports.Count -eq 0) {
    throw "No serial port detected."
  }
  $PortName = [string]$ports[0]
}

if ($PortName -notmatch '^(?i)COM\d+$') {
  throw "Invalid port name '$PortName'. Expected format like COM5."
}

Write-Host "Auto-detecting console output on $PortName ..."
$results = New-Object System.Collections.Generic.List[object]

foreach ($baud in $BaudRates) {
  Write-Host "Probing baud: $baud"
  try {
    $bytes = Probe-Baud -PortName $PortName -BaudRate $baud -ProbeSec $ProbeSec -EnableDtr:$EnableDtr.IsPresent -EnableRts:$EnableRts.IsPresent
    $results.Add([PSCustomObject]@{
      BaudRate = $baud
      Bytes    = $bytes
      Status   = "OK"
    }) | Out-Null
  }
  catch {
    $results.Add([PSCustomObject]@{
      BaudRate = $baud
      Bytes    = 0
      Status   = "ERR: $($_.Exception.Message)"
    }) | Out-Null
  }
}

$results | Sort-Object -Property Bytes -Descending | Format-Table -AutoSize

$best = $results | Sort-Object -Property Bytes -Descending | Select-Object -First 1
if ($best -and $best.Bytes -gt 0) {
  Write-Host "Likely console baud: $($best.BaudRate) (captured $($best.Bytes) bytes)."
  exit 0
}

Write-Host "No serial text output detected on tested baud rates."
exit 1
