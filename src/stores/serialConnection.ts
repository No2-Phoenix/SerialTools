import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export interface SerialPortInfo {
  name: string;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  serialNumber: string | null;
}

export interface PortConfig {
  portName: string;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  parity: 'none' | 'odd' | 'even';
  stopBits: 1 | 1.5 | 2;
  flowControl: 'none' | 'software' | 'hardware';
}

export interface LogEntry {
  id: number;
  timestamp: number;
  type: 'tx' | 'rx';
  data: number[];
  displayMode: 'ascii' | 'hex';
}

export const useSerialConnectionStore = defineStore('serialConnection', () => {
  const MAX_LOG_ENTRIES = 5000;

  // 状态
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const currentPort = ref<string>('');
  const portConfig = ref<PortConfig | null>(null);
  const logs = ref<LogEntry[]>([]);
  const txCount = ref(0);
  const rxCount = ref(0);
  const isReceiving = ref(true); // 是否接收数据
  let logIdCounter = 0;

  // Getters
  const logCount = computed(() => logs.value.length);
  
  const asciiLogs = computed(() => {
    return logs.value.map(log => ({
      ...log,
      text: log.data.map(b => String.fromCharCode(b)).join('')
    }));
  });

  const hexLogs = computed(() => {
    return logs.value.map(log => ({
      ...log,
      text: log.data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    }));
  });

  // Actions
  const setConnected = (connected: boolean) => {
    isConnected.value = connected;
  };

  const setConnecting = (connecting: boolean) => {
    isConnecting.value = connecting;
  };

  const setCurrentPort = (port: string) => {
    currentPort.value = port;
  };

  const setPortConfig = (config: PortConfig) => {
    portConfig.value = config;
  };

  const addLog = (type: 'tx' | 'rx', data: number[]) => {
    // 如果是接收数据且暂停接收，则不添加日志
    if (type === 'rx' && !isReceiving.value) {
      return;
    }
    
    const entry: LogEntry = {
      id: ++logIdCounter,
      timestamp: Date.now(),
      type,
      data,
      displayMode: 'ascii'
    };
    logs.value.push(entry);

    if (logs.value.length > MAX_LOG_ENTRIES) {
      logs.value.splice(0, logs.value.length - MAX_LOG_ENTRIES);
    }
    
    if (type === 'tx') {
      txCount.value += data.length;
    } else {
      rxCount.value += data.length;
    }
  };
  
  const setReceiving = (receiving: boolean) => {
    isReceiving.value = receiving;
  };

  const clearLogs = () => {
    logs.value = [];
    txCount.value = 0;
    rxCount.value = 0;
  };

  const reset = () => {
    isConnected.value = false;
    isConnecting.value = false;
    currentPort.value = '';
    portConfig.value = null;
    clearLogs();
  };

  return {
    isConnected,
    isConnecting,
    currentPort,
    portConfig,
    logs,
    txCount,
    rxCount,
    logCount,
    isReceiving,
    asciiLogs,
    hexLogs,
    setConnected,
    setConnecting,
    setCurrentPort,
    setPortConfig,
    addLog,
    clearLogs,
    setReceiving,
    reset
  };
});
