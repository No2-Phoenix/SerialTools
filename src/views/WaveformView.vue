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
        <canvas ref="canvasRef" class="waveform-canvas" />
        <div v-if="!isConnected" class="empty-overlay">
          <Activity class="empty-icon" />
          <p>未连接串口</p>
          <p class="empty-hint">连接设备后可开始采集并显示波形</p>
        </div>
        <div v-else-if="!hasData" class="empty-overlay">
          <Activity class="empty-icon" />
          <p>暂无波形数据</p>
          <p class="empty-hint">点击开始并接收串口数据后，波形将在此实时显示</p>
        </div>
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
        <div v-for="channel in channels" :key="channel.id" class="channel-item">
          <div class="channel-color" :style="{ background: channel.color }"></div>
          <div class="channel-info">
            <span class="channel-name">{{ channel.name }}</span>
            <span class="channel-status">{{ getChannelStatus(channel.points.length) }}</span>
          </div>
          <button class="channel-toggle" @click="toggleChannel(channel.id)" :title="channel.enabled ? '隐藏通道' : '显示通道'">
            <Eye v-if="channel.enabled" class="toggle-icon" />
            <EyeOff v-else class="toggle-icon" />
          </button>
        </div>
      </div>

      <div class="channel-settings">
        <div class="setting-group">
          <label class="setting-label">采样率</label>
          <select v-model.number="sampleRate" class="setting-select">
            <option v-for="item in sampleRateOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="setting-group">
          <label class="setting-label">时间基准</label>
          <select v-model.number="timeBaseMs" class="setting-select">
            <option v-for="item in timeBaseOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="setting-group setting-hint">
          <span>窗口点数：{{ maxPoints }}</span>
          <span>可见通道：{{ visibleChannelCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Activity, Play, Pause, Trash2, SlidersHorizontal, Eye, EyeOff } from 'lucide-vue-next';
import { useSerialConnectionStore } from '../stores/serialConnection';

interface ChannelConfig {
  id: number;
  name: string;
  color: string;
  enabled: boolean;
  points: number[];
}

const serialStore = useSerialConnectionStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isCapturing = ref(false);
const hasData = ref(false);
const sampleRate = ref(1000);
const timeBaseMs = ref(100);

const channels = ref<ChannelConfig[]>([
  { id: 0, name: '通道 1', color: '#0ea5c7', enabled: true, points: [] },
  { id: 1, name: '通道 2', color: '#22c55e', enabled: true, points: [] },
  { id: 2, name: '通道 3', color: '#f59e0b', enabled: true, points: [] },
  { id: 3, name: '通道 4', color: '#8b5cf6', enabled: true, points: [] },
]);

const sampleRateOptions = [
  { label: '1 kHz', value: 1000 },
  { label: '2 kHz', value: 2000 },
  { label: '5 kHz', value: 5000 },
  { label: '10 kHz', value: 10000 },
];

const timeBaseOptions = [
  { label: '10 ms/div', value: 10 },
  { label: '50 ms/div', value: 50 },
  { label: '100 ms/div', value: 100 },
  { label: '500 ms/div', value: 500 },
  { label: '1 s/div', value: 1000 },
];

const isConnected = computed(() => serialStore.isConnected);
const visibleChannelCount = computed(() => channels.value.filter((item) => item.enabled).length);
const maxPoints = computed(() => {
  const totalWindowMs = timeBaseMs.value * 10;
  return Math.max(100, Math.round((totalWindowMs * sampleRate.value) / 1000));
});

let animationFrameId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let processedLogIndex = 0;

const toNormalized = (byte: number): number => {
  return Math.max(0, Math.min(1, byte / 255));
};

const trimChannelPoints = (limit: number) => {
  channels.value = channels.value.map((channel) => {
    if (channel.points.length <= limit) return channel;
    return { ...channel, points: channel.points.slice(-limit) };
  });
};

const appendSample = (values: number[]) => {
  channels.value = channels.value.map((channel, index) => {
    const fallback = values[values.length - 1] ?? 0;
    const value = values[index] ?? fallback;
    return {
      ...channel,
      points: [...channel.points, value],
    };
  });

  trimChannelPoints(maxPoints.value);
  hasData.value = channels.value.some((channel) => channel.points.length > 0);
};

const ingestBytes = (bytes: number[]) => {
  if (bytes.length === 0) return;

  if (bytes.length >= channels.value.length) {
    for (let i = 0; i < bytes.length; i += channels.value.length) {
      const chunk = bytes.slice(i, i + channels.value.length);
      if (chunk.length === 0) continue;
      appendSample(chunk.map(toNormalized));
    }
    return;
  }

  const values = channels.value.map((_, index) => toNormalized(bytes[index % bytes.length]));
  appendSample(values);
};

const processPendingLogs = () => {
  if (!isCapturing.value) return;
  if (processedLogIndex > serialStore.logs.length) {
    processedLogIndex = 0;
  }

  for (let i = processedLogIndex; i < serialStore.logs.length; i++) {
    const log = serialStore.logs[i];
    if (log.type !== 'rx') continue;
    ingestBytes(log.data);
  }

  processedLogIndex = serialStore.logs.length;
};

const getChannelStatus = (pointCount: number) => {
  if (!isCapturing.value) return '等待采集';
  if (pointCount === 0) return '无数据';
  return `${pointCount} 点`;
};

const toggleChannel = (channelId: number) => {
  channels.value = channels.value.map((channel) => {
    if (channel.id !== channelId) return channel;
    return { ...channel, enabled: !channel.enabled };
  });
  renderWaveform();
};

const clearWaveform = () => {
  channels.value = channels.value.map((channel) => ({ ...channel, points: [] }));
  hasData.value = false;
  processedLogIndex = serialStore.logs.length;
  renderWaveform();
};

const toggleCapture = () => {
  if (!isConnected.value) return;

  isCapturing.value = !isCapturing.value;
  if (isCapturing.value) {
    processedLogIndex = Math.max(0, serialStore.logs.length - 200);
    processPendingLogs();
    startRenderLoop();
  } else {
    stopRenderLoop();
  }
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(rect.width * dpr));
  const targetHeight = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 10; i++) {
    const x = (width / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let i = 0; i <= 8; i++) {
    const y = (height / 8) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
};

const drawChannel = (
  ctx: CanvasRenderingContext2D,
  channel: ChannelConfig,
  laneIndex: number,
  laneCount: number,
  width: number,
  height: number
) => {
  if (channel.points.length < 2) return;

  const laneHeight = height / laneCount;
  const laneTop = laneHeight * laneIndex;
  const paddingX = 14;
  const paddingY = 10;
  const drawWidth = Math.max(1, width - paddingX * 2);
  const drawHeight = Math.max(1, laneHeight - paddingY * 2);
  const step = drawWidth / Math.max(1, channel.points.length - 1);

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = channel.color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let i = 0; i < channel.points.length; i++) {
    const x = paddingX + i * step;
    const y = laneTop + paddingY + (1 - channel.points[i]) * drawHeight;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.fillStyle = channel.color;
  ctx.font = "12px 'JetBrains Mono', monospace";
  ctx.fillText(channel.name, paddingX, laneTop + 16);

  ctx.restore();
};

const renderWaveform = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  resizeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  const visibleChannels = channels.value.filter((channel) => channel.enabled);
  if (visibleChannels.length === 0) {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('请至少启用一个通道', width / 2 - 60, height / 2);
    return;
  }

  visibleChannels.forEach((channel, index) => {
    drawChannel(ctx, channel, index, visibleChannels.length, width, height);
  });
};

const startRenderLoop = () => {
  if (animationFrameId !== null) return;

  const loop = () => {
    renderWaveform();
    if (!isCapturing.value) {
      animationFrameId = null;
      return;
    }
    animationFrameId = requestAnimationFrame(loop);
  };

  animationFrameId = requestAnimationFrame(loop);
};

const stopRenderLoop = () => {
  if (animationFrameId === null) return;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
};

watch(() => serialStore.logs.length, processPendingLogs);

watch(maxPoints, (limit) => {
  trimChannelPoints(limit);
  renderWaveform();
});

watch(isConnected, (connected) => {
  if (!connected) {
    isCapturing.value = false;
    stopRenderLoop();
    processedLogIndex = serialStore.logs.length;
  }
});

onMounted(() => {
  nextTick(() => {
    renderWaveform();
    const canvas = canvasRef.value;
    if (!canvas) return;
    resizeObserver = new ResizeObserver(() => renderWaveform());
    resizeObserver.observe(canvas);
  });
});

onUnmounted(() => {
  stopRenderLoop();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
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
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  display: block;
}

.empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-tertiary);
  backdrop-filter: blur(2px);
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-overlay p {
  margin: 4px 0;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

.channel-panel {
  min-height: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.channel-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.channel-item {
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
  min-width: 120px;
}

.setting-select:focus {
  border-color: var(--primary-color);
}

.setting-hint {
  margin-left: auto;
  align-items: flex-end;
  color: var(--text-tertiary);
  font-size: 12px;
}

@media (max-width: 1024px) {
  .channel-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .setting-hint {
    margin-left: 0;
    align-items: flex-start;
  }

  .channel-settings {
    flex-wrap: wrap;
  }
}
</style>
