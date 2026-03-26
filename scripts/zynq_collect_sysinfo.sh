#!/usr/bin/env bash
set -euo pipefail

OUT_BASE="${1:-/tmp}"
TS="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${OUT_BASE%/}/zynq_sysinfo_${TS}"

mkdir -p "$RUN_DIR"

run_cmd() {
  local name="$1"
  shift
  local file="${RUN_DIR}/${name}.txt"
  {
    echo "## COMMAND: $*"
    echo "## TIME: $(date -Iseconds)"
    echo
    "$@"
    local rc=$?
    echo
    echo "## EXIT_CODE: $rc"
  } >"$file" 2>&1 || true
}

write_file() {
  local name="$1"
  local path="$2"
  local file="${RUN_DIR}/${name}.txt"
  {
    echo "## FILE: $path"
    echo "## TIME: $(date -Iseconds)"
    echo
    if [[ -f "$path" ]]; then
      cat "$path"
    else
      echo "File not found: $path"
    fi
  } >"$file" 2>&1 || true
}

echo "Collecting Zynq Ubuntu system info..."
echo "Output directory: $RUN_DIR"

run_cmd whoami whoami
run_cmd id id
run_cmd date date
run_cmd uname uname -a
write_file os_release /etc/os-release
write_file proc_version /proc/version
write_file proc_cmdline /proc/cmdline
run_cmd uptime uptime
run_cmd cpuinfo_head sh -c "sed -n '1,120p' /proc/cpuinfo"
run_cmd meminfo free -m
run_cmd disk df -h
run_cmd lsblk lsblk
run_cmd mount mount
run_cmd net_ipv4 sh -c "ip -o -4 addr show 2>/dev/null || ifconfig -a"
run_cmd route sh -c "ip route 2>/dev/null || route -n"
run_cmd dmesg_tail sh -c "dmesg | tail -n 200"
run_cmd process_top sh -c "ps -ef | head -n 120"
run_cmd boot_dir sh -c "ls -al /boot"
run_cmd systemd_version sh -c "systemctl --version 2>/dev/null || echo 'systemctl not available'"

cat > "${RUN_DIR}/SUMMARY.txt" <<EOF
Zynq SysInfo Collection
Timestamp: $(date -Iseconds)
Hostname: $(hostname 2>/dev/null || echo unknown)
Kernel: $(uname -r 2>/dev/null || echo unknown)
OutputDir: $RUN_DIR
EOF

ARCHIVE="${RUN_DIR}.tar.gz"
tar -czf "$ARCHIVE" -C "$(dirname "$RUN_DIR")" "$(basename "$RUN_DIR")"

echo "Collection completed."
echo "Directory: $RUN_DIR"
echo "Archive:   $ARCHIVE"
