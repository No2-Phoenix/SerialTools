<template>
  <div class="empty-state" :class="type">
    <div class="illustration">
      <!-- Waveform Empty State -->
      <svg v-if="type === 'waveform'" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illustration-svg">
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0ea5c7" stop-opacity="0.2"/>
            <stop offset="50%" stop-color="#0ea5c7" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#0ea5c7" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
        <!-- Grid lines -->
        <line x1="20" y1="40" x2="180" y2="40" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <line x1="20" y1="80" x2="180" y2="80" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <line x1="20" y1="120" x2="180" y2="120" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <line x1="60" y1="20" x2="60" y2="140" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <line x1="100" y1="20" x2="100" y2="140" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <line x1="140" y1="20" x2="140" y2="140" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
        <!-- Waveform line -->
        <path
          d="M20 80 Q40 40, 60 80 T100 80 T140 80 T180 80"
          stroke="url(#waveGradient)"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M20 80 Q40 120, 60 80 T100 80 T140 80 T180 80"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          opacity="0.3"
        />
        <!-- Data points -->
        <circle cx="60" cy="80" r="4" fill="#0ea5c7" opacity="0.6"/>
        <circle cx="100" cy="80" r="4" fill="#0ea5c7" opacity="0.6"/>
        <circle cx="140" cy="80" r="4" fill="#0ea5c7" opacity="0.6"/>
        <!-- Frame -->
        <rect x="20" y="20" width="160" height="120" rx="8" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.2"/>
      </svg>

      <!-- Payload Empty State -->
      <svg v-else-if="type === 'payload'" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illustration-svg">
        <!-- Main packet -->
        <rect x="40" y="50" width="120" height="60" rx="6" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
        <!-- Header section -->
        <rect x="50" y="60" width="30" height="40" rx="3" fill="currentColor" opacity="0.1"/>
        <text x="55" y="85" fill="currentColor" font-size="10" font-family="JetBrains Mono" opacity="0.5">HDR</text>
        <!-- Data sections -->
        <rect x="90" y="60" width="25" height="18" rx="2" fill="#0ea5c7" opacity="0.3"/>
        <rect x="90" y="82" width="25" height="18" rx="2" fill="#0ea5c7" opacity="0.2"/>
        <rect x="120" y="60" width="30" height="40" rx="3" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.2"/>
        <!-- Floating elements -->
        <circle cx="30" cy="40" r="8" fill="#22c55e" opacity="0.2"/>
        <circle cx="170" cy="120" r="6" fill="#f59e0b" opacity="0.2"/>
        <rect x="160" y="35" width="16" height="16" rx="4" fill="#8b5cf6" opacity="0.2"/>
        <!-- Connection lines -->
        <path d="M38 44 L40 50" stroke="currentColor" stroke-width="1" opacity="0.2"/>
        <path d="M162 116 L160 110" stroke="currentColor" stroke-width="1" opacity="0.2"/>
      </svg>

      <!-- Generic Empty State -->
      <svg v-else viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="illustration-svg">
        <rect x="50" y="40" width="100" height="80" rx="8" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
        <line x1="70" y1="65" x2="130" y2="65" stroke="currentColor" stroke-width="1.5" opacity="0.15"/>
        <line x1="70" y1="80" x2="110" y2="80" stroke="currentColor" stroke-width="1.5" opacity="0.15"/>
        <line x1="70" y1="95" x2="120" y2="95" stroke="currentColor" stroke-width="1.5" opacity="0.15"/>
        <circle cx="100" cy="130" r="15" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
        <path d="M92 130 L98 136 L108 124" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
      </svg>
    </div>

    <h3 class="title">{{ title }}</h3>
    <p class="description">{{ description }}</p>

    <div v-if="actionText" class="action">
      <button class="btn btn-primary" @click="$emit('action')">
        <Plus v-if="showAddIcon" class="btn-icon" />
        <span>{{ actionText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next';

interface Props {
  type: 'waveform' | 'payload' | 'generic';
  title: string;
  description: string;
  actionText?: string;
  showAddIcon?: boolean;
}

withDefaults(defineProps<Props>(), {
  type: 'generic',
  showAddIcon: true,
});

defineEmits<{
  action: [];
}>();
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  text-align: center;
  color: var(--color-text-tertiary);
}

.illustration {
  width: 160px;
  height: 128px;
  margin-bottom: 24px;
  opacity: 0.8;
}

.illustration-svg {
  width: 100%;
  height: 100%;
  color: var(--color-text-secondary);
}

/* Animation for waveform */
.empty-state.waveform .illustration-svg path[stroke="url(#waveGradient)"] {
  animation: wave 2s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% {
    d: path("M20 80 Q40 40, 60 80 T100 80 T140 80 T180 80");
  }
  50% {
    d: path("M20 80 Q40 120, 60 80 T100 80 T140 80 T180 80");
  }
}

/* Animation for payload */
.empty-state.payload .illustration-svg rect[fill="#0ea5c7"] {
  animation: pulse-opacity 2s ease-in-out infinite;
}

.empty-state.payload .illustration-svg rect[fill="#0ea5c7"]:nth-child(4) {
  animation-delay: 0.2s;
}

.empty-state.payload .illustration-svg rect[fill="#0ea5c7"]:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.5; }
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.description {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0 0 20px 0;
  max-width: 280px;
  line-height: 1.5;
}

.action {
  display: flex;
  gap: 12px;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400));
  color: white;
  box-shadow: 0 2px 8px rgba(14, 165, 199, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-300));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 199, 0.4);
}
</style>
