<template>
  <div class="log-panel-enhanced">
    <!-- 工具条 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="tool-group">
          <button
            class="tool-btn"
            :class="{ active: showTimestamp }"
            @click="showTimestamp = !showTimestamp"
            title="显示时间戳"
          >
            <Clock class="tool-icon" />
            <span>时间戳</span>
          </button>
          
          <button
            class="tool-btn"
            :class="{ active: isHexMode }"
            @click="isHexMode = !isHexMode"
            title="十六进制模式"
          >
            <Hash class="tool-icon" />
            <span>HEX</span>
          </button>
          
          <button
            class="tool-btn"
            :class="{ active: showDualMode }"
            @click="showDualMode = !showDualMode"
            title="双模式显示"
          >
            <Columns class="tool-icon" />
            <span>双显</span>
          </button>
        </div>

        <div class="tool-group">
          <div class="search-box">
            <Search class="search-icon" />
            <input
              v-model="searchPattern"
              type="text"
              placeholder="正则搜索..."
              class="search-input"
              @keyup.enter="applySearch"
            />
            <button
              v-if="searchPattern"
              class="search-clear"
              @click="clearSearch"
            >
              <X class="clear-icon" />
            </button>
          </div>
        </div>

        <div class="tool-group">
          <select v-model="filterDirection" class="filter-select" @change="applyFilter">
            <option value="">全部方向</option>
            <option value="tx">发送 (TX)</option>
            <option value="rx">接收 (RX)</option>
          </select>
          
          <select v-model="filterPort" class="filter-select" @change="applyFilter">
            <option value="">全部端口</option>
            <option v-for="port in availablePorts" :key="port" :value="port">
              {{ port }}
            </option>
          </select>
        </div>
      </div>

      <div class="toolbar-right">
        <span class="log-stats">{{ filteredLogs }} / {{ totalLogs }} 条</span>
        
        <button class="tool-btn" @click="handleExport" title="导出日志">
          <Download class="tool-icon" />
        </button>
        
        <button class="tool-btn danger" @click="handleClear" title="清空日志">
          <Trash2 class="tool-icon" />
        </button>
      </div>
    </div>

    <!-- 日志内容区 -->
    <div ref="logContainerRef" class="log-container" @scroll="handleScroll">
      <!-- 虚拟滚动占位 -->
      <div class="log-spacer" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="item in visibleLogs"
          :key="item.id"
          class="log-item"
          :class="[item.direction, { highlighted: isHighlighted(item) }]"
          :style="{ transform: `translateY(${item.offsetY}px)` }"
        >
          <!-- 时间戳 -->
          <span v-if="showTimestamp" class="log-timestamp">
            {{ formatTime(item.timestamp) }}
          </span>
          
          <!-- 方向标识 -->
          <span class="log-direction">
            <ArrowUp v-if="item.direction === 'tx'" class="direction-icon tx" />
            <ArrowDown v-else class="direction-icon rx" />
          </span>
          
          <!-- 端口名 -->
          <span class="log-port">{{ item.portName }}</span>
          
          <!-- 数据内容 -->
          <div class="log-content" :class="{ dual: showDualMode }">
            <span class="log-hex" :class="{ 'full-width': !showDualMode || !isHexMode }">
              {{ bytesToHex(item.data) }}
            </span>
            <span v-if="showDualMode || !isHexMode" class="log-ascii">
              {{ bytesToString(item.data) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span class="status-item">
          <span class="status-dot tx"></span>
          TX: {{ txCount }}
        </span>
        <span class="status-item">
          <span class="status-dot rx"></span>
          RX: {{ rxCount }}
        </span>
      </div>
      
      <div class="status-right">
        <label class="auto-scroll">
          <input v-model="autoScroll" type="checkbox" />
          <span>自动滚动</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Clock,
  Hash,
  Columns,
  Search,
  X,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-vue-next';
import { VirtualList, LogItem, LogFilter, LogStorage } from '../utils/virtualList';

// 配置
const ITEM_HEIGHT = 28;
const OVERSCAN = 5;

// Refs
const logContainerRef = ref<HTMLDivElement>();
const virtualList = ref<VirtualList<LogItem>>();
const logStorage = ref<LogStorage>(new LogStorage());
const logFilter = ref<LogFilter>(new LogFilter());

// 状态
const showTimestamp = ref(true);
const isHexMode = ref(true);
const showDualMode = ref(false);
const autoScroll = ref(true);
const searchPattern = ref('');
const filterDirection = ref('');
const filterPort = ref('');

// 虚拟滚动状态
const visibleLogs = ref<Array<LogItem & { offsetY: number }>>([]);
const totalHeight = ref(0);
const scrollTop = ref(0);

// 统计数据
const totalLogs = computed(() => logStorage.value.getTotalCount());
const filteredLogs = computed(() => {
  // 实际过滤后的日志数
  return logStorage.value.getTotalCount();
});

const txCount = computed(() => {
  let count = 0;
  logStorage.value.forEach((item) => {
    if (item.direction === 'tx') count++;
  });
  return count;
});

const rxCount = computed(() => {
  let count = 0;
  logStorage.value.forEach((item) => {
    if (item.direction === 'rx') count++;
  });
  return count;
});

const availablePorts = computed(() => {
  const ports = new Set<string>();
  logStorage.value.forEach((item) => {
    ports.add(item.portName);
  });
  return Array.from(ports);
});

// 初始化虚拟列表
onMounted(() => {
  if (logContainerRef.value) {
    virtualList.value = new VirtualList<LogItem>({
      itemHeight: ITEM_HEIGHT,
      overscan: OVERSCAN,
      containerHeight: logContainerRef.value.clientHeight,
    });
    
    // 监听串口数据
    // listen('serial-data', handleSerialData);
  }
  
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 处理滚动
const handleScroll = () => {
  if (!logContainerRef.value || !virtualList.value) return;
  
  scrollTop.value = logContainerRef.value.scrollTop;
  const state = virtualList.value.updateScroll(scrollTop.value);
  
  updateVisibleLogs(state);
};

// 更新可见日志
const updateVisibleLogs = (state: {
  startIndex: number;
  endIndex: number;
  visibleData: LogItem[];
  totalHeight: number;
  offsetY: number;
}) => {
  totalHeight.value = state.totalHeight;
  
  visibleLogs.value = state.visibleData.map((item, idx) => ({
    ...item,
    offsetY: (state.startIndex + idx) * ITEM_HEIGHT,
  }));
};

// 应用搜索
const applySearch = () => {
  if (searchPattern.value) {
    if (isHexMode.value) {
      logFilter.value.setHexPattern(searchPattern.value);
    } else {
      logFilter.value.setAsciiPattern(searchPattern.value);
    }
  } else {
    logFilter.value.setHexPattern(undefined);
    logFilter.value.setAsciiPattern(undefined);
  }
  // 重新过滤并更新显示
  refreshLogs();
};

const clearSearch = () => {
  searchPattern.value = '';
  logFilter.value.setHexPattern(undefined);
  logFilter.value.setAsciiPattern(undefined);
  refreshLogs();
};

// 应用过滤器
const applyFilter = () => {
  logFilter.value.setDirection(filterDirection.value as 'tx' | 'rx' || undefined);
  logFilter.value.setPortName(filterPort.value || undefined);
  refreshLogs();
};

// 刷新日志显示
const refreshLogs = () => {
  // 获取所有日志并过滤
  const allLogs: LogItem[] = [];
  logStorage.value.forEach((item) => allLogs.push(item));
  
  const filtered = logFilter.value.filter(allLogs);
  
  if (virtualList.value) {
    virtualList.value.setData(filtered);
    const state = virtualList.value.updateScroll(scrollTop.value);
    updateVisibleLogs(state);
  }
};

// 高亮匹配项
const isHighlighted = (item: LogItem): boolean => {
  if (!searchPattern.value) return false;
  
  const content = isHexMode.value
    ? bytesToHex(item.data)
    : bytesToString(item.data);
  
  try {
    const regex = new RegExp(searchPattern.value, 'i');
    return regex.test(content);
  } catch {
    return content.includes(searchPattern.value);
  }
};

// 格式化函数
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
};

const bytesToHex = (data: Uint8Array): string => {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

const bytesToString = (data: Uint8Array): string => {
  return new TextDecoder().decode(data);
};

// 导出和清空
const handleExport = () => {
  const content = logStorage.value.exportToText(isHexMode.value ? 'hex' : 'ascii');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `serial-log-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleClear = () => {
  logStorage.value.clear();
  if (virtualList.value) {
    virtualList.value.clear();
    visibleLogs.value = [];
    totalHeight.value = 0;
  }
};

const handleResize = () => {
  if (logContainerRef.value && virtualList.value) {
    const state = virtualList.value.updateContainerHeight(logContainerRef.value.clientHeight);
    updateVisibleLogs(state);
  }
};
</script>

<style scoped>
.log-panel-enhanced {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(26, 31, 43, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(15, 17, 21, 0.4);
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

.tool-btn.active {
  background: rgba(14, 165, 199, 0.15);
  border-color: rgba(14, 165, 199, 0.3);
  color: var(--color-primary-400);
}

.tool-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-error);
}

.tool-icon {
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
}

/* Search Box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  stroke-width: 1.5;
  color: var(--color-text-tertiary);
}

.search-input {
  width: 180px;
  padding: 6px 28px 6px 32px;
  font-size: 12px;
  color: var(--color-text-primary);
  background: rgba(15, 17, 21, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(14, 165, 199, 0.15);
}

.search-clear {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 3px;
}

.search-clear:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-secondary);
}

.clear-icon {
  width: 12px;
  height: 12px;
  stroke-width: 1.5;
}

/* Filter Select */
.filter-select {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--color-text-primary);
  background: rgba(15, 17, 21, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  outline: none;
  cursor: pointer;
}

.filter-select:focus {
  border-color: var(--color-primary-500);
}

/* Log Stats */
.log-stats {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
}

/* Log Container */
.log-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  background: rgba(15, 17, 21, 0.3);
}

.log-spacer {
  position: relative;
}

.log-item {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  white-space: nowrap;
  font-feature-settings: 'tnum';
  transition: background 0.1s ease;
}

.log-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.log-item.highlighted {
  background: rgba(251, 191, 36, 0.1);
}

.log-item.tx {
  background-color: rgba(14, 165, 199, 0.04);
}

.log-item.rx {
  background-color: rgba(34, 197, 94, 0.04);
}

.log-timestamp {
  color: var(--color-text-tertiary);
  min-width: 100px;
  flex-shrink: 0;
  font-size: 11px;
  letter-spacing: 0.3px;
}

.log-direction {
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.direction-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.direction-icon.tx {
  color: var(--color-primary-500);
}

.direction-icon.rx {
  color: var(--color-success);
}

.log-port {
  min-width: 80px;
  color: var(--color-text-tertiary);
  font-size: 11px;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
}

.log-content.dual {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.log-hex {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-hex.full-width {
  grid-column: 1 / -1;
}

.log-ascii {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(15, 17, 21, 0.4);
}

.status-left {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.tx {
  background: var(--color-primary-500);
  box-shadow: 0 0 4px var(--color-primary-500);
}

.status-dot.rx {
  background: var(--color-success);
  box-shadow: 0 0 4px var(--color-success);
}

.auto-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.auto-scroll input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary-500);
  cursor: pointer;
}

/* Scrollbar */
.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-track {
  background: transparent;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
