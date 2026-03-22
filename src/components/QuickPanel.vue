<template>
  <div class="quick-panel" :class="{ open: isOpen }">
    <!-- 触发按钮 -->
    <button class="trigger-btn" @click="togglePanel" :class="{ active: isOpen }">
      <Zap class="trigger-icon" />
      <span class="trigger-text">快捷</span>
    </button>

    <!-- 抽屉面板 -->
    <div class="drawer">
      <div class="drawer-header">
        <div class="header-title">
          <Zap class="title-icon" />
          <span>快捷命令</span>
        </div>
        <button class="close-btn" @click="closePanel">
          <X class="close-icon" />
        </button>
      </div>

      <div class="drawer-content">
        <!-- 预设命令列表 -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">预设命令</span>
            <button class="section-action" @click="openPayloadManager">
              <Settings class="action-icon" />
            </button>
          </div>
          
          <div class="payload-list">
            <div
              v-for="item in payloadStore.payloads.slice(0, 10)"
              :key="item.id"
              class="payload-item"
              @click="sendPayload(item)"
            >
              <div class="payload-info">
                <span class="payload-name">{{ item.name }}</span>
                <span class="payload-format" :class="item.format">
                  {{ item.format === 'hex' ? 'HEX' : 'ASCII' }}
                </span>
              </div>
              <button 
                class="send-btn"
                :disabled="!isConnected"
                @click.stop="sendPayload(item)"
              >
                <Send class="send-icon" />
              </button>
            </div>
            
            <div v-if="payloadStore.payloads.length === 0" class="empty-tip">
              暂无预设命令
            </div>
          </div>
        </div>

        <!-- 快捷发送区 -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">快速发送</span>
          </div>
          
          <div class="quick-send">
            <div class="format-toggle">
              <button
                class="format-btn"
                :class="{ active: quickFormat === 'hex' }"
                @click="quickFormat = 'hex'"
              >
                HEX
              </button>
              <button
                class="format-btn"
                :class="{ active: quickFormat === 'ascii' }"
                @click="quickFormat = 'ascii'"
              >
                ASCII
              </button>
            </div>
            
            <textarea
              v-model="quickInput"
              class="quick-input"
              :placeholder="quickFormat === 'hex' ? '输入十六进制，如: 01 02 03' : '输入文本...'"
              rows="3"
              @keydown.enter.prevent="handleQuickSend"
            />
            
            <div class="quick-actions">
              <span class="byte-count">{{ quickByteCount }} 字节</span>
              <button
                class="btn btn-primary"
                :disabled="!canSend || !quickInput"
                @click="handleQuickSend"
              >
                <Send class="btn-icon" />
                <span>发送</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">发送历史</span>
            <button class="section-action" @click="clearHistory">
              <Trash2 class="action-icon" />
            </button>
          </div>
          
          <div class="history-list">
            <div
              v-for="(item, index) in sendHistory.slice(0, 5)"
              :key="index"
              class="history-item"
              @click="loadFromHistory(item)"
            >
              <span class="history-data">{{ truncate(item.data, 30) }}</span>
              <span class="history-format" :class="item.format">
                {{ item.format === 'hex' ? 'HEX' : 'TXT' }}
              </span>
            </div>
            
            <div v-if="sendHistory.length === 0" class="empty-tip">
              暂无发送记录
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 遮罩层 -->
    <div v-if="isOpen" class="overlay" @click="closePanel"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Zap, X, Settings, Send, Trash2 } from 'lucide-vue-next';
import { usePayloadStore, type Payload } from '../stores/payload';
import { useDeviceStore } from '../stores/device';
import { useLogStore } from '../stores/log';

const router = useRouter();
const payloadStore = usePayloadStore();
const deviceStore = useDeviceStore();
const logStore = useLogStore();

const isOpen = ref(false);
const quickFormat = ref<'hex' | 'ascii'>('hex');
const quickInput = ref('');
const sendHistory = ref<Array<{ data: string; format: 'hex' | 'ascii' }>>([]);

const isConnected = computed(() => deviceStore.activeConnections.size > 0);

const canSend = computed(() => {
  return isConnected.value && quickInput.value.trim().length > 0;
});

const quickByteCount = computed(() => {
  if (!quickInput.value) return 0;
  if (quickFormat.value === 'hex') {
    return quickInput.value.trim().split(/\s+/).filter(b => /^[0-9A-Fa-f]{1,2}$/.test(b)).length;
  }
  return new TextEncoder().encode(quickInput.value).length;
});

const togglePanel = () => {
  isOpen.value = !isOpen.value;
};

const closePanel = () => {
  isOpen.value = false;
};

const openPayloadManager = () => {
  closePanel();
  router.push('/payload');
};

const sendPayload = async (item: Payload) => {
  if (!isConnected.value) return;
  
  const portName = Array.from(deviceStore.activeConnections.keys())[0];
  if (!portName) return;

  try {
    await deviceStore.sendData(portName, item.data);
    logStore.addLog({
      timestamp: Date.now(),
      portName,
      direction: 'tx',
      data: new Uint8Array(item.data),
    });
  } catch (e) {
    console.error('Send failed:', e);
  }
};

const handleQuickSend = async () => {
  if (!canSend.value) return;

  const portName = Array.from(deviceStore.activeConnections.keys())[0];
  if (!portName) return;

  let data: number[];
  if (quickFormat.value === 'hex') {
    data = quickInput.value
      .trim()
      .split(/\s+/)
      .map((b) => parseInt(b, 16))
      .filter((b) => !isNaN(b));
  } else {
    data = Array.from(new TextEncoder().encode(quickInput.value));
  }

  if (data.length === 0) return;

  try {
    await deviceStore.sendData(portName, data);
    logStore.addLog({
      timestamp: Date.now(),
      portName,
      direction: 'tx',
      data: new Uint8Array(data),
    });

    // 添加到历史
    sendHistory.value.unshift({
      data: quickInput.value,
      format: quickFormat.value,
    });
    
    if (sendHistory.value.length > 10) {
      sendHistory.value.pop();
    }

    // 清空输入
    quickInput.value = '';
  } catch (e) {
    console.error('Send failed:', e);
  }
};

const loadFromHistory = (item: { data: string; format: 'hex' | 'ascii' }) => {
  quickInput.value = item.data;
  quickFormat.value = item.format;
};

const clearHistory = () => {
  sendHistory.value = [];
};

const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};
</script>

<style scoped>
.quick-panel {
  position: relative;
}

/* Trigger Button */
.trigger-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trigger-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

.trigger-btn.active {
  background: rgba(14, 165, 199, 0.15);
  border-color: rgba(14, 165, 199, 0.3);
  color: var(--color-primary-400);
}

.trigger-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

/* Drawer */
.drawer {
  position: fixed;
  top: 0;
  right: -360px;
  width: 360px;
  height: 100vh;
  background: rgba(21, 25, 33, 0.98);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 1000;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.quick-panel.open .drawer {
  right: 0;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.title-icon {
  width: 20px;
  height: 20px;
  stroke-width: 1.5;
  color: var(--color-primary-500);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.close-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Section */
.section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.section-action:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.action-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

/* Payload List */
.payload-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.payload-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.payload-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.payload-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.payload-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payload-format {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  width: fit-content;
  text-transform: uppercase;
}

.payload-format.hex {
  background: rgba(14, 165, 199, 0.15);
  color: var(--color-primary-400);
}

.payload-format.ascii {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgba(14, 165, 199, 0.1);
  border: none;
  border-radius: 6px;
  color: var(--color-primary-400);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: rgba(14, 165, 199, 0.2);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.send-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

/* Quick Send */
.quick-send {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.format-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  width: fit-content;
}

.format-btn {
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'JetBrains Mono', monospace;
}

.format-btn:hover {
  color: var(--color-text-secondary);
}

.format-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

.quick-input {
  padding: 12px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-text-primary);
  background: rgba(15, 17, 21, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  resize: none;
  outline: none;
  transition: all 0.2s;
}

.quick-input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(14, 165, 199, 0.15);
}

.quick-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.byte-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400));
  color: white;
  box-shadow: 0 2px 8px rgba(14, 165, 199, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-300));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 199, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* History List */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.history-data {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.history-format {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.history-format.hex {
  background: rgba(14, 165, 199, 0.1);
  color: var(--color-primary-400);
}

.history-format.ascii {
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
}

/* Empty Tip */
.empty-tip {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* Overlay */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Scrollbar */
.drawer-content::-webkit-scrollbar {
  width: 4px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
