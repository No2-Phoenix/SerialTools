<template>
  <div class="connection-panel">
    <div class="panel-glow"></div>

    <div class="panel-header">
      <div class="header-left">
        <div class="icon-wrapper">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="title-group">
          <h2 class="panel-title">串口配置</h2>
          <p class="panel-subtitle">Serial Port Configuration</p>
        </div>
      </div>

      <div class="status-wrapper">
        <div class="status-indicator" :class="connectionStatusClass">
          <div class="status-dot"></div>
          <span class="status-text">{{ connectionStatusText }}</span>
        </div>
      </div>
    </div>

    <div class="config-grid">
      <div class="config-card main-card">
        <div class="card-icon">🔌</div>
        <div class="card-content">
          <label class="card-label">串口</label>
          <CustomSelect
            v-model="selectedPort"
            :options="portOptions"
            placeholder="选择串口..."
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>

      <div class="config-card">
        <div class="card-icon">📡</div>
        <div class="card-content">
          <label class="card-label">波特率</label>
          <CustomSelect
            v-model="config.baudRate"
            :options="baudRateOptions"
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>

      <div class="config-card">
        <div class="card-icon">📏</div>
        <div class="card-content">
          <label class="card-label">数据位</label>
          <CustomSelect
            v-model="config.dataBits"
            :options="dataBitsOptions"
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>

      <div class="config-card">
        <div class="card-icon">✔️</div>
        <div class="card-content">
          <label class="card-label">校验位</label>
          <CustomSelect
            v-model="config.parity"
            :options="parityOptions"
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>

      <div class="config-card">
        <div class="card-icon">🛑</div>
        <div class="card-content">
          <label class="card-label">停止位</label>
          <CustomSelect
            v-model="config.stopBits"
            :options="stopBitsOptions"
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>

      <div class="config-card">
        <div class="card-icon">🔀</div>
        <div class="card-content">
          <label class="card-label">流控</label>
          <CustomSelect
            v-model="config.flowControl"
            :options="flowControlOptions"
            :disabled="serialStore.isConnected"
          />
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="action-btn secondary" @click="refreshPorts" :disabled="isScanning || serialStore.isConnected">
        <span class="btn-icon" :class="{ spinning: isScanning }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </span>
        <span class="btn-text">{{ isScanning ? '扫描中...' : '扫描串口' }}</span>
      </button>

      <button v-if="!serialStore.isConnected" class="action-btn primary" @click="connect" :disabled="!selectedPort || serialStore.isConnecting">
        <span class="btn-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
        </span>
        <span class="btn-text">{{ serialStore.isConnecting ? '连接中...' : '连接设备' }}</span>
      </button>

      <button v-else class="action-btn danger" @click="disconnect">
        <span class="btn-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18.36 6.64a9 9 0 11-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
        </span>
        <span class="btn-text">断开连接</span>
      </button>
    </div>

    <div class="panel-footer">
      <div class="footer-info">
        <span class="info-dot"></span>
        <span>当前配置: {{ config.baudRate }} / {{ config.dataBits }}{{ parityLabel }}{{ config.stopBits }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import CustomSelect from './CustomSelect.vue';
import { useSerialConnectionStore } from '../stores/serialConnection';
import { MOCK_PORT_NAME, isMockPort, mockSerialReplay } from '../utils/mockSerialReplay';

const serialStore = useSerialConnectionStore();

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
let unlisten: UnlistenFn | null = null;

// 清理数据监听
const cleanupDataListener = async () => {
  if (unlisten) {
    try {
      await unlisten();
      console.log('[ConnectionPanel] 数据监听已清理');
    } catch (e) {
      console.error('[ConnectionPanel] 清理数据监听失败:', e);
    }
    unlisten = null;
  }
};

// 设置数据接收监听
const setupDataListener = async () => {
  if (!isTauriRuntime) return;

  // 如果已经有监听，先清理
  if (unlisten) {
    await cleanupDataListener();
  }
  
  try {
    unlisten = await listen<{ portName: string; data: number[] }>('serial-data', (event) => {
      const { portName, data } = event.payload;
      console.log('[ConnectionPanel] 收到数据:', portName, data);
      // 添加到日志
      serialStore.addLog('rx', data);
    });
    console.log('[ConnectionPanel] 数据监听已设置');
  } catch (_e) {
    console.error('[ConnectionPanel] 设置数据监听失败');
  }
};

const selectedPort = ref('');
const isScanning = ref(false);
const scanError = ref<string | null>(null);

// 实际扫描到的串口列表
interface SerialPortInfo {
  name: string;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  serialNumber: string | null;
}

const portList = ref<SerialPortInfo[]>([]);

const config = ref({
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
});

const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1500000, 2000000];
const dataBits = [5, 6, 7, 8];
const stopBits = [1, 1.5, 2];

const parityOptions = [
  { label: '无', value: 'none' },
  { label: '奇校验', value: 'odd' },
  { label: '偶校验', value: 'even' },
];

const flowControlOptions = [
  { label: '无', value: 'none' },
  { label: '软件流控', value: 'software' },
  { label: '硬件流控', value: 'hardware' },
];

const portOptions = computed(() => {
  if (portList.value.length === 0) {
    return [{ label: '暂无可连接串口', value: '', disabled: true }];
  }
  return portList.value.map(port => ({ 
    label: port.name, 
    value: port.name,
    description: port.manufacturer || undefined
  }));
});

const baudRateOptions = computed(() => {
  return baudRates.map(rate => ({ label: rate.toString(), value: rate }));
});

const dataBitsOptions = computed(() => {
  return dataBits.map(bit => ({ label: bit.toString(), value: bit }));
});

const stopBitsOptions = computed(() => {
  return stopBits.map(sb => ({ label: sb.toString(), value: sb }));
});

const parityLabel = computed(() => {
  const p = parityOptions.find(x => x.value === config.value.parity);
  return p && p.value !== 'none' ? (p.value === 'odd' ? 'O' : 'E') : '';
});

const connectionStatusText = computed(() => {
  if (serialStore.isConnecting) return '连接中...';
  if (serialStore.isConnected) return '已连接';
  return '未连接';
});

const connectionStatusClass = computed(() => {
  if (serialStore.isConnecting) return 'connecting';
  if (serialStore.isConnected) return 'connected';
  return 'disconnected';
});

const refreshPorts = async () => {
  isScanning.value = true;
  scanError.value = null;
  
  try {
    console.log('[ConnectionPanel] 开始扫描串口...');
    
    let ports: SerialPortInfo[] = [];

    if (isTauriRuntime) {
      // Tauri 环境：调用后端 API
      ports = await invoke<SerialPortInfo[]>('list_serial_ports');
      console.log('[ConnectionPanel] Tauri 扫描结果:', ports);
    } else {
      console.log('[ConnectionPanel] 浏览器环境，无法获取真实串口');
    }

    if (ports.length === 0) {
      ports = [{
        name: MOCK_PORT_NAME,
        vid: null,
        pid: null,
        manufacturer: 'Mock Serial Replay',
        serialNumber: null,
      }];
    }
    
    portList.value = ports;
    
    // 如果有串口且当前未选择，自动选择第一个
    if (ports.length > 0 && !selectedPort.value) {
      selectedPort.value = ports[0].name;
      console.log('[ConnectionPanel] 自动选择串口:', ports[0].name);
    }
  } catch (error) {
    const errorMsg = `扫描失败：${error}`;
    scanError.value = errorMsg;
    console.error('[ConnectionPanel] 扫描串口失败:', error);
    portList.value = [];
  } finally {
    isScanning.value = false;
  }
};

// 组件加载时初始化
onMounted(() => {
  refreshPorts();
  
  // 如果已经连接，重新设置数据监听
  if (serialStore.isConnected) {
    setupDataListener();
  }
});

const connect = async () => {
  if (!selectedPort.value) {
    console.warn('[ConnectionPanel] 未选择串口');
    return;
  }
  
  console.log('[ConnectionPanel] 开始连接串口:', selectedPort.value);
  console.log('[ConnectionPanel] 连接参数:', {
    baudRate: config.value.baudRate,
    dataBits: config.value.dataBits,
    parity: config.value.parity,
    stopBits: config.value.stopBits,
    flowControl: config.value.flowControl
  });
  
  serialStore.setConnecting(true);
  
  try {
    const usingMockPort = isMockPort(selectedPort.value);

    if (usingMockPort) {
      console.log('[ConnectionPanel] 使用模拟串口回放模式');
      mockSerialReplay.start((data) => {
        serialStore.addLog('rx', data);
      });
    } else if (isTauriRuntime) {
      console.log('[ConnectionPanel] 调用 Tauri API...');
      // 调用 Tauri 后端打开串口
      const result = await invoke('open_serial_port', {
        config: {
          port_name: selectedPort.value,
          baud_rate: config.value.baudRate,
          data_bits: config.value.dataBits,
          parity: config.value.parity,
          stop_bits: config.value.stopBits,
          flow_control: config.value.flowControl
        }
      });
      console.log('[ConnectionPanel] 串口连接成功:', result);
    } else {
      // 浏览器环境：模拟连接
      console.log('[ConnectionPanel] 模拟连接串口:', selectedPort.value);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 更新状态
    serialStore.setCurrentPort(selectedPort.value);
    serialStore.setPortConfig({
      portName: selectedPort.value,
      baudRate: config.value.baudRate,
      dataBits: config.value.dataBits as 5 | 6 | 7 | 8,
      parity: config.value.parity as 'none' | 'odd' | 'even',
      stopBits: config.value.stopBits as 1 | 1.5 | 2,
      flowControl: config.value.flowControl as 'none' | 'software' | 'hardware'
    });
    serialStore.setConnected(true);
    console.log('[ConnectionPanel] 连接状态已更新');
    
    // 设置数据监听
    if (!usingMockPort) {
      await setupDataListener();
    }
  } catch (error) {
    console.error('[ConnectionPanel] 连接串口失败:', error);
    alert(`连接失败: ${error}`);
  } finally {
    serialStore.setConnecting(false);
  }
};

const disconnect = async () => {
  try {
    const isCurrentMockPort = isMockPort(serialStore.currentPort);

    // 先清理数据监听
    await cleanupDataListener();
    
    if (isCurrentMockPort) {
      mockSerialReplay.stop();
    } else if (isTauriRuntime && serialStore.currentPort) {
      // 调用 Tauri 后端关闭串口
      await invoke('close_serial_port', {
        portName: serialStore.currentPort
      });
      console.log('[ConnectionPanel] 串口断开成功:', serialStore.currentPort);
    } else {
      // 浏览器环境：模拟断开
      console.log('[ConnectionPanel] 模拟断开串口');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('[ConnectionPanel] 断开串口失败:', error);
  } finally {
    serialStore.setConnected(false);
    serialStore.setCurrentPort('');
  }
};

// 组件卸载时只清理监听，保持连接
onUnmounted(() => {
  cleanupDataListener();
  // 注意：不在此处断开连接，允许切换页面时保持连接
  // 连接只在用户点击断开按钮或应用关闭时断开
});
</script>

<style scoped>
.connection-panel {
  background: linear-gradient(145deg, var(--bg-secondary, #1a1f2e) 0%, var(--bg-tertiary, #151922) 100%);
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  min-width: 0;
}

.panel-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 30%, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
  pointer-events: none;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  position: relative;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  min-width: 0;
}

.status-wrapper {
  flex-shrink: 0;
  margin-left: 16px;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary-color, #06b6d4) 0%, var(--primary-dark, #0891b2) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.icon-svg {
  width: 24px;
  height: 24px;
  color: white;
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.panel-subtitle {
  font-size: 11px;
  color: var(--text-tertiary, #666);
  margin: 0;
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary, #1e2433);
  border-radius: 24px;
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  transition: all 0.3s ease;
  white-space: nowrap;
  max-width: 120px;
}

.status-indicator.connecting {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.status-indicator.connected {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary, #666);
  transition: all 0.3s ease;
}

.status-indicator.connecting .status-dot {
  background: #f59e0b;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.status-indicator.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #aaa);
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-indicator.connecting .status-text {
  color: #f59e0b;
}

.status-indicator.connected .status-text {
  color: #22c55e;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
  min-width: 0;
}

.config-card {
  background: var(--bg-tertiary, #1e2433);
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  transition: all 0.25s ease;
}

.config-card:hover {
  border-color: var(--border-hover, rgba(255,255,255,var(--card-hover-border-opacity, 0.12)));
  transform: translateY(-2px);
  box-shadow: var(--card-hover-shadow, 0 4px 12px rgba(0, 0, 0, 0.2));
}

.config-card.main-card {
  grid-column: span 1;
  background: linear-gradient(135deg, var(--bg-tertiary, #1e2433) 0%, rgba(6, 182, 212, 0.08) 100%);
  border-color: rgba(6, 182, 212, 0.2);
}

.config-card.main-card:hover {
  border-color: var(--primary-color, rgba(6, 182, 212, var(--card-hover-border-opacity, 0.15)));
  box-shadow: var(--card-hover-shadow, 0 4px 20px rgba(6, 182, 212, 0.15));
}

.card-icon {
  font-size: 18px;
  opacity: 0.9;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.card-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary, #888);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.action-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--primary-color, #06b6d4) 0%, var(--primary-dark, #0891b2) 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(6, 182, 212, 0.35);
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(6, 182, 212, 0.45);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn.secondary {
  background: var(--bg-elevated, #252d3d);
  color: var(--text-secondary, #ccc);
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--bg-tertiary, #2a3447);
  border-color: var(--border-hover, rgba(255,255,255,0.15));
  color: var(--text-primary, #fff);
  transform: translateY(-2px);
}

.action-btn.danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.35);
}

.action-btn.danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(239, 68, 68, 0.45);
}

.btn-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon svg {
  width: 100%;
  height: 100%;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinning {
  animation: spin 1s linear infinite;
}

.panel-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary, #666);
}

.info-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color, #06b6d4);
}
</style>
