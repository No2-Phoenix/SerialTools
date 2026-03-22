/**
 * 多标签页状态管理
 * 支持同时连接和调试多个串口
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface Tab {
  id: string;
  portName: string;
  title: string;
  isActive: boolean;
  isConnected: boolean;
  config: PortConfig;
  unreadCount: number;
  createdAt: number;
}

export interface PortConfig {
  portName: string;
  baudRate: number;
  dataBits: number;
  parity: 'none' | 'odd' | 'even';
  stopBits: number;
  flowControl: 'none' | 'software' | 'hardware';
}

export const useTabStore = defineStore('tabs', () => {
  // 标签页列表
  const tabs = ref<Tab[]>([]);
  
  // 当前激活的标签页ID
  const activeTabId = ref<string>('');
  
  // 最大标签页数量
  const MAX_TABS = 4;

  // 当前激活的标签页
  const activeTab = computed(() => {
    return tabs.value.find(tab => tab.id === activeTabId.value);
  });

  // 已连接的标签页数量
  const connectedCount = computed(() => {
    return tabs.value.filter(tab => tab.isConnected).length;
  });

  // 是否可以新建标签页
  const canCreateTab = computed(() => {
    return tabs.value.length < MAX_TABS;
  });

  /**
   * 创建新标签页
   */
  function createTab(portName: string, config: PortConfig): Tab | null {
    if (!canCreateTab.value) {
      console.warn(`Maximum tabs limit (${MAX_TABS}) reached`);
      return null;
    }

    // 检查是否已存在相同端口的标签页
    const existingTab = tabs.value.find(tab => tab.portName === portName);
    if (existingTab) {
      // 切换到已存在的标签页
      switchTab(existingTab.id);
      return existingTab;
    }

    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      portName,
      title: portName,
      isActive: true,
      isConnected: false,
      config,
      unreadCount: 0,
      createdAt: Date.now(),
    };

    // 将其他标签页设为非激活
    tabs.value.forEach(tab => {
      tab.isActive = false;
    });

    tabs.value.push(newTab);
    activeTabId.value = newTab.id;

    return newTab;
  }

  /**
   * 切换标签页
   */
  function switchTab(tabId: string) {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab) return;

    // 更新激活状态
    tabs.value.forEach(t => {
      t.isActive = t.id === tabId;
      if (t.id === tabId) {
        t.unreadCount = 0; // 清除未读计数
      }
    });

    activeTabId.value = tabId;
  }

  /**
   * 关闭标签页
   */
  async function closeTab(tabId: string) {
    const index = tabs.value.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = tabs.value[index];
    
    // 如果标签页已连接，先断开连接
    if (tab.isConnected) {
      // 调用断开连接的命令
      // await disconnectPort(tab.portName);
    }

    // 移除标签页
    tabs.value.splice(index, 1);

    // 如果关闭的是当前激活的标签页，切换到其他标签页
    if (tab.isActive && tabs.value.length > 0) {
      const newIndex = Math.min(index, tabs.value.length - 1);
      switchTab(tabs.value[newIndex].id);
    } else if (tabs.value.length === 0) {
      activeTabId.value = '';
    }
  }

  /**
   * 更新标签页连接状态
   */
  function updateTabConnection(tabId: string, isConnected: boolean) {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      tab.isConnected = isConnected;
    }
  }

  /**
   * 更新标签页标题
   */
  function updateTabTitle(tabId: string, title: string) {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      tab.title = title;
    }
  }

  /**
   * 增加未读消息计数
   */
  function incrementUnread(tabId: string) {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab && !tab.isActive) {
      tab.unreadCount++;
    }
  }

  /**
   * 关闭所有标签页
   */
  async function closeAllTabs() {
    // 断开所有连接
    for (const tab of tabs.value) {
      if (tab.isConnected) {
        // await disconnectPort(tab.portName);
      }
    }
    
    tabs.value = [];
    activeTabId.value = '';
  }

  /**
   * 重新排序标签页
   */
  function reorderTabs(newOrder: string[]) {
    const orderedTabs: Tab[] = [];
    
    for (const tabId of newOrder) {
      const tab = tabs.value.find(t => t.id === tabId);
      if (tab) {
        orderedTabs.push(tab);
      }
    }
    
    tabs.value = orderedTabs;
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    connectedCount,
    canCreateTab,
    MAX_TABS,
    createTab,
    switchTab,
    closeTab,
    updateTabConnection,
    updateTabTitle,
    incrementUnread,
    closeAllTabs,
    reorderTabs,
  };
});
