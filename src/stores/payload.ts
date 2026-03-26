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
const createPayloadId = () => `payload_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
const clampDelay = (value: number, fallback = 0) => {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
};

export interface PayloadImportResult {
  ok: boolean;
  message: string;
  importedPayloads: number;
  importedSequences: number;
}

const isByteArray = (value: unknown): value is number[] => {
  return (
    Array.isArray(value) &&
    value.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
  );
};

const normalizePayload = (raw: unknown): Payload | null => {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<Payload>;
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null;
  }
  if (candidate.format !== 'hex' && candidate.format !== 'ascii') {
    return null;
  }
  if (!isByteArray(candidate.data)) {
    return null;
  }

  const normalized: Payload = {
    id: typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id : createPayloadId(),
    name: candidate.name.trim(),
    format: candidate.format,
    data: candidate.data,
  };

  if (typeof candidate.description === 'string') normalized.description = candidate.description;
  if (typeof candidate.category === 'string') normalized.category = candidate.category;
  if (typeof candidate.hotkey === 'string') normalized.hotkey = candidate.hotkey;

  return normalized;
};

const normalizeSequence = (
  raw: unknown,
  validPayloadIds: Set<string>
): PayloadSequence | null => {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<PayloadSequence>;
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(candidate.payloads)) {
    return null;
  }

  const normalizedItems = candidate.payloads
    .filter((item): item is { payloadId: string; delayMs: number } => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof item.payloadId === 'string' &&
        validPayloadIds.has(item.payloadId)
      );
    })
    .map((item) => ({
      payloadId: item.payloadId,
      delayMs: clampDelay(item.delayMs, 0),
    }));

  if (normalizedItems.length === 0) {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id
      : `sequence_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name: candidate.name.trim(),
    payloads: normalizedItems,
    repeatCount: clampDelay(candidate.repeatCount ?? 1, 1) || 1,
    intervalMs: clampDelay(candidate.intervalMs ?? 0, 0),
  };
};

export const usePayloadStore = defineStore('payload', () => {
  const payloads = ref<Payload[]>([]);
  const sequences = ref<PayloadSequence[]>([]);
  const isSending = ref(false);
  const sendProgress = ref(0);

  const addPayload = (payload: Omit<Payload, 'id'>) => {
    const id = createPayloadId();
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

  const exportPayloads = () => {
    return JSON.stringify(
      { payloads: payloads.value, sequences: sequences.value },
      null,
      2
    );
  };

  const importPayloads = (jsonContent: string): PayloadImportResult => {
    try {
      const parsed = JSON.parse(jsonContent) as {
        payloads?: unknown;
        sequences?: unknown;
      };

      const payloadCandidates = Array.isArray(parsed.payloads) ? parsed.payloads : [];
      const normalizedPayloads = payloadCandidates
        .map(normalizePayload)
        .filter((item): item is Payload => item !== null);

      if (normalizedPayloads.length === 0) {
        return {
          ok: false,
          message: '导入失败：未检测到有效的预设数据',
          importedPayloads: 0,
          importedSequences: 0,
        };
      }

      const validPayloadIds = new Set(normalizedPayloads.map((item) => item.id));
      const sequenceCandidates = Array.isArray(parsed.sequences) ? parsed.sequences : [];
      const normalizedSequences = sequenceCandidates
        .map((item) => normalizeSequence(item, validPayloadIds))
        .filter((item): item is PayloadSequence => item !== null);

      payloads.value = normalizedPayloads;
      sequences.value = normalizedSequences;
      saveToLocalStorage();

      return {
        ok: true,
        message: '导入成功',
        importedPayloads: normalizedPayloads.length,
        importedSequences: normalizedSequences.length,
      };
    } catch (e) {
      console.error('Failed to import payloads:', e);
      return {
        ok: false,
        message: '导入失败：JSON 格式错误',
        importedPayloads: 0,
        importedSequences: 0,
      };
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
