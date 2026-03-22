<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tab in tabStore.tabs"
        :key="tab.id"
        class="tab-item"
        :class="{
          active: tab.isActive,
          connected: tab.isConnected,
          unread: tab.unreadCount > 0,
        }"
        @click="switchTab(tab.id)"
        draggable="true"
        @dragstart="handleDragStart($event, tab.id)"
        @dragover.prevent
        @drop="handleDrop($event, tab.id)"
      >
        <!-- 连接状态指示器 -->
        <span class="status-indicator" :class="tab.isConnected ? 'connected' : 'disconnected'" />

        <!-- 标签标题 -->
        <span class="tab-title">{{ tab.title }}</span>

        <!-- 未读计数 -->
        <span v-if="tab.unreadCount > 0" class="unread-badge">
          {{ tab.unreadCount > 99 ? '99+' : tab.unreadCount }}
        </span>

        <!-- 关闭按钮 -->
        <button
          class="close-btn"
          @click.stop="closeTab(tab.id)"
          title="关闭标签页"
        >
          <X class="close-icon" />
        </button>
      </div>

      <!-- 新建标签页按钮 -->
      <button
        v-if="tabStore.canCreateTab"
        class="new-tab-btn"
        @click="showNewTabDialog = true"
        title="新建连接"
      >
        <Plus class="new-tab-icon" />
      </button>
    </div>

    <!-- 标签页操作菜单 -->
    <div class="tab-actions">
      <button
        class="action-btn"
        :disabled="tabStore.tabs.length === 0"
        @click="closeAllTabs"
        title="关闭所有"
      >
        <XSquare class="action-icon" />
      </button>
    </div>

    <!-- 新建标签页对话框 -->
    <n-modal
      v-model:show="showNewTabDialog"
      title="新建串口连接"
      preset="card"
      style="width: 500px"
    >
      <div class="new-tab-form">
        <div class="form-group">
          <label class="form-label">串口</label>
          <n-select
            v-model:value="newTabConfig.portName"
            :options="portOptions"
            placeholder="选择串口"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">波特率</label>
            <n-select
              v-model:value="newTabConfig.baudRate"
              :options="baudRateOptions"
            />
          </div>

          <div class="form-group">
            <label class="form-label">数据位</label>
            <n-select
              v-model:value="newTabConfig.dataBits"
              :options="dataBitsOptions"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">校验</label>
            <n-select
              v-model:value="newTabConfig.parity"
              :options="parityOptions"
            />
          </div>

          <div class="form-group">
            <label class="form-label">停止位</label>
            <n-select
              v-model:value="newTabConfig.stopBits"
              :options="stopBitsOptions"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">流控</label>
          <n-select
            v-model:value="newTabConfig.flowControl"
            :options="flowControlOptions"
          />
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showNewTabDialog = false">
            取消
          </button>
          <button
            class="btn btn-primary"
            :disabled="!newTabConfig.portName"
            @click="createNewTab"
          >
            连接
          </button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NModal, NSelect, useMessage } from 'naive-ui';
import { Plus, X, XSquare } from 'lucide-vue-next';
import { useTabStore, type PortConfig } from '../stores/tabs';
import { useDeviceStore } from '../stores/device';

const tabStore = useTabStore();
const deviceStore = useDeviceStore();
const message = useMessage();

const showNewTabDialog = ref(false);
const draggedTabId = ref<string>('');

const newTabConfig = ref<PortConfig>({
  portName: '',
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
});

const portOptions = computed(() =>
  deviceStore.availablePorts.map((port) => ({
    label: port.name,
    value: port.name,
  }))
);

const baudRateOptions = [
  { label: '9600', value: 9600 },
  { label: '19200', value: 19200 },
  { label: '38400', value: 38400 },
  { label: '57600', value: 57600 },
  { label: '115200', value: 115200 },
  { label: '230400', value: 230400 },
  { label: '460800', value: 460800 },
  { label: '921600', value: 921600 },
];

const dataBitsOptions = [
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
];

const parityOptions = [
  { label: '无', value: 'none' },
  { label: '奇', value: 'odd' },
  { label: '偶', value: 'even' },
];

const stopBitsOptions = [
  { label: '1', value: 1 },
  { label: '1.5', value: 1.5 },
  { label: '2', value: 2 },
];

const flowControlOptions = [
  { label: '无', value: 'none' },
  { label: '软件', value: 'software' },
  { label: '硬件', value: 'hardware' },
];

const switchTab = (tabId: string) => {
  tabStore.switchTab(tabId);
};

const closeTab = async (tabId: string) => {
  await tabStore.closeTab(tabId);
};

const closeAllTabs = async () => {
  await tabStore.closeAllTabs();
};

const createNewTab = async () => {
  if (!newTabConfig.value.portName) {
    message.error('请选择串口');
    return;
  }

  const tab = tabStore.createTab(newTabConfig.value.portName, {
    ...newTabConfig.value,
  });

  if (tab) {
    showNewTabDialog.value = false;
    message.success('标签页创建成功');

    // 尝试连接串口
    try {
      // await deviceStore.openPort({ ... });
      tabStore.updateTabConnection(tab.id, true);
    } catch (e) {
      message.error('连接失败: ' + e);
    }
  } else {
    message.error('无法创建更多标签页');
  }
};

// 拖拽处理
const handleDragStart = (e: DragEvent, tabId: string) => {
  draggedTabId.value = tabId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
};

const handleDrop = (e: DragEvent, targetTabId: string) => {
  e.preventDefault();
  if (!draggedTabId.value || draggedTabId.value === targetTabId) return;

  // 重新排序
  const currentOrder = tabStore.tabs.map((t) => t.id);
  const fromIndex = currentOrder.indexOf(draggedTabId.value);
  const toIndex = currentOrder.indexOf(targetTabId);

  if (fromIndex === -1 || toIndex === -1) return;

  // 移动元素
  currentOrder.splice(fromIndex, 1);
  currentOrder.splice(toIndex, 0, draggedTabId.value);

  tabStore.reorderTabs(currentOrder);
  draggedTabId.value = '';
};

onMounted(() => {
  deviceStore.scanPorts();
});
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 40px;
  background: rgba(15, 17, 21, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  gap: 12px;
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.tabs-container::-webkit-scrollbar {
  height: 2px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  position: relative;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tab-item.active {
  background: rgba(14, 165, 199, 0.1);
  border-color: rgba(14, 165, 199, 0.3);
  border-bottom-color: transparent;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary-500);
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.connected {
  background: var(--color-success);
  box-shadow: 0 0 4px var(--color-success);
}

.status-indicator.disconnected {
  background: var(--color-text-tertiary);
}

.tab-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-item.active .tab-title {
  color: var(--color-text-primary);
  font-weight: 500;
}

.unread-badge {
  font-size: 10px;
  font-weight: 600;
  color: white;
  background: var(--color-error);
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tab-item:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-error);
}

.close-icon {
  width: 12px;
  height: 12px;
  stroke-width: 1.5;
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.new-tab-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--color-text-secondary);
}

.new-tab-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

.tab-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

/* New Tab Form */
.new-tab-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
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
</style>
