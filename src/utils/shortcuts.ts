/**
 * 全局快捷键管理
 * 集成 Tauri 全局快捷键和本地键盘事件处理
 */

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface ShortcutCallbacks {
  onSend?: () => void;
  onClear?: () => void;
  onNewline?: () => void;
}

class ShortcutManager {
  private callbacks: ShortcutCallbacks = {};
  private isInputFocused = false;
  private unlisten?: () => void;

  /**
   * 初始化快捷键监听
   */
  public async init(callbacks: ShortcutCallbacks): Promise<void> {
    this.callbacks = callbacks;

    // 监听 Tauri 全局快捷键事件
    const unlistenFn = await listen<string>('global-shortcut', (event) => {
      this.handleGlobalShortcut(event.payload);
    });

    this.unlisten = unlistenFn;

    // 监听输入框焦点状态
    this.setupFocusTracking();

    // 设置本地键盘事件监听（作为后备）
    this.setupLocalKeyboardListener();
  }

  /**
   * 处理全局快捷键
   */
  private handleGlobalShortcut(action: string): void {
    switch (action) {
      case 'send':
        // 只有在输入框聚焦时才触发发送
        if (this.isInputFocused && this.callbacks.onSend) {
          this.callbacks.onSend();
        }
        break;
      case 'clear':
        // Ctrl+K 总是触发清屏
        if (this.callbacks.onClear) {
          this.callbacks.onClear();
        }
        break;
      case 'newline':
        // Shift+Enter 在输入框中插入换行
        if (this.isInputFocused && this.callbacks.onNewline) {
          this.callbacks.onNewline();
        }
        break;
    }
  }

  /**
   * 设置焦点追踪
   */
  private setupFocusTracking(): void {
    // 监听输入框的 focus/blur 事件
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      this.isInputFocused = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
    });

    document.addEventListener('focusout', () => {
      // 延迟检查，因为 focusout 后立即可能有 focusin
      setTimeout(() => {
        this.isInputFocused = document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable || false;
      }, 0);
    });
  }

  /**
   * 设置本地键盘监听
   * 作为 Tauri 全局快捷键的后备方案
   */
  private setupLocalKeyboardListener(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K - 清屏
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (this.callbacks.onClear) {
          this.callbacks.onClear();
        }
        return;
      }

      // 只在输入框聚焦时处理 Enter 相关快捷键
      if (!this.isInputFocused) return;

      // Shift+Enter - 换行
      if (e.shiftKey && e.key === 'Enter') {
        // 让默认行为发生（插入换行）
        return;
      }

      // Enter - 发送
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.callbacks.onSend) {
          this.callbacks.onSend();
        }
      }
    });
  }

  /**
   * 手动触发发送
   */
  public triggerSend(): void {
    invoke('trigger_send').catch(console.error);
  }

  /**
   * 手动触发清屏
   */
  public triggerClear(): void {
    invoke('trigger_clear').catch(console.error);
  }

  /**
   * 销毁
   */
  public destroy(): void {
    if (this.unlisten) {
      this.unlisten();
    }
  }
}

// 单例实例
let instance: ShortcutManager | null = null;

export function getShortcutManager(): ShortcutManager {
  if (!instance) {
    instance = new ShortcutManager();
  }
  return instance;
}

export function initShortcuts(callbacks: ShortcutCallbacks): Promise<void> {
  return getShortcutManager().init(callbacks);
}

export function destroyShortcuts(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

/**
 * Vue 组合式函数 - 在组件中使用
 */
import { onMounted, onUnmounted } from 'vue';

export function useShortcuts(callbacks: ShortcutCallbacks) {
  onMounted(() => {
    initShortcuts(callbacks);
  });

  onUnmounted(() => {
    // 注意：这里不销毁，因为快捷键是全局的
    // 只有在应用退出时才销毁
  });

  return {
    triggerSend: () => getShortcutManager().triggerSend(),
    triggerClear: () => getShortcutManager().triggerClear(),
  };
}
