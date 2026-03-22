import { ref } from 'vue';
import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';

export interface LogEntry {
  id: number;
  timestamp: number;
  portName: string;
  direction: 'tx' | 'rx';
  data: Uint8Array;
  isBookmarked?: boolean;
  tags?: string[];
}

export interface LogFilter {
  portNames?: string[];
  direction?: ('tx' | 'rx')[];
  searchPattern?: string;
  timeRange?: [number, number];
}

export const useLogStore = defineStore('log', () => {
  const logs = ref<LogEntry[]>([]);
  const maxLogCount = 100000;
  const isHexMode = ref(true);
  const showTimestamp = ref(true);
  const showDirection = ref(true);
  const autoScroll = ref(true);
  let logIdCounter = 0;

  const addLog = (entry: Omit<LogEntry, 'id'>) => {
    const id = logIdCounter++;
    logs.value.push({ ...entry, id });

    if (logs.value.length > maxLogCount) {
      logs.value = logs.value.slice(-maxLogCount);
    }
  };

  const clearLogs = () => {
    logs.value = [];
    logIdCounter = 0;
  };

  const exportLogs = async (format: 'txt' | 'csv' | 'json', filter?: LogFilter) => {
    let filteredLogs = logs.value;

    if (filter) {
      filteredLogs = logs.value.filter((log) => {
        if (filter.portNames && !filter.portNames.includes(log.portName)) return false;
        if (filter.direction && !filter.direction.includes(log.direction)) return false;
        if (filter.searchPattern) {
          const pattern = filter.searchPattern.toLowerCase();
          const dataStr = bytesToString(log.data).toLowerCase();
          const hexStr = bytesToHex(log.data).toLowerCase();
          if (!dataStr.includes(pattern) && !hexStr.includes(pattern)) return false;
        }
        return true;
      });
    }

    let content: string;
    switch (format) {
      case 'csv':
        content = logsToCsv(filteredLogs);
        break;
      case 'json':
        content = JSON.stringify(filteredLogs, null, 2);
        break;
      case 'txt':
      default:
        content = logsToTxt(filteredLogs);
        break;
    }

    await invoke('save_file', { content, defaultName: `logs.${format}` });
  };

  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  };

  const bytesToString = (bytes: Uint8Array): string => {
    try {
      return new TextDecoder().decode(bytes);
    } catch {
      return bytesToHex(bytes);
    }
  };

  const logsToTxt = (logs: LogEntry[]): string => {
    return logs
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const dir = log.direction === 'tx' ? 'TX' : 'RX';
        const data = isHexMode.value ? bytesToHex(log.data) : bytesToString(log.data);
        return `[${time}] [${dir}] ${data}`;
      })
      .join('\n');
  };

  const logsToCsv = (logs: LogEntry[]): string => {
    const header = 'Timestamp,Direction,Data (Hex),Data (ASCII)\n';
    const rows = logs
      .map((log) => {
        const time = new Date(log.timestamp).toISOString();
        const dir = log.direction;
        const hex = bytesToHex(log.data);
        const ascii = bytesToString(log.data).replace(/"/g, '""');
        return `"${time}","${dir}","${hex}","${ascii}"`;
      })
      .join('\n');
    return header + rows;
  };

  return {
    logs,
    isHexMode,
    showTimestamp,
    showDirection,
    autoScroll,
    addLog,
    clearLogs,
    exportLogs,
    bytesToHex,
    bytesToString,
  };
});
