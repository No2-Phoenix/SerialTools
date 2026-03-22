<template>
  <div class="settings-view">
    <header class="settings-header">
      <div class="header-content">
        <div class="header-icon">
          <SettingsIcon />
        </div>
        <div class="header-text">
          <h1>设置</h1>
          <p>自定义您的应用体验</p>
        </div>
      </div>
    </header>

    <div class="settings-content">
      <aside class="settings-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['nav-item', { active: activeSection === item.id }]"
          @click="activeSection = item.id"
        >
          <component :is="item.icon" class="nav-icon" />
          <span>{{ item.label }}</span>
        </button>
      </aside>

      <main class="settings-main">
        <div v-if="activeSection === 'theme'" class="settings-section">
          <h2>主题设置</h2>
          <p class="section-desc">选择适合您的主题风格</p>
          <div class="theme-grid">
            <div
              v-for="theme in themeStore.themes"
              :key="theme.name"
              :class="['theme-card', { active: themeStore.currentTheme === theme.name }]"
              @click="themeStore.setTheme(theme.name)"
            >
              <div class="theme-preview" :style="{ background: getThemeGradient(theme.name) }">
                <div class="theme-preview-inner"></div>
              </div>
              <div class="theme-info">
                <span class="theme-name">{{ theme.label }}</span>
                <component :is="getThemeIcon(theme.name)" class="theme-icon" />
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'terminal'" class="settings-section">
          <h2>终端设置</h2>
          <p class="section-desc">配置终端行为和显示选项</p>
          <div class="settings-group">
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">时间戳格式</span>
                <span class="label-hint">日志条目中显示时间戳</span>
              </div>
              <CustomSelect
                v-model="timestampFormat"
                :options="timestampOptions"
                style="width: 180px;"
              />
            </div>
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">自动滚动</span>
                <span class="label-hint">新日志自动滚动到底部</span>
              </div>
              <label class="toggle">
                <input type="checkbox" checked />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">字体大小</span>
                <span class="label-hint">日志字体大小</span>
              </div>
              <CustomSelect
                v-model="fontSize"
                :options="fontSizeOptions"
                style="width: 100px;"
              />
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'serial'" class="settings-section">
          <h2>串口设置</h2>
          <p class="section-desc">配置串口通信参数</p>
          <div class="settings-group">
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">默认波特率</span>
                <span class="label-hint">新连接使用的默认波特率</span>
              </div>
              <CustomSelect
                v-model="baudRate"
                :options="baudRateOptions"
                style="width: 120px;"
              />
            </div>
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">数据位</span>
              </div>
              <CustomSelect
                v-model="dataBits"
                :options="dataBitsOptions"
                style="width: 80px;"
              />
            </div>
            <div class="setting-item">
              <div class="setting-label">
                <span class="label-text">停止位</span>
              </div>
              <CustomSelect
                v-model="stopBits"
                :options="stopBitsOptions"
                style="width: 80px;"
              />
            </div>
          </div>
        </div>

        <div v-else-if="activeSection === 'about'" class="settings-section">
          <h2>关于</h2>
          <p class="section-desc">应用程序信息和资源</p>
          <div class="about-content">
            <div class="about-logo">
              <MonitorIcon class="logo-icon" />
            </div>
            <h3>GreenSerial</h3>
            <p class="version">版本 1.0.0</p>
            <p class="about-desc">
              一款现代化的串口调试工具，为开发者提供简洁高效的串口通信体验。
            </p>
            <div class="about-links">
              <a href="#" class="about-link">文档</a>
              <a href="#" class="about-link">源代码</a>
              <a href="#" class="about-link">问题反馈</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { useThemeStore } from '../stores/theme';
import CustomSelect from '../components/CustomSelect.vue';

const themeStore = useThemeStore();
const activeSection = ref('theme');

// 终端设置
const timestampFormat = ref('HH:mm:ss.SSS');
const fontSize = ref('14px');

// 串口设置
const baudRate = ref('115200');
const dataBits = ref('8');
const stopBits = ref('1');

const timestampOptions = [
  { label: 'HH:mm:ss.SSS', value: 'HH:mm:ss.SSS' },
  { label: 'HH:mm:ss', value: 'HH:mm:ss' },
  { label: 'mm:ss.SSS', value: 'mm:ss.SSS' },
];

const fontSizeOptions = [
  { label: '12px', value: '12px' },
  { label: '13px', value: '13px' },
  { label: '14px', value: '14px' },
  { label: '15px', value: '15px' },
  { label: '16px', value: '16px' },
];

const baudRateOptions = [
  { label: '9600', value: '9600' },
  { label: '115200', value: '115200' },
  { label: '921600', value: '921600' },
];

const dataBitsOptions = [
  { label: '8', value: '8' },
  { label: '7', value: '7' },
  { label: '6', value: '6' },
  { label: '5', value: '5' },
];

const stopBitsOptions = [
  { label: '1', value: '1' },
  { label: '1.5', value: '1.5' },
  { label: '2', value: '2' },
];

const SunIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('circle', { cx: '12', cy: '12', r: '5' }),
  h('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' })
]);

const MoonIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })
]);

const DropletsIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { d: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' })
]);

const Flower2Icon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { d: 'M12 22c4-4.5 6-7.5 6-10.5a6 6 0 0 0-12 0c0 3 2 6 6 10.5z' }),
  h('path', { d: 'M12 22V8M8 18c2-2 4-3 4-6M16 18c-2-2-4-3-4-6' })
]);

const SparklesIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { d: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z' }),
  h('path', { d: 'M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z' }),
  h('path', { d: 'M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z' })
]);

const SettingsIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('circle', { cx: '12', cy: '12', r: '3' }),
  h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' })
]);

const MonitorIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2', ry: '2' }),
  h('line', { x1: '8', y1: '21', x2: '16', y2: '21' }),
  h('line', { x1: '12', y1: '17', x2: '12', y2: '21' })
]);

const CodeIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('polyline', { points: '16 18 22 12 16 6' }),
  h('polyline', { points: '8 6 2 12 8 18' })
]);

const InfoIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('circle', { cx: '12', cy: '12', r: '10' }),
  h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
  h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
]);

const navItems = [
  { id: 'theme', label: '主题', icon: SparklesIcon },
  { id: 'terminal', label: '终端', icon: CodeIcon },
  { id: 'serial', label: '串口', icon: MonitorIcon },
  { id: 'about', label: '关于', icon: InfoIcon }
];

const getThemeGradient = (themeName: string) => {
  const gradients: Record<string, string> = {
    dark: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0d1117 100%)',
    light: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)',
    sakura: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 50%, #f48fb1 100%)',
    arctic: 'linear-gradient(135deg, #E8F4FD 0%, #D6EAF8 50%, #C5DFF5 100%)',
    lavender: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 50%, #ce93d8 100%)'
  };
  return gradients[themeName] || gradients.dark;
};

const getThemeIcon = (themeName: string) => {
  const icons: Record<string, any> = {
    dark: MoonIcon,
    light: SunIcon,
    sakura: Flower2Icon,
    arctic: DropletsIcon,
    lavender: SparklesIcon
  };
  return icons[themeName] || SunIcon;
};
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.settings-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  border-radius: 12px;
  color: white;
}

.header-icon :deep(svg) {
  width: 24px;
  height: 24px;
  stroke-width: 1.5;
}

.header-text h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-text p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

.settings-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-nav {
  width: 200px;
  flex-shrink: 0;
  padding: 16px;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-color);
  color: white;
}

.nav-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5;
}

.settings-main {
  flex: 1;
  min-width: 0;
  padding: 32px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.settings-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.theme-card {
  background: var(--bg-secondary);
  border: 2px solid var(--border-default);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-2px);
}

.theme-card.active {
  border-color: var(--primary-color);
}

.theme-preview {
  height: 80px;
  border-radius: 8px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}

.theme-preview-inner {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  top: 20%;
  left: 30%;
  width: 40%;
  height: 40%;
}

.theme-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.theme-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.theme-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5;
  color: var(--text-tertiary);
}

.settings-group {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.label-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.toggle {
  position: relative;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.2s ease;
}

.toggle input:checked + .toggle-slider {
  background: var(--primary-color);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}

.about-logo {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  border-radius: 20px;
  margin-bottom: 24px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  stroke-width: 1.5;
  color: white;
}

.about-content h3 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.version {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0 0 24px 0;
}

.about-desc {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 400px;
  line-height: 1.6;
  margin: 0 0 32px 0;
}

.about-links {
  display: flex;
  gap: 24px;
}

.about-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.about-link:hover {
  opacity: 0.8;
}
</style>
