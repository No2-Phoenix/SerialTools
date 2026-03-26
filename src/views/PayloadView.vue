<template>
  <div class="payload-view">
    <div class="payload-panel">
      <div class="panel-header">
        <div class="panel-title">
          <Package class="title-icon" />
          <span>命令预设管理</span>
          <span class="payload-count" v-if="payloadStore.payloads.length > 0">
            {{ payloadStore.payloads.length }} 个
          </span>
        </div>
        <div class="panel-actions">
          <button class="btn btn-secondary" @click="triggerImport">
            <Upload class="btn-icon" />
            <span>导入</span>
          </button>
          <button class="btn btn-secondary" @click="handleExport" :disabled="payloadStore.payloads.length === 0">
            <Download class="btn-icon" />
            <span>导出</span>
          </button>
          <button class="btn btn-primary" @click="showAddModal = true">
            <Plus class="btn-icon" />
            <span>添加预设</span>
          </button>
        </div>
      </div>

      <div class="panel-content">
        <div v-if="payloadStore.payloads.length === 0" class="empty-placeholder">
          <Package class="empty-icon" />
          <p>暂无命令预设</p>
          <p class="empty-hint">添加常用的命令预设，快速发送数据到串口设备</p>
          <button class="btn btn-primary" @click="showAddModal = true">
            <Plus class="btn-icon" />
            <span>添加预设</span>
          </button>
        </div>

        <div v-else class="payload-list">
          <div
            v-for="item in payloadStore.payloads"
            :key="item.id"
            class="payload-item"
          >
            <div class="payload-main">
              <div class="payload-header">
                <span class="payload-name">{{ item.name }}</span>
                <span class="payload-format" :class="item.format">
                  {{ item.format === 'hex' ? 'HEX' : 'ASCII' }}
                </span>
              </div>
              <div class="payload-data">
                {{ formatData(item) }}
              </div>
              <div v-if="item.description" class="payload-desc">
                {{ item.description }}
              </div>
            </div>
            <div class="payload-actions">
              <button
                class="action-btn send"
                :disabled="!isConnected"
                @click="handleSend(item)"
                title="发送"
              >
                <Send class="action-icon" />
              </button>
              <button
                class="action-btn edit"
                @click="handleEdit(item)"
                title="编辑"
              >
                <Pencil class="action-icon" />
              </button>
              <button
                class="action-btn delete"
                @click="handleDelete(item)"
                title="删除"
              >
                <Trash2 class="action-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <n-modal
      v-model:show="showAddModal"
      :title="isEditing ? '编辑命令预设' : '添加命令预设'"
      preset="card"
      style="width: 500px"
      :segmented="{ content: true }"
    >
      <div class="modal-form">
        <div class="form-group">
          <label class="form-label">名称</label>
          <input
            v-model="formData.name"
            type="text"
            class="form-input"
            placeholder="输入预设名称"
          />
        </div>

        <div class="form-group">
          <label class="form-label">格式</label>
          <div class="format-tabs">
            <button
              class="format-tab"
              :class="{ active: formData.format === 'hex' }"
              @click="formData.format = 'hex'"
            >
              HEX
            </button>
            <button
              class="format-tab"
              :class="{ active: formData.format === 'ascii' }"
              @click="formData.format = 'ascii'"
            >
              ASCII
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">数据</label>
          <textarea
            v-model="formData.dataInput"
            class="form-textarea"
            :placeholder="formData.format === 'hex' ? '输入十六进制数据，如: 01 02 03' : '输入ASCII文本'"
            rows="4"
          />
          <span class="form-hint">{{ byteCount }} 字节</span>
        </div>

        <div class="form-group">
          <label class="form-label">描述 <span class="optional">(可选)</span></label>
          <input
            v-model="formData.description"
            type="text"
            class="form-input"
            placeholder="简短描述此预设的用途"
          />
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="handleSave">
            {{ isEditing ? '保存' : '添加' }}
          </button>
        </div>
      </template>
    </n-modal>

    <input
      ref="fileInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden-file-input"
      @change="handleFileSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NModal, useMessage } from 'naive-ui';
import { invoke } from '@tauri-apps/api/core';
import { Package, Plus, Download, Upload, Send, Pencil, Trash2 } from 'lucide-vue-next';
import { usePayloadStore, type Payload } from '../stores/payload';
import { useSerialConnectionStore } from '../stores/serialConnection';
import { isMockPort, mockSerialReplay } from '../utils/mockSerialReplay';

const payloadStore = usePayloadStore();
const serialStore = useSerialConnectionStore();
const message = useMessage();

const showAddModal = ref(false);
const isEditing = ref(false);
const editingId = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const formData = ref({
  name: '',
  format: 'hex' as 'hex' | 'ascii',
  dataInput: '',
  description: '',
});

const isConnected = computed(() => serialStore.isConnected);

const byteCount = computed(() => {
  if (!formData.value.dataInput) return 0;
  if (formData.value.format === 'hex') {
    return formData.value.dataInput.trim().split(/\s+/).filter(b => /^[0-9A-Fa-f]{1,2}$/.test(b)).length;
  }
  return new TextEncoder().encode(formData.value.dataInput).length;
});

const formatData = (item: Payload) => {
  if (item.format === 'hex') {
    return item.data.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
  return new TextDecoder().decode(new Uint8Array(item.data));
};

const parsePayloadData = (): number[] | null => {
  if (formData.value.format === 'hex') {
    const tokens = formData.value.dataInput.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      message.error('请输入至少一个 HEX 字节');
      return null;
    }

    const invalid = tokens.find((token) => !/^[0-9A-Fa-f]{1,2}$/.test(token));
    if (invalid) {
      message.error(`HEX 数据格式错误: ${invalid}`);
      return null;
    }

    return tokens.map((token) => parseInt(token, 16));
  }

  return Array.from(new TextEncoder().encode(formData.value.dataInput));
};

const handleSave = () => {
  const name = formData.value.name.trim();
  if (!name || !formData.value.dataInput.trim()) {
    message.error('请填写完整信息');
    return;
  }

  const data = parsePayloadData();
  if (!data) return;
  if (data.length === 0) {
    message.error('数据格式错误');
    return;
  }

  if (isEditing.value && editingId.value) {
    payloadStore.updatePayload(editingId.value, {
      name,
      format: formData.value.format,
      data,
      description: formData.value.description.trim(),
    });
    message.success('保存成功');
  } else {
    payloadStore.addPayload({
      name,
      format: formData.value.format,
      data,
      description: formData.value.description.trim(),
    });
    message.success('添加成功');
  }

  closeModal();
};

const handleEdit = (item: Payload) => {
  isEditing.value = true;
  editingId.value = item.id;
  formData.value = {
    name: item.name,
    format: item.format,
    dataInput: formatData(item),
    description: item.description || '',
  };
  showAddModal.value = true;
};

const handleDelete = (item: Payload) => {
  payloadStore.deletePayload(item.id);
  message.success('删除成功');
};

const handleSend = async (item: Payload) => {
  if (!serialStore.currentPort) {
    message.error('请先连接串口');
    return;
  }

  try {
    if (isMockPort(serialStore.currentPort)) {
      mockSerialReplay.injectResponse(item.data);
    } else {
      await invoke('send_serial_data', {
        portName: serialStore.currentPort,
        data: item.data,
      });
    }
    serialStore.addLog('tx', item.data);
    message.success('发送成功');
  } catch (e) {
    message.error('发送失败: ' + e);
  }
};

const handleExport = () => {
  const content = payloadStore.exportPayloads();
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payloads-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  message.success('导出成功');
};

const triggerImport = () => {
  if (!fileInputRef.value) return;
  fileInputRef.value.value = '';
  fileInputRef.value.click();
};

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const result = payloadStore.importPayloads(content);
    if (result.ok) {
      message.success(`导入成功：${result.importedPayloads} 个预设，${result.importedSequences} 个序列`);
    } else {
      message.error(result.message);
    }
  } catch (error) {
    message.error('读取文件失败: ' + error);
  } finally {
    input.value = '';
  }
};

const closeModal = () => {
  showAddModal.value = false;
  isEditing.value = false;
  editingId.value = null;
  formData.value = { name: '', format: 'hex', dataInput: '', description: '' };
};
</script>

<style scoped>
.payload-view {
  height: 100%;
}

.payload-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.title-icon {
  width: 18px;
  height: 18px;
  stroke-width: 1.5;
  color: var(--primary-color);
}

.payload-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 4px;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-light);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-placeholder {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-placeholder p {
  margin: 4px 0;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 16px;
}

.payload-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payload-item {
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.payload-item:hover {
  background: var(--bg-elevated);
  border-color: var(--border-hover);
}

.payload-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.payload-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.payload-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.payload-format {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}

.payload-format.hex {
  background: rgba(14, 165, 199, 0.15);
  color: var(--primary-light);
}

.payload-format.ascii {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.payload-data {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 8px 10px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payload-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.payload-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.send {
  color: var(--success-color);
}

.action-btn.send:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.1);
}

.action-btn.edit:hover {
  color: var(--text-secondary);
}

.action-btn.delete:hover {
  color: var(--error-color);
  background: rgba(239, 68, 68, 0.1);
}

.action-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.optional {
  color: var(--text-tertiary);
  font-weight: 400;
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-glow);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: 'JetBrains Mono', monospace;
}

.form-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
}

.format-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.format-tab {
  flex: 1;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
}

.format-tab:hover {
  color: var(--text-secondary);
}

.format-tab.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.hidden-file-input {
  display: none;
}
</style>
