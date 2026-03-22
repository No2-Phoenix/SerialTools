<template>
  <div style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: var(--bg-tertiary, #333); border-radius: 20px; border: 1px solid var(--border-default, #444);">
    <div
      style="width: 8px; height: 8px; border-radius: 50%; position: relative; flex-shrink: 0;"
      :style="{
        background: status === 'connected' ? 'var(--success-color, #22c55e)' : status === 'connecting' ? 'var(--warning-color, #f59e0b)' : 'var(--text-muted, #666)',
        boxShadow: status === 'connected' ? '0 0 6px var(--success-color, #22c55e), 0 0 12px var(--success-color, #22c55e)' : 'none',
      }"
    />
    <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary, #ccc);">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const props = defineProps<{
  status: ConnectionStatus;
}>();

const statusText = computed(() => {
  switch (props.status) {
    case 'connecting':
      return '连接中...';
    case 'connected':
      return '已连接';
    default:
      return '未连接';
  }
});
</script>
