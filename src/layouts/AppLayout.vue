<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue';
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-gradient);
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
</style>
