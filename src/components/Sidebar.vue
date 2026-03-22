<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Logo 区域 -->
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span v-if="!isCollapsed" class="logo-text">GreenSerial</span>
      </div>
      <button class="collapse-btn" @click="toggleCollapse">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path v-if="isCollapsed" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          <path v-else d="M11 17l-5-5 5-5M19 17l-5-5 5-5" />
        </svg>
      </button>
    </div>

    <!-- 导航菜单 -->
    <nav class="nav-menu">
      <router-link
        v-for="route in visibleRoutes"
        :key="route.path"
        :to="route.path"
        :class="['nav-item', { active: $route.path === route.path }]"
      >
        <div class="nav-icon">
          <component :is="getIconComponent(route.meta?.icon as string)" />
        </div>
        <span v-if="!isCollapsed" class="nav-text">{{ route.meta?.title }}</span>
        <div v-if="!isCollapsed && $route.path === route.path" class="active-indicator" />
      </router-link>
    </nav>

    <!-- 底部操作区 -->
    <div class="sidebar-footer">
      <!-- 主题选择器 - 可折叠 -->
      <div class="theme-section" :class="{ expanded: isThemeExpanded }">
        <button class="footer-btn theme-toggle" @click="toggleThemePanel">
          <div class="nav-icon">
            <component :is="getThemeIcon(themeStore.currentTheme)" />
          </div>
          <span v-if="!isCollapsed" class="nav-text">{{ themeStore.themeLabel }}</span>
          <svg 
            v-if="!isCollapsed" 
            class="expand-icon"
            :class="{ rotated: isThemeExpanded }"
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        
        <!-- 主题选项列表 -->
        <Transition name="theme-expand">
          <div v-if="!isCollapsed && isThemeExpanded" class="theme-options">
            <button
              v-for="(config, key) in themeStore.themes"
              :key="key"
              :class="['theme-option', { active: themeStore.currentTheme === key }]"
              @click="selectTheme(key as ThemeType)"
            >
              <div class="theme-icon">
                <component :is="getThemeIcon(key)" />
              </div>
              <span class="theme-label">{{ config.label }}</span>
              <div v-if="themeStore.currentTheme === key" class="theme-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </div>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  Terminal,
  Activity,
  Code2,
  Settings,
  Sun,
  Moon,
  Flower2,
  Droplets,
  Sparkles,
  Palette,
} from 'lucide-vue-next';
import { routes } from '../router';
import { useThemeStore, type ThemeType } from '../stores/theme';

const $route = useRoute();
const themeStore = useThemeStore();

const isCollapsed = ref(false);
const isThemeExpanded = ref(false);

// 过滤掉没有 meta 的路由（如 redirect）
const visibleRoutes = computed(() => routes.filter(route => route.meta));

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  if (isCollapsed.value) {
    isThemeExpanded.value = false;
  }
};

const toggleThemePanel = () => {
  if (!isCollapsed.value) {
    isThemeExpanded.value = !isThemeExpanded.value;
  } else {
    // 折叠状态下直接切换主题
    themeStore.toggleTheme();
  }
};

const selectTheme = (theme: ThemeType) => {
  themeStore.setTheme(theme);
  // 可选：选择后自动收起
  // isThemeExpanded.value = false;
};

const iconMap: Record<string, any> = {
  Terminal,
  Pulse: Activity,
  Code: Code2,
  Settings,
};

const getIconComponent = (iconName: string) => {
  return iconMap[iconName] || Terminal;
};

const themeIconMap: Record<ThemeType, any> = {
  dark: Moon,
  light: Sun,
  sakura: Flower2,
  arctic: Droplets,
  lavender: Sparkles,
};

const getThemeIcon = (theme: string) => {
  return themeIconMap[theme as ThemeType] || Palette;
};
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width, 200px);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg, rgba(21, 25, 33, 0.85));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
  transition: width 0.3s ease;
  position: relative;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed, 64px);
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #0ea5c7), var(--primary-dark, #0d96b5));
  border-radius: 10px;
  color: white;
  flex-shrink: 0;
}

.logo-icon svg {
  width: 18px;
  height: 18px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #f5f6f8);
  white-space: nowrap;
  letter-spacing: -0.3px;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #5a637a);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #b4bac8);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
}

.sidebar.collapsed .collapse-btn {
  position: absolute;
  right: -14px;
  top: 20px;
  background: var(--bg-secondary, #1a1f2b);
  border: 1px solid var(--border-default, rgba(255, 255, 255, 0.08));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Nav Menu */
.nav-menu {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text-tertiary, #8b93a7);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #b4bac8);
}

.nav-item.active {
  background: var(--primary-glow, rgba(14, 165, 199, 0.1));
  color: var(--primary-color, #0ea5c7);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--primary-color, #0ea5c7);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px var(--primary-color, #0ea5c7);
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-icon :deep(svg) {
  width: 100%;
  height: 100%;
  stroke-width: 1.5;
}

.nav-text {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.active-indicator {
  position: absolute;
  right: 8px;
  width: 6px;
  height: 6px;
  background: var(--primary-color, #0ea5c7);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--primary-color, #0ea5c7);
}

/* Footer */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

/* Theme Section */
.theme-section {
  display: flex;
  flex-direction: column;
}

.footer-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #8b93a7);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #b4bac8);
}

.theme-toggle {
  justify-content: space-between;
}

.theme-toggle .nav-icon {
  color: var(--primary-color, #0ea5c7);
}

.expand-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
  margin-left: auto;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* Theme Options */
.theme-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  margin-top: 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #b4bac8);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 12px;
  text-align: left;
}

.theme-option:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #f5f6f8);
}

.theme-option.active {
  background: var(--primary-glow, rgba(14, 165, 199, 0.1));
  color: var(--primary-color, #0ea5c7);
}

.theme-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.theme-icon :deep(svg) {
  width: 100%;
  height: 100%;
  stroke-width: 1.5;
}

.theme-label {
  flex: 1;
  white-space: nowrap;
}

.theme-check {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-check svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.5;
}

/* Theme Expand Animation */
.theme-expand-enter-active,
.theme-expand-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 200px;
  opacity: 1;
}

.theme-expand-enter-from,
.theme-expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
}

/* Collapsed state adjustments */
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

.sidebar.collapsed .nav-item.active::before {
  height: 16px;
}

.sidebar.collapsed .footer-btn {
  justify-content: center;
  padding: 10px;
}

.sidebar.collapsed .theme-toggle {
  padding: 10px;
}

.sidebar.collapsed .theme-toggle .nav-icon {
  margin: 0;
}
</style>
