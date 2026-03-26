param(
  [string]$PortName = "",
  [int]$BaudRate = 115200,
  [int]$ReadTimeoutMs = 400,
  [int]$PromptWaitMs = 3000,
  [int]$BootWaitMs = 20000,
  [int]$CommandWaitMs = 2000,
  [string]$Username = "root",
  [string]$Password = "root",
  [switch]$ForceCredentialSend,
  [switch]$AutoBootFromUboot,
  [switch]$EnableDtr,
  [switch]$EnableRts
)

$ErrorActionPreference = "Stop"

function Read-SerialText {
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

    # 如果已经有输出，且超过 180ms 没有新数据，提前返回
    if ($builder.Length -gt 0) {
      $idleMs = ([DateTime]::UtcNow - $lastRead).TotalMilliseconds
      if ($idleMs -gt 180) {
        break
      }
    }

    Start-Sleep -Milliseconds 30
  }

  return $builder.ToString()
}

function Write-Line {
  param(
    [System.IO.Ports.SerialPort]$Serial,
    [string]$Text
  )
  $payload = [System.Text.Encoding]::ASCII.GetBytes($Text + "`r`n")
  $Serial.Write($payload, 0, $payload.Length)
}

function Has-ShellPrompt {
  param([string]$Text)
  return $Text -match "(?m)(#\s*$|\$\s*$)"
}

function Has-UbootPrompt {
  param([string]$Text)
  return ($Text -match "(?m)^\s*Zynq>\s*$") -or ($Text -match "(?i)u-boot")
}

$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
Write-Host "Detected ports: $($ports -join ', ')"

if ([string]::IsNullOrWhiteSpace($PortName)) {
  if ($ports.Count -eq 0) {
    throw "No serial port detected. Connect Zynq board and retry."
  }
  $PortName = [string]$ports[0]
}

if ($PortName -notmatch '^(?i)COM\d+$') {
  throw "Invalid port name '$PortName'. Expected format like COM5."
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

$transcript = New-Object System.Text.StringBuilder

try {
  Write-Host "Opening port $PortName @ $BaudRate ..."
  $serial.Open()
  Write-Host "Port opened."

  # 先被动读取，避免干扰 autoboot；若无输出再尝试回车唤醒
  $out = Read-SerialText -Serial $serial -WaitMs $PromptWaitMs
  [void]$transcript.Append($out)
  if ([string]::IsNullOrWhiteSpace($out)) {
    Write-Line -Serial $serial -Text ""
    Start-Sleep -Milliseconds 120
    $out = Read-SerialText -Serial $serial -WaitMs $PromptWaitMs
    [void]$transcript.Append($out)
  }

  $allText = $transcript.ToString()

  if ((Has-UbootPrompt -Text $allText) -and -not (Has-ShellPrompt -Text $allText)) {
    if ($AutoBootFromUboot) {
      Write-Host "U-Boot prompt detected. Trying to boot Linux ..."
      foreach ($cmd in @("run bootcmd", "boot")) {
        Write-Host "Sending U-Boot command: $cmd"
        Write-Line -Serial $serial -Text $cmd
        $bootOut = Read-SerialText -Serial $serial -WaitMs $BootWaitMs
        [void]$transcript.Append($bootOut)
        $allText = $transcript.ToString()
        if (($allText -match "(?i)login:|password:") -or (Has-ShellPrompt -Text $allText)) {
          break
        }
      }
      # 再等待一段时间，给内核启动和 getty 留窗口
      $bootOut = Read-SerialText -Serial $serial -WaitMs $BootWaitMs
      [void]$transcript.Append($bootOut)
      $allText = $transcript.ToString()
    } else {
      Write-Host "=== SERIAL OUTPUT BEGIN ==="
      Write-Host $allText
      Write-Host "=== SERIAL OUTPUT END ==="
      throw "Detected U-Boot prompt (Zynq>). Linux is not booted. Re-run with -AutoBootFromUboot."
    }
  }

  if ($allText -match "(?i)login:") {
    Write-Host "Login prompt detected. Sending username..."
    Write-Line -Serial $serial -Text $Username
    $out = Read-SerialText -Serial $serial -WaitMs $PromptWaitMs
    [void]$transcript.Append($out)
    $allText = $transcript.ToString()
  }

  if ($allText -match "(?i)password:") {
    Write-Host "Password prompt detected. Sending password..."
    Write-Line -Serial $serial -Text $Password
    $out = Read-SerialText -Serial $serial -WaitMs $PromptWaitMs
    [void]$transcript.Append($out)
    $allText = $transcript.ToString()
  }

  if ($ForceCredentialSend) {
    Write-Host "ForceCredentialSend enabled. Sending username/password regardless of prompt..."
    Write-Line -Serial $serial -Text $Username
    $out = Read-SerialText -Serial $serial -WaitMs 1000
    [void]$transcript.Append($out)

    Write-Line -Serial $serial -Text $Password
    $out = Read-SerialText -Serial $serial -WaitMs $PromptWaitMs
    [void]$transcript.Append($out)
    $allText = $transcript.ToString()
  }

  if (-not (Has-ShellPrompt -Text $allText)) {
    # 再发送一个回车，避免提示符未刷新
    Write-Line -Serial $serial -Text ""
    $out = Read-SerialText -Serial $serial -WaitMs 1200
    [void]$transcript.Append($out)
    $allText = $transcript.ToString()
  }

  if (-not (Has-ShellPrompt -Text $allText)) {
    Write-Host "=== SERIAL OUTPUT BEGIN ==="
    Write-Host $allText
    Write-Host "=== SERIAL OUTPUT END ==="
    if (Has-UbootPrompt -Text $allText) {
      throw "Still in U-Boot prompt (Zynq>). Linux login shell not reached."
    }
    throw "Failed to reach shell prompt."
  }

  Write-Host "Shell prompt detected. Running probe commands..."
  Write-Line -Serial $serial -Text "echo __SERIAL_OK__"
  $probeOut = Read-SerialText -Serial $serial -WaitMs $CommandWaitMs
  [void]$transcript.Append($probeOut)

  Write-Line -Serial $serial -Text "uname -a"
  $unameOut = Read-SerialText -Serial $serial -WaitMs $CommandWaitMs
  [void]$transcript.Append($unameOut)

  Write-Host "=== SERIAL OUTPUT BEGIN ==="
  Write-Host $transcript.ToString()
  Write-Host "=== SERIAL OUTPUT END ==="

  if ($transcript.ToString() -match "__SERIAL_OK__") {
    Write-Host "Zynq serial login smoke test passed."
  } else {
    throw "Shell reached but probe token missing."
  }
}
finally {
  if ($serial.IsOpen) {
    $serial.Close()
    Write-Host "Port closed."
  }
  $serial.Dispose()
}
