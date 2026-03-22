import { ref } from 'vue';
import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';

export interface Payload {
  id: string;
  name: string;
  data: number[];
  format: 'hex' | 'ascii';
  description?: string;
  category?: string;
  hotkey?: string;
}

export interface PayloadSequence {
  id: string;
  name: string;
  payloads: {
    payloadId: string;
    delayMs: number;
  }[];
  repeatCount: number;
  intervalMs: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const usePayloadStore = defineStore('payload', () => {
  const payloads = ref<Payload[]>([]);
  const sequences = ref<PayloadSequence[]>([]);
  const isSending = ref(false);
  const sendProgress = ref(0);

  const addPayload = (payload: Omit<Payload, 'id'>) => {
    const id = `payload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    payloads.value.push({ ...payload, id });
    saveToLocalStorage();
  };

  const updatePayload = (id: string, updates: Partial<Payload>) => {
    const index = payloads.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      payloads.value[index] = { ...payloads.value[index], ...updates };
      saveToLocalStorage();
    }
  };

  const deletePayload = (id: string) => {
    payloads.value = payloads.value.filter((p) => p.id !== id);
    saveToLocalStorage();
  };

  const sendPayload = async (portName: string, payload: Payload) => {
    const data =
      payload.format === 'hex'
        ? new Uint8Array(payload.data)
        : new TextEncoder().encode(payload.data.map((c) => String.fromCharCode(c)).join(''));

    await invoke('send_serial_data', {
      portName,
      data: Array.from(data),
    });
  };

  const executeSequence = async (portName: string, sequence: PayloadSequence) => {
    isSending.value = true;
    sendProgress.value = 0;

    try {
      const totalSteps = sequence.repeatCount * sequence.payloads.length;
      let currentStep = 0;

      for (let i = 0; i < sequence.repeatCount; i++) {
        for (const item of sequence.payloads) {
          const payload = payloads.value.find((p) => p.id === item.payloadId);
          if (payload) {
            await sendPayload(portName, payload);
            await sleep(item.delayMs);
          }
          currentStep++;
          sendProgress.value = Math.round((currentStep / totalSteps) * 100);
        }
        if (i < sequence.repeatCount - 1) {
          await sleep(sequence.intervalMs);
        }
      }
    } finally {
      isSending.value = false;
      sendProgress.value = 0;
    }
  };

  const exportPayloads = async () => {
    const content = JSON.stringify(
      { payloads: payloads.value, sequences: sequences.value },
      null,
      2
    );
    await invoke('save_file', { content, defaultName: 'payloads.json' });
  };

  const importPayloads = (jsonContent: string) => {
    try {
      const data = JSON.parse(jsonContent);
      if (data.payloads) {
        payloads.value = data.payloads;
      }
      if (data.sequences) {
        sequences.value = data.sequences;
      }
      saveToLocalStorage();
      return true;
    } catch (e) {
      console.error('Failed to import payloads:', e);
      return false;
    }
  };

  const saveToLocalStorage = () => {
    localStorage.setItem(
      'greenserial-payloads',
      JSON.stringify({ payloads: payloads.value, sequences: sequences.value })
    );
  };

  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem('greenserial-payloads');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.payloads) payloads.value = data.payloads;
        if (data.sequences) sequences.value = data.sequences;
      } catch (e) {
        console.error('Failed to load payloads:', e);
      }
    }
  };

  loadFromLocalStorage();

  return {
    payloads,
    sequences,
    isSending,
    sendProgress,
    addPayload,
    updatePayload,
    deletePayload,
    sendPayload,
    executeSequence,
    exportPayloads,
    importPayloads,
  };
});
