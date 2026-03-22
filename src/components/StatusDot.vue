<template>
  <span
    class="status-dot"
    :class="statusClass"
    :title="statusText"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

type StatusType = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

const props = defineProps<{
  status: StatusType;
}>();

const statusClass = computed(() => {
  const map: Record<StatusType, string> = {
    connected: 'connected',
    connecting: 'reconnecting',
    disconnected: 'disconnected',
    reconnecting: 'reconnecting',
  };
  return map[props.status];
});

const statusText = computed(() => {
  const map: Record<StatusType, string> = {
    connected: '已连接',
    connecting: '连接中...',
    disconnected: '已断开',
    reconnecting: '重连中...',
  };
  return map[props.status];
});
</script>

<style scoped>
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: relative;
  display: inline-block;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

/* 已连接状态 - 青蓝色柔和呼吸 */
.status-dot.connected {
  --status-color: #14b8a6;
  background: var(--status-color);
  animation: breathe-teal 2s ease-in-out infinite;
}

@keyframes breathe-teal {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 4px var(--status-color), 0 0 8px var(--status-color), 0 0 12px var(--status-color);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
    box-shadow: 0 0 2px var(--status-color), 0 0 4px var(--status-color);
  }
}

/* 重连中/连接中状态 - 橙色旋转渐变 */
.status-dot.reconnecting {
  background: transparent;
  position: relative;
}

.status-dot.reconnecting::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b);
  animation: spin-gradient 1.5s linear infinite;
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
}

.status-dot.reconnecting::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #f59e0b;
  animation: reconnect-pulse 1.5s ease-in-out infinite;
}

@keyframes spin-gradient {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes reconnect-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
  }
}

/* 断开状态 - 灰色静止 */
.status-dot.disconnected {
  background: #6b7280;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
