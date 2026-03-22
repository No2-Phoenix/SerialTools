<template>
  <div class="log-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span>📋</span>
        <span>数据日志</span>
        <span class="log-count">{{ serialStore.logCount }} 条</span>
      </div>
      <div class="panel-actions">
        <button 
          class="btn btn-ghost" 
          @click="toggleReceiving" 
          :title="isReceiving ? '停止接收' : '开始接收'"
          :class="{ 'btn-paused': !isReceiving }"
        >
          {{ isReceiving ? '⏸️' : '▶️' }}
        </button>
        <div class="mode-tabs">
          <button 
            class="mode-tab" 
            :class="{ active: displayMode === 'ascii' }"
            @click="displayMode = 'ascii'"
          >ASCII</button>
          <button 
            class="mode-tab" 
            :class="{ active: displayMode === 'hex' }"
            @click="displayMode = 'hex'"
          >HEX</button>
        </div>
        <button class="btn btn-ghost" @click="clearLogs" title="清空日志">🗑️</button>
        <button class="btn btn-secondary" @click="exportLogs" title="导出日志">📥 导出</button>
      </div>
    </div>

    <div class="log-container" ref="logContainer">
      <div v-if="serialStore.logCount === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-text">暂无数据</p>
        <p class="empty-hint">连接串口后将显示通信数据</p>
      </div>
      
      <div v-else class="log-list">
        <div 
          v-for="log in displayLogs" 
          :key="log.id"
          class="log-entry"
          :class="log.type"
        >
          <div class="log-header">
            <span class="log-type-badge" :class="log.type">
              {{ log.type === 'tx' ? '发送' : '接收' }}
            </span>
            <span v-if="showTimestamp" class="log-timestamp">
              {{ formatTime(log.timestamp) }}
            </span>
          </div>
          <div class="log-content">
            <pre class="log-data">{{ formatData(log) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <div class="footer-left">
        <label class="checkbox-wrapper">
          <input type="checkbox" v-model="showTimestamp" />
          <span>时间戳</span>
        </label>
        <label class="checkbox-wrapper">
          <input type="checkbox" v-model="autoScroll" />
          <span>自动滚动</span>
        </label>
      </div>
      <div class="footer-right">
        <span class="stats-item">
          <span class="stats-dot tx"></span>
          TX: {{ serialStore.txCount }}
        </span>
        <span class="stats-item">
          <span class="stats-dot rx"></span>
          RX: {{ serialStore.rxCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useSerialConnectionStore } from '../stores/serialConnection';
import type { LogEntry } from '../stores/serialConnection';

const serialStore = useSerialConnectionStore();

const displayMode = ref<'ascii' | 'hex'>('ascii');
const showTimestamp = ref(true);
const autoScroll = ref(true);
const logContainer = ref<HTMLElement | null>(null);

// 使用 store 中的接收状态
const isReceiving = computed({
  get: () => serialStore.isReceiving,
  set: (value) => serialStore.setReceiving(value)
});

// 显示的日志
const displayLogs = computed(() => {
  return serialStore.logs.map(log => ({
    ...log,
    displayText: displayMode.value === 'hex' 
      ? log.data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
      : log.data.map(b => {
          const char = String.fromCharCode(b);
          // 显示可打印字符，不可打印字符显示为 .
          return b >= 32 && b < 127 ? char : '.';
        }).join('')
  }));
});

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 格式化数据
const formatData = (log: LogEntry & { displayText: string }): string => {
  return log.displayText;
};

// 清空日志
const clearLogs = () => {
  serialStore.clearLogs();
};

// 导出日志
const exportLogs = () => {
  const content = serialStore.logs.map(log => {
    const time = formatTime(log.timestamp);
    const type = log.type === 'tx' ? 'TX' : 'RX';
    const data = log.data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    return `[${time}] ${type}: ${data}`;
  }).join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `serial-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// 切换接收状态
const toggleReceiving = () => {
  isReceiving.value = !isReceiving.value;
};

// 自动滚动到底部
watch(() => serialStore.logCount, () => {
  if (autoScroll.value && logContainer.value) {
    nextTick(() => {
      logContainer.value!.scrollTop = logContainer.value!.scrollHeight;
    });
  }
});

// 暴露接收状态给父组件
defineExpose({
  isReceiving
});
</script>

<style scoped>
.log-panel {
  background: var(--bg-secondary, #1a1f2e);
  border: 1px solid var(--border-default, #333);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle, #444);
  background: var(--bg-tertiary, #252a36);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.log-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary, #888);
  background: var(--bg-primary, #0a0c10);
  padding: 2px 8px;
  border-radius: 10px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-primary, #0a0c10);
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

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary, #ccc);
  border: 1px solid var(--border-default, #333);
}

.btn-ghost:hover {
  background: var(--bg-tertiary, #252a36);
  color: var(--text-primary, #fff);
}

.btn-ghost.btn-paused {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.btn-secondary {
  background: var(--bg-tertiary, #252a36);
  color: var(--text-primary, #fff);
  border: 1px solid var(--border-default, #333);
}

.btn-secondary:hover {
  background: var(--bg-elevated, #2a2f3e);
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  background: var(--bg-primary, #0a0c10);
  min-height: 100px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 150px;
  color: var(--text-tertiary, #888);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-entry {
  padding: 10px 12px;
  border-radius: 8px;
  border-left: 3px solid;
  background: var(--bg-secondary, #1a1f2e);
}

.log-entry.tx {
  border-left-color: #06b6d4;
  background: rgba(6, 182, 212, 0.05);
}

.log-entry.rx {
  border-left-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.log-type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.log-type-badge.tx {
  background: rgba(6, 182, 212, 0.2);
  color: #06b6d4;
}

.log-type-badge.rx {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.log-timestamp {
  font-size: 11px;
  color: var(--text-tertiary, #888);
  font-family: 'JetBrains Mono', monospace;
}

.log-content {
  overflow-x: auto;
}

.log-data {
  margin: 0;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary, #fff);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border-subtle, #444);
  background: var(--bg-tertiary, #252a36);
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16px;
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
  width: 14px;
  height: 14px;
  accent-color: var(--primary-color, #06b6d4);
  cursor: pointer;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #ccc);
  font-family: 'JetBrains Mono', monospace;
}

.stats-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stats-dot.tx {
  background: #06b6d4;
}

.stats-dot.rx {
  background: #10b981;
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: var(--bg-primary, #0a0c10);
}

.log-container::-webkit-scrollbar-thumb {
  background: var(--border-default, #333);
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover, #444);
}
</style>
