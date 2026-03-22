<template>
  <div class="terminal-view">
    <div class="connection-section">
      <ConnectionPanel />
    </div>
    <div class="log-section">
      <LogPanel />
    </div>
    <div class="send-section">
      <SendPanel />
    </div>
  </div>
</template>

<style scoped>
.terminal-view {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap, 12px);
  padding: var(--content-padding, 12px);
  background: var(--bg-primary, #0a0c10);
  min-width: 0;
}

.connection-section {
  flex-shrink: 0;
}

.log-section {
  flex-shrink: 0;
  min-height: 120px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.send-section {
  flex-shrink: 0;
}
</style>

<script setup lang="ts">
import ConnectionPanel from '../components/ConnectionPanel.vue';
import LogPanel from '../components/LogPanel.vue';
import SendPanel from '../components/SendPanel.vue';
</script>
