<template>
  <div class="waveform-view">
    <div class="waveform-main">
      <div class="panel-header">
        <div class="panel-title">
          <Activity class="title-icon" />
          <span>实时波形</span>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary" :disabled="!isConnected" @click="toggleCapture">
            <Pause v-if="isCapturing" class="btn-icon" />
            <Play v-else class="btn-icon" />
            <span>{{ isCapturing ? '暂停' : '开始' }}</span>
          </button>
          <button class="btn btn-ghost" @click="clearWaveform" title="清空">
            <Trash2 class="btn-icon" />
          </button>
        </div>
      </div>

      <div class="waveform-container">
        <div v-if="!hasData" class="empty-placeholder">
          <Activity class="empty-icon" />
          <p>暂无波形数据</p>
          <p class="empty-hint">连接串口并开始接收数据后，波形将在此实时显示</p>
        </div>
        <canvas v-else ref="canvasRef" class="waveform-canvas"></canvas>
      </div>
    </div>

    <div class="channel-panel">
      <div class="panel-header">
        <div class="panel-title">
          <SlidersHorizontal class="title-icon" />
          <span>通道配置</span>
        </div>
      </div>

      <div class="channel-list">
        <div v-for="i in 4" :key="i" class="channel-item">
          <div class="channel-color" :style="{ background: channelColors[i-1] }"></div>
          <div class="channel-info">
            <span class="channel-name">通道 {{ i }}</span>
            <span class="channel-status">未配置</span>
          </div>
          <button class="channel-toggle">
            <Eye class="toggle-icon" />
          </button>
        </div>
      </div>

      <div class="channel-settings">
        <div class="setting-group">
          <label class="setting-label">采样率</label>
          <select class="setting-select">
            <option>1 kHz</option>
            <option>10 kHz</option>
            <option>100 kHz</option>
          </select>
        </div>
        <div class="setting-group">
          <label class="setting-label">时间基准</label>
          <select class="setting-select">
            <option>10 ms/div</option>
            <option>100 ms/div</option>
            <option>1 s/div</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Activity, Play, Pause, Trash2, SlidersHorizontal, Eye } from 'lucide-vue-next';
import { useDeviceStore } from '../stores/device';

const deviceStore = useDeviceStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isCapturing = ref(false);
const hasData = ref(false);

const isConnected = computed(() => deviceStore.activeConnections.size > 0);

const channelColors = ['#0ea5c7', '#22c55e', '#f59e0b', '#8b5cf6'];

const toggleCapture = () => {
  isCapturing.value = !isCapturing.value;
  if (isCapturing.value) {
    hasData.value = true;
  }
};

const clearWaveform = () => {
  hasData.value = false;
  isCapturing.value = false;
};
</script>

<style scoped>
.waveform-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.waveform-main {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.title-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5;
  color: var(--primary-color);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-ghost {
  background: transparent;
  color: var(--text-tertiary);
  padding: 6px;
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.waveform-container {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-placeholder {
  text-align: center;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-placeholder p {
  margin: 4px 0;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
}

.channel-panel {
  height: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.channel-list {
  display: flex;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.channel-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.channel-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.channel-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.channel-status {
  font-size: 10px;
  color: var(--text-tertiary);
}

.channel-toggle {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.channel-toggle:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.toggle-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

.channel-settings {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.setting-select {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  outline: none;
  cursor: pointer;
  min-width: 100px;
}

.setting-select:focus {
  border-color: var(--primary-color);
}
</style>
