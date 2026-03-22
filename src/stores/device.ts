import { ref } from 'vue';
import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

export const useDeviceStore = defineStore('device', () => {
  const availablePorts = ref<SerialPortInfo[]>([]);
  const activeConnections = ref<Map<string, PortConfig>>(new Map());
  const isScanning = ref(false);
  const error = ref<string | null>(null);

  const scanPorts = async () => {
    isScanning.value = true;
    error.value = null;
    try {
      const ports = await invoke<SerialPortInfo[]>('list_serial_ports');
      availablePorts.value = ports;
    } catch (e) {
      error.value = String(e);
      console.error('Failed to scan ports:', e);
    } finally {
      isScanning.value = false;
    }
  };

  const openPort = async (config: PortConfig) => {
    error.value = null;
    try {
      await invoke('open_serial_port', { config });
      activeConnections.value.set(config.portName, config);
    } catch (e) {
      error.value = String(e);
      console.error('Failed to open port:', e);
      throw e;
    }
  };

  const closePort = async (portName: string) => {
    error.value = null;
    try {
      await invoke('close_serial_port', { portName });
      activeConnections.value.delete(portName);
    } catch (e) {
      error.value = String(e);
      console.error('Failed to close port:', e);
      throw e;
    }
  };

  const sendData = async (portName: string, data: number[]) => {
    try {
      await invoke('send_serial_data', { portName, data });
    } catch (e) {
      console.error('Failed to send data:', e);
      throw e;
    }
  };

  const setupEventListeners = () => {
    listen<SerialPortInfo>('device-plugged', (event) => {
      const port = event.payload;
      if (!availablePorts.value.find((p) => p.name === port.name)) {
        availablePorts.value.push(port);
      }
    });

    listen<string>('device-unplugged', (event) => {
      const portName = event.payload;
      availablePorts.value = availablePorts.value.filter((p) => p.name !== portName);
      if (activeConnections.value.has(portName)) {
        activeConnections.value.delete(portName);
      }
    });
  };

  return {
    availablePorts,
    activeConnections,
    isScanning,
    error,
    scanPorts,
    openPort,
    closePort,
    sendData,
    setupEventListeners,
  };
});
