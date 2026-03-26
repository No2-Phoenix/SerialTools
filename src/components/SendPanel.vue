<template>
  <div class="send-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>📤</span>
        <span>数据发送</span>
      </div>
      <div class="mode-tabs">
        <button 
          class="mode-tab" 
          :class="{ active: sendMode === 'ascii' }"
          @click="sendMode = 'ascii'"
        >ASCII</button>
        <button 
          class="mode-tab" 
          :class="{ active: sendMode === 'hex' }"
          @click="sendMode = 'hex'"
        >HEX</button>
      </div>
    </div>

    <div class="input-area">
      <div style="position: relative;">
        <textarea 
          v-model="inputData"
          class="data-input" 
          placeholder="输入要发送的数据..."
          :disabled="!serialStore.isConnected"
        ></textarea>
        <span class="input-meta">{{ inputLength }} / 1024</span>
      </div>
    </div>

    <div class="send-options">
      <label class="checkbox-wrapper">
        <input type="checkbox" v-model="autoNewline" :disabled="!serialStore.isConnected" />
        <span>自动添加换行符</span>
      </label>
      <div class="interval-input">
        <span class="interval-label">周期:</span>
        <input 
          type="number" 
          class="number-input" 
          v-model="interval" 
          min="100"
          max="10000"
          placeholder="100-10000"
          :disabled="!serialStore.isConnected"
        />
        <span class="unit">ms</span>
      </div>
      <label class="checkbox-wrapper">
        <input type="checkbox" v-model="enableTiming" :disabled="!serialStore.isConnected" />
        <span>定时发送</span>
      </label>
    </div>

    <div class="action-row">
      <button class="btn btn-ghost" @click="clearHistory">🗑️ 清空</button>
      <button 
        class="btn" 
        :class="isSending ? 'btn-danger' : 'btn-primary'"
        @click="toggleSending"
        :disabled="!canSend"
      >
        {{ isSending ? '⏹️ 停止' : '📤 发送' }}
      </button>
    </div>

    <div v-if="!serialStore.isConnected" class="connection-hint">
      <span class="hint-icon">⚠️</span>
      <span class="hint-text">请先连接串口</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useSerialConnectionStore } from '../stores/serialConnection';
import { isMockPort, mockSerialReplay } from '../utils/mockSerialReplay';

const serialStore = useSerialConnectionStore();
const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const sendMode = ref<'ascii' | 'hex'>('ascii');
const autoNewline = ref(false);
const enableTiming = ref(false);
const interval = ref(1000);
const isSending = ref(false);
const inputData = ref('');

let timerId: number | null = null;

// 计算输入长度
const inputLength = computed(() => {
  if (sendMode.value === 'hex') {
    // HEX 模式：计算字节数
    const hexStr = inputData.value.replace(/\s/g, '');
    return Math.floor(hexStr.length / 2);
  }
  return inputData.value.length;
});

// 是否可以发送
const canSend = computed(() => {
  return serialStore.isConnected && inputData.value.trim().length > 0;
});

// 解析输入数据为字节数组
const parseInputData = (): number[] | null => {
  if (sendMode.value === 'hex') {
    // HEX 模式：解析十六进制字符串
    const hexStr = inputData.value.replace(/\s/g, '');
    if (hexStr.length === 0) return [];
    if (!/^[0-9A-Fa-f]+$/.test(hexStr)) {
      console.warn('[SendPanel] HEX 输入包含非法字符');
      return null;
    }
    if (hexStr.length % 2 !== 0) {
      console.warn('[SendPanel] HEX 输入长度必须为偶数');
      return null;
    }
    const bytes: number[] = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      const byte = parseInt(hexStr.slice(i, i + 2), 16);
      bytes.push(byte);
    }
    return bytes;
  } else {
    // ASCII 模式：转换为字节数组
    const text = autoNewline.value ? inputData.value + '\r\n' : inputData.value;
    return Array.from(text).map(char => char.charCodeAt(0));
  }
};

// 发送数据
const sendData = async () => {
  if (!serialStore.isConnected || !inputData.value.trim()) {
    return;
  }

  const data = parseInputData();
  if (!data) {
    return;
  }
  if (data.length === 0) {
    console.warn('[SendPanel] 没有数据可发送');
    return;
  }

  try {
    if (isMockPort(serialStore.currentPort)) {
      mockSerialReplay.injectResponse(data);
    } else if (isTauriRuntime) {
      // 调用 Tauri 后端发送数据
      await invoke('send_serial_data', {
        portName: serialStore.currentPort,
        data: data
      });
      console.log('[SendPanel] 数据发送成功:', data);
    } else {
      // 浏览器环境：模拟发送
      console.log('[SendPanel] 模拟发送数据:', data);
    }

    // 添加到日志
    serialStore.addLog('tx', data);
  } catch (error) {
    console.error('[SendPanel] 发送数据失败:', error);
    stopSending();
  }
};

const startSending = () => {
  if (!canSend.value) return;

  isSending.value = true;

  if (enableTiming.value && interval.value && interval.value > 0) {
    // 定时发送 - 不清空输入框
    sendData();
    timerId = window.setInterval(() => {
      sendData();
    }, interval.value);
  } else {
    // 单次发送 - 发送后清空输入框
    sendData();
    inputData.value = '';
    isSending.value = false;
  }
};

const stopSending = () => {
  isSending.value = false;

  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
};

const toggleSending = () => {
  if (isSending.value) {
    stopSending();
  } else {
    startSending();
  }
};

const clearHistory = () => {
  inputData.value = '';
};

// 监听定时设置变化
watch(enableTiming, (newVal) => {
  if (!newVal && timerId !== null) {
    stopSending();
  }
});

// 监听间隔变化
watch(interval, () => {
  if (isSending.value && enableTiming.value && timerId !== null) {
    // 重新设置定时器
    stopSending();
    startSending();
  }
});

// 监听连接状态变化
watch(() => serialStore.isConnected, (connected) => {
  if (!connected && isSending.value) {
    stopSending();
  }
});

// 组件卸载时清理定时器
onUnmounted(() => {
  stopSending();
});
</script>

<style scoped>
.send-panel {
  background: var(--bg-secondary, #1a1f2e);
  border: 1px solid var(--border-default, #333);
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle, #444);
  flex-wrap: wrap;
  gap: 8px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-tertiary, #252a36);
  border-radius: 8px;
  border: 1px solid var(--border-default, #333);
}

.mode-tab {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary, #888);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.mode-tab:hover {
  color: var(--text-secondary, #ccc);
}

.mode-tab.active {
  background: var(--bg-elevated, #2a2f3e);
  color: var(--text-primary, #fff);
}

.mode-tab:focus {
  box-shadow: 0 0 0 2px var(--primary-color, #06b6d4);
}

.input-area {
  margin-bottom: 12px;
}

.data-input {
  width: 100%;
  min-height: 80px;
  padding: 12px 14px;
  padding-bottom: 28px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary, #fff);
  background: var(--bg-primary, #0a0c10);
  border: 1px solid var(--border-default, #333);
  border-radius: 8px;
  resize: vertical;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.data-input:focus {
  border-color: var(--primary-color, #06b6d4);
}

.data-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.data-input::placeholder {
  color: var(--text-tertiary, #888);
}

.input-meta {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 11px;
  color: var(--text-tertiary, #888);
  pointer-events: none;
}

.send-options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #ccc);
  cursor: pointer;
  user-select: none;
}

.checkbox-wrapper input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color, #06b6d4);
  cursor: pointer;
}

.checkbox-wrapper input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.interval-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.interval-label {
  font-size: 12px;
  color: var(--text-secondary, #ccc);
}

.number-input {
  width: 70px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary, #fff);
  background: var(--bg-primary, #0a0c10);
  border: 1px solid var(--border-default, #333);
  border-radius: 6px;
  outline: none;
}

.number-input:focus {
  border-color: var(--primary-color, #06b6d4);
}

.number-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.unit {
  font-size: 11px;
  color: var(--text-tertiary, #888);
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color, #06b6d4), var(--primary-color-dark, #0891b2));
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary, #ccc);
  border: 1px solid var(--border-default, #333);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg-tertiary, #252a36);
  color: var(--text-primary, #fff);
}

.connection-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 6px;
}

.hint-icon {
  font-size: 14px;
}

.hint-text {
  font-size: 12px;
  color: #eab308;
}
</style>
