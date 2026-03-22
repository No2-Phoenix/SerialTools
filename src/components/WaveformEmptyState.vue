<template>
  <div class="empty-state">
    <div class="empty-state-float">
      <svg
        viewBox="0 0 200 120"
        class="waveform-svg"
        :class="{ 'is-dark': isDark }"
      >
        <!-- 背景网格 -->
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="currentColor"
              stroke-width="0.5"
              opacity="0.1"
            />
          </pattern>
          
          <!-- 渐变定义 -->
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.3" />
            <stop offset="50%" stop-color="var(--primary-color)" stop-opacity="0.8" />
            <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0.3" />
          </linearGradient>
          
          <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.2" />
            <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0" />
          </linearGradient>
          
          <!-- 发光滤镜 -->
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- 网格背景 -->
        <rect width="200" height="120" fill="url(#grid)" />
        
        <!-- 中心线 -->
        <line
          x1="0"
          y1="60"
          x2="200"
          y2="60"
          stroke="currentColor"
          stroke-width="0.5"
          opacity="0.2"
          stroke-dasharray="4 4"
        />
        
        <!-- 波形路径 - 使用多个正弦波叠加 -->
        <path
          class="wave-path-bg"
          d="M0,60 Q25,30 50,60 T100,60 T150,60 T200,60"
          fill="none"
          stroke="url(#waveGradient)"
          stroke-width="2"
          opacity="0.5"
        />
        
        <path
          class="wave-path"
          d="M0,60 C20,20 40,100 60,60 S100,20 120,60 S160,100 180,60 S200,40 200,60"
          fill="none"
          stroke="var(--primary-color)"
          stroke-width="2.5"
          stroke-linecap="round"
          filter="url(#glow)"
        />
        
        <!-- 填充区域 -->
        <path
          class="wave-fill"
          d="M0,60 C20,20 40,100 60,60 S100,20 120,60 S160,100 180,60 S200,40 200,60 V120 H0 Z"
          fill="url(#fillGradient)"
          opacity="0.6"
        />
        
        <!-- 数据点 -->
        <circle class="data-point" cx="60" cy="60" r="3" fill="var(--primary-color)" />
        <circle class="data-point" cx="120" cy="60" r="3" fill="var(--primary-color)" />
        <circle class="data-point" cx="180" cy="60" r="3" fill="var(--primary-color)" />
        
        <!-- 扫描线动画 -->
        <line
          class="scan-line"
          x1="0"
          y1="0"
          x2="0"
          y2="120"
          stroke="var(--primary-color)"
          stroke-width="1"
          opacity="0.5"
        />
      </svg>
    </div>
    
    <div class="empty-state-content">
      <h3 class="empty-state-title">{{ title }}</h3>
      <p class="empty-state-description">{{ description }}</p>
      <slot name="action">
        <button
          v-if="showAction"
          class="empty-state-action"
          @click="$emit('action')"
        >
          {{ actionText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '../stores/theme';

withDefaults(defineProps<{
  title?: string;
  description?: string;
  showAction?: boolean;
  actionText?: string;
}>(), {
  title: '等待连接',
  description: '连接串口设备以开始采集波形数据',
  showAction: true,
  actionText: '连接设备',
});

defineEmits<{
  action: [];
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-primary);
}

.empty-state-float {
  animation: gentle-float 4s ease-in-out infinite;
}

@keyframes gentle-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.waveform-svg {
  width: 200px;
  height: 120px;
  color: var(--text-muted);
}

.waveform-svg.is-dark {
  filter: drop-shadow(0 0 10px var(--primary-glow));
}

/* 波形路径动画 */
.wave-path {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: draw-wave 2s ease-out forwards, pulse-wave 3s ease-in-out infinite 2s;
}

@keyframes draw-wave {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes pulse-wave {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 背景波形动画 */
.wave-path-bg {
  animation: slide-wave 4s ease-in-out infinite;
}

@keyframes slide-wave {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-10px);
  }
}

/* 数据点闪烁 */
.data-point {
  animation: point-blink 2s ease-in-out infinite;
}

.data-point:nth-child(2) {
  animation-delay: 0.3s;
}

.data-point:nth-child(3) {
  animation-delay: 0.6s;
}

@keyframes point-blink {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 扫描线动画 */
.scan-line {
  animation: scan 3s linear infinite;
}

@keyframes scan {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 0.5;
  }
  90% {
    opacity: 0.5;
  }
  100% {
    transform: translateX(200px);
    opacity: 0;
  }
}

.empty-state-content {
  margin-top: 24px;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.empty-state-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 20px;
  max-width: 280px;
  line-height: 1.5;
}

.empty-state-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px var(--primary-glow);
}

.empty-state-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--primary-glow);
}

.empty-state-action:active {
  transform: translateY(0) scale(0.98);
}
</style>
