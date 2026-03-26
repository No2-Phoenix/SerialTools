param(
  [string]$PortName = "",
  [int]$BaudRate = 115200,
  [int]$ReadTimeoutMs = 300,
  [int]$CommandTimeoutMs = 12000,
  [string]$OutputDir = "logs",
  [switch]$EnableDtr,
  [switch]$EnableRts
)

$ErrorActionPreference = "Stop"

function Read-Chunk {
  param(
    [System.IO.Ports.SerialPort]$Serial,
    [int]$WaitMs
  )

  $builder = New-Object System.Text.StringBuilder
  $deadline = [DateTime]::UtcNow.AddMilliseconds($WaitMs)
  $lastRead = [DateTime]::UtcNow

  while ([DateTime]::UtcNow -lt $deadline) {
    $available = $Serial.BytesToRead
    if ($available -gt 0) {
      $buffer = New-Object byte[] $available
      [void]$Serial.Read($buffer, 0, $buffer.Length)
      $text = [System.Text.Encoding]::ASCII.GetString($buffer)
      [void]$builder.Append($text)
      $lastRead = [DateTime]::UtcNow
      continue
    }

    if ($builder.Length -gt 0) {
      $idleMs = ([DateTime]::UtcNow - $lastRead).TotalMilliseconds
      if ($idleMs -ge 150) {
        break
      }
    }

    Start-Sleep -Milliseconds 30
  }

  return $builder.ToString()
}

function Sanitize-Name {
  param([string]$Text)
  return ($Text -replace '[^A-Za-z0-9_-]', '_')
}

function Write-Line {
  param(
    [System.IO.Ports.SerialPort]$Serial,
    [string]$Text
  )
  [byte[]]$payload = [System.Text.Encoding]::ASCII.GetBytes($Text + "`r`n")
  [void]$Serial.Write([byte[]]$payload, [int]0, [int]$payload.Length)
}

function Invoke-RemoteCommand {
  param(
    [System.IO.Ports.SerialPort]$Serial,
    [string]$Name,
    [string]$Command,
    [int]$TimeoutMs
  )

  $safeName = Sanitize-Name -Text $Name
  $startMarker = "__GS_BEGIN_${safeName}__"
  $endMarker = "__GS_END_${safeName}__"

  # 使用 marker 包裹输出，方便可靠分段
  $scriptLine = "echo $startMarker; $Command; __rc=`$?; echo $endMarker:`$__rc"
  Write-Line -Serial $Serial -Text $scriptLine

  $fullText = ""
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  $foundStart = $false
  $foundEnd = $false
  $exitCode = ""

  while ([DateTime]::UtcNow -lt $deadline) {
    $chunk = Read-Chunk -Serial $Serial -WaitMs 800
    if ([string]::IsNullOrEmpty($chunk)) {
      continue
    }

    $fullText += $chunk

    if (-not $foundStart -and $fullText.Contains($startMarker)) {
      $foundStart = $true
    }

    if ($fullText -match [regex]::Escape($endMarker) + ":(\d+)") {
      $foundEnd = $true
      $exitCode = $Matches[1]
      break
    }
  }

  if (-not $foundEnd) {
    return [PSCustomObject]@{
      Name = $Name
      Command = $Command
      ExitCode = "TIMEOUT"
      Output = $fullText
      Success = $false
    }
  }

  $startIndex = $fullText.IndexOf($startMarker)
  $endIndex = $fullText.IndexOf($endMarker)
  $payload = ""
  if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $payload = $fullText.Substring($startIndex + $startMarker.Length, $endIndex - ($startIndex + $startMarker.Length))
  } else {
    $payload = $fullText
  }

  return [PSCustomObject]@{
    Name = $Name
    Command = $Command
    ExitCode = $exitCode
    Output = $payload.Trim()
    Success = ($exitCode -eq "0")
  }
}

$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
Write-Host "Detected ports: $($ports -join ', ')"

if ([string]::IsNullOrWhiteSpace($PortName)) {
  if ($ports.Count -eq 0) {
    throw "No serial port detected. Connect board and retry."
  }
  $PortName = [string]$ports[0]
}

if ($PortName -notmatch '^(?i)COM\d+$') {
  throw "Invalid port name '$PortName'. Expected format like COM5."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir = Join-Path $OutputDir "zynq_sysinfo_$timestamp"
if (-not (Test-Path $runDir)) {
  New-Item -Path $runDir -ItemType Directory | Out-Null
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
  $serial.NewLine = "`n"
$serial.DtrEnable = $EnableDtr.IsPresent
$serial.RtsEnable = $EnableRts.IsPresent

$commands = @(
  @{ Name = "whoami"; Cmd = "whoami" },
  @{ Name = "id"; Cmd = "id" },
  @{ Name = "date"; Cmd = "date" },
  @{ Name = "uname"; Cmd = "uname -a" },
  @{ Name = "os_release"; Cmd = "cat /etc/os-release" },
  @{ Name = "proc_version"; Cmd = "cat /proc/version" },
  @{ Name = "proc_cmdline"; Cmd = "cat /proc/cmdline" },
  @{ Name = "uptime"; Cmd = "uptime" },
  @{ Name = "cpuinfo_head"; Cmd = "cat /proc/cpuinfo | sed -n '1,80p'" },
  @{ Name = "meminfo"; Cmd = "free -m" },
  @{ Name = "disk"; Cmd = "df -h" },
  @{ Name = "lsblk"; Cmd = "lsblk" },
  @{ Name = "net_ipv4"; Cmd = "ip -o -4 addr show 2>/dev/null || ifconfig -a" },
  @{ Name = "route"; Cmd = "ip route 2>/dev/null || route -n" },
  @{ Name = "dmesg_tail"; Cmd = "dmesg | tail -n 120" },
  @{ Name = "boot_dir"; Cmd = "ls -al /boot" }
)

$results = New-Object System.Collections.Generic.List[object]
$rawTranscript = New-Object System.Text.StringBuilder

try {
  Write-Host "Opening port $PortName @ $BaudRate ..."
  $serial.Open()
  Write-Host "Port opened."

  # 清空开口瞬间可能堆积的数据
  $initial = Read-Chunk -Serial $serial -WaitMs 500
  if (-not [string]::IsNullOrWhiteSpace($initial)) {
    [void]$rawTranscript.AppendLine("=== INITIAL ===")
    [void]$rawTranscript.AppendLine($initial)
  }

  # 轻触发 shell prompt
  Write-Line -Serial $serial -Text ""
  Start-Sleep -Milliseconds 100

  # 串口握手探测：先确认当前会话能回显并执行命令
  $handshake = Invoke-RemoteCommand -Serial $serial -Name "handshake" -Command "echo __GS_HANDSHAKE__" -TimeoutMs 4000
  if (-not $handshake.Success -or $handshake.Output -notmatch "__GS_HANDSHAKE__") {
    throw "No command response from serial shell. Ensure Ubuntu root shell is active on this UART and press Enter once."
  }

  foreach ($item in $commands) {
    $name = [string]$item.Name
    $cmd = [string]$item.Cmd

    Write-Host "Collecting: $name"
    $result = Invoke-RemoteCommand -Serial $serial -Name $name -Command $cmd -TimeoutMs $CommandTimeoutMs
    $results.Add($result) | Out-Null

    [void]$rawTranscript.AppendLine("=== $name ===")
    [void]$rawTranscript.AppendLine("CMD: $cmd")
    [void]$rawTranscript.AppendLine("EXIT: $($result.ExitCode)")
    [void]$rawTranscript.AppendLine($result.Output)
    [void]$rawTranscript.AppendLine("")

    $fileName = (Sanitize-Name -Text $name) + ".txt"
    $path = Join-Path $runDir $fileName
    Set-Content -Path $path -Value $result.Output -Encoding UTF8
  }

  $summary = [PSCustomObject]@{
    Port = $PortName
    BaudRate = $BaudRate
    Timestamp = (Get-Date).ToString("s")
    TotalCommands = $results.Count
    FailedCommands = @($results | Where-Object { -not $_.Success }).Count
    OutputDirectory = (Resolve-Path $runDir).Path
    Results = $results
  }

  $summaryPath = Join-Path $runDir "summary.json"
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryPath -Encoding UTF8

  $transcriptPath = Join-Path $runDir "raw_transcript.txt"
  Set-Content -Path $transcriptPath -Value $rawTranscript.ToString() -Encoding UTF8

  Write-Host "Collection finished."
  Write-Host "Output directory: $((Resolve-Path $runDir).Path)"
  Write-Host "Failed commands: $(@($results | Where-Object { -not $_.Success }).Count)"
}
finally {
  if ($serial.IsOpen) {
    $serial.Close()
    Write-Host "Port closed."
  }
  $serial.Dispose()
}
