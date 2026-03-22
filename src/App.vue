<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeStore.naiveThemeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-loading-bar-provider>
          <AppLayout />
        </n-loading-bar-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { darkTheme, lightTheme } from 'naive-ui';
import { useThemeStore } from './stores/theme';
import AppLayout from './layouts/AppLayout.vue';

const themeStore = useThemeStore();

// 根据当前主题选择 naive-ui 主题
const naiveTheme = computed(() => {
  // light, arctic, sakura, lavender 主题使用 lightTheme
  const lightThemes = ['light', 'arctic', 'sakura', 'lavender'];
  return lightThemes.includes(themeStore.currentTheme) ? lightTheme : darkTheme;
});

// 初始化主题 - 在挂载前执行
themeStore.initTheme();

// 监听主题变化，更新 document 主题
watch(() => themeStore.currentTheme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme);
}, { immediate: true });

onMounted(() => {
  // 确保主题已应用
  document.documentElement.setAttribute('data-theme', themeStore.currentTheme);
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  /* 应用主题背景渐变 */
  background: var(--bg-gradient, #0a0c10);
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg-gradient, #0a0c10);
  color: var(--text-primary, #f0f4f8);
  min-height: 100vh;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-gradient, #0a0c10);
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--text-muted, #4a5568);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary, #7a8a9a);
}

/* 选中文字样式 */
::selection {
  background: var(--primary-color, #06b6d4);
  color: white;
}

/* 禁用文本选择（特定元素） */
.no-select {
  user-select: none;
}

/* 等宽字体 */
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
</style>
