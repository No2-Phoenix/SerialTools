/**
 * 虚拟滚动列表实现
 * 支持处理 100 万行日志不卡顿
 */

export interface VirtualListOptions {
  itemHeight: number;
  overscan: number; // 额外渲染的项数，用于平滑滚动
  containerHeight: number;
}

export interface VirtualListState {
  startIndex: number;
  endIndex: number;
  visibleData: any[];
  totalHeight: number;
  offsetY: number;
}

export class VirtualList<T> {
  private data: T[] = [];
  private options: VirtualListOptions;
  private scrollTop: number = 0;
  private containerHeight: number = 0;
  
  // 性能优化：使用对象池缓存可见项
  private visibleItemCache: Map<number, T> = new Map();
  private lastStartIndex: number = -1;
  private lastEndIndex: number = -1;

  constructor(options: VirtualListOptions) {
    this.options = options;
    this.containerHeight = options.containerHeight;
  }

  /**
   * 设置数据 - 支持大数据量
   */
  public setData(data: T[]): void {
    this.data = data;
    this.visibleItemCache.clear();
  }

  /**
   * 追加数据 - 日志场景常用
   */
  public appendData(items: T[]): void {
    const startIndex = this.data.length;
    this.data.push(...items);
    
    // 如果新数据在可视范围内，更新缓存
    const state = this.calculateVisibleRange();
    if (startIndex <= state.endIndex) {
      items.forEach((item, idx) => {
        const globalIndex = startIndex + idx;
        if (globalIndex >= state.startIndex && globalIndex <= state.endIndex) {
          this.visibleItemCache.set(globalIndex, item);
        }
      });
    }
  }

  /**
   * 更新滚动位置
   */
  public updateScroll(scrollTop: number): VirtualListState {
    this.scrollTop = scrollTop;
    return this.calculateVisibleRange();
  }

  /**
   * 更新容器高度
   */
  public updateContainerHeight(height: number): VirtualListState {
    this.containerHeight = height;
    return this.calculateVisibleRange();
  }

  /**
   * 计算可见范围 - 核心算法
   */
  private calculateVisibleRange(): VirtualListState {
    const { itemHeight, overscan } = this.options;
    const totalHeight = this.data.length * itemHeight;
    
    // 计算起始索引
    let startIndex = Math.floor(this.scrollTop / itemHeight);
    startIndex = Math.max(0, startIndex - overscan);
    
    // 计算结束索引
    let visibleCount = Math.ceil(this.containerHeight / itemHeight);
    let endIndex = startIndex + visibleCount + overscan * 2;
    endIndex = Math.min(this.data.length - 1, endIndex);
    
    // 如果范围没有变化，直接返回缓存结果
    if (startIndex === this.lastStartIndex && endIndex === this.lastEndIndex) {
      return {
        startIndex,
        endIndex,
        visibleData: this.getVisibleData(startIndex, endIndex),
        totalHeight,
        offsetY: startIndex * itemHeight,
      };
    }
    
    this.lastStartIndex = startIndex;
    this.lastEndIndex = endIndex;
    
    // 清理不在范围内的缓存
    this.cleanupCache(startIndex, endIndex);
    
    return {
      startIndex,
      endIndex,
      visibleData: this.getVisibleData(startIndex, endIndex),
      totalHeight,
      offsetY: startIndex * itemHeight,
    };
  }

  /**
   * 获取可见数据
   */
  private getVisibleData(startIndex: number, endIndex: number): T[] {
    const result: T[] = [];
    
    for (let i = startIndex; i <= endIndex && i < this.data.length; i++) {
      // 优先从缓存获取
      let item = this.visibleItemCache.get(i);
      if (!item) {
        item = this.data[i];
        this.visibleItemCache.set(i, item);
      }
      result.push(item);
    }
    
    return result;
  }

  /**
   * 清理不在可见范围内的缓存
   */
  private cleanupCache(startIndex: number, endIndex: number): void {
    const keysToDelete: number[] = [];
    
    for (const key of this.visibleItemCache.keys()) {
      if (key < startIndex || key > endIndex) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.visibleItemCache.delete(key));
  }

  /**
   * 跳转到指定索引
   */
  public scrollToIndex(index: number): number {
    index = Math.max(0, Math.min(index, this.data.length - 1));
    return index * this.options.itemHeight;
  }

  /**
   * 跳转到末尾
   */
  public scrollToBottom(): number {
    if (this.data.length === 0) return 0;
    return this.data.length * this.options.itemHeight - this.containerHeight;
  }

  /**
   * 获取当前数据长度
   */
  public getDataLength(): number {
    return this.data.length;
  }

  /**
   * 清空数据
   */
  public clear(): void {
    this.data = [];
    this.visibleItemCache.clear();
    this.lastStartIndex = -1;
    this.lastEndIndex = -1;
  }

  /**
   * 获取指定索引的数据
   */
  public getItem(index: number): T | undefined {
    return this.data[index];
  }

  /**
   * 二分查找 - 用于时间戳定位
   */
  public binarySearch(
    compareFn: (item: T) => number
  ): number {
    let left = 0;
    let right = this.data.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = compareFn(this.data[mid]);
      
      if (cmp === 0) return mid;
      if (cmp < 0) left = mid + 1;
      else right = mid - 1;
    }
    
    return left;
  }
}

/**
 * 日志项接口
 */
export interface LogItem {
  id: string;
  timestamp: number;
  portName: string;
  direction: 'tx' | 'rx';
  data: Uint8Array;
  hexString?: string;
  asciiString?: string;
}

/**
 * 日志过滤器
 */
export class LogFilter {
  private filters: {
    direction?: 'tx' | 'rx';
    portName?: string;
    hexPattern?: RegExp;
    asciiPattern?: RegExp;
    timeRange?: { start: number; end: number };
  } = {};

  public setDirection(direction?: 'tx' | 'rx'): void {
    this.filters.direction = direction;
  }

  public setPortName(portName?: string): void {
    this.filters.portName = portName;
  }

  public setHexPattern(pattern?: string): void {
    if (pattern) {
      // 将十六进制字符串转换为正则
      // 例如 "01 02" -> /01\s*02/i
      const hexRegex = pattern.replace(/\s+/g, '\\s*');
      this.filters.hexPattern = new RegExp(hexRegex, 'i');
    } else {
      this.filters.hexPattern = undefined;
    }
  }

  public setAsciiPattern(pattern?: string): void {
    if (pattern) {
      this.filters.asciiPattern = new RegExp(pattern, 'i');
    } else {
      this.filters.asciiPattern = undefined;
    }
  }

  public setTimeRange(start?: number, end?: number): void {
    if (start !== undefined && end !== undefined) {
      this.filters.timeRange = { start, end };
    } else {
      this.filters.timeRange = undefined;
    }
  }

  public filter(logs: LogItem[]): LogItem[] {
    return logs.filter(log => {
      // 方向过滤
      if (this.filters.direction && log.direction !== this.filters.direction) {
        return false;
      }

      // 端口名过滤
      if (this.filters.portName && log.portName !== this.filters.portName) {
        return false;
      }

      // 时间范围过滤
      if (this.filters.timeRange) {
        if (log.timestamp < this.filters.timeRange.start || 
            log.timestamp > this.filters.timeRange.end) {
          return false;
        }
      }

      // 十六进制内容过滤
      if (this.filters.hexPattern) {
        const hexStr = this.bytesToHex(log.data);
        if (!this.filters.hexPattern.test(hexStr)) {
          return false;
        }
      }

      // ASCII 内容过滤
      if (this.filters.asciiPattern) {
        const asciiStr = this.bytesToString(log.data);
        if (!this.filters.asciiPattern.test(asciiStr)) {
          return false;
        }
      }

      return true;
    });
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  private bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }
}

/**
 * 高性能日志存储 - 使用分块存储避免大数组操作
 */
export class LogStorage {
  private chunks: LogItem[][] = [[]];
  private chunkSize: number = 10000;
  private totalCount: number = 0;
  private maxChunks: number = 100; // 最多保留 100 万个日志

  constructor(chunkSize: number = 10000) {
    this.chunkSize = chunkSize;
  }

  public push(item: LogItem): void {
    let currentChunk = this.chunks[this.chunks.length - 1];
    
    if (currentChunk.length >= this.chunkSize) {
      // 创建新块
      if (this.chunks.length >= this.maxChunks) {
        // 删除最旧的块
        this.chunks.shift();
      }
      currentChunk = [];
      this.chunks.push(currentChunk);
    }
    
    currentChunk.push(item);
    this.totalCount++;
  }

  public pushBatch(items: LogItem[]): void {
    items.forEach(item => this.push(item));
  }

  public get(index: number): LogItem | undefined {
    const chunkIndex = Math.floor(index / this.chunkSize);
    const itemIndex = index % this.chunkSize;
    
    if (chunkIndex >= this.chunks.length) return undefined;
    
    // 调整索引（考虑可能删除的旧块）
    const actualChunkIndex = chunkIndex - (this.totalCount - this.getTotalCount()) / this.chunkSize;
    if (actualChunkIndex < 0 || actualChunkIndex >= this.chunks.length) return undefined;
    
    return this.chunks[actualChunkIndex]?.[itemIndex];
  }

  public getRange(start: number, end: number): LogItem[] {
    const result: LogItem[] = [];
    
    for (let i = start; i < end && i < this.totalCount; i++) {
      const item = this.get(i);
      if (item) result.push(item);
    }
    
    return result;
  }

  public getTotalCount(): number {
    return Math.min(this.totalCount, this.chunks.length * this.chunkSize);
  }

  public clear(): void {
    this.chunks = [[]];
    this.totalCount = 0;
  }

  /**
   * 遍历所有日志
   */
  public forEach(callback: (item: LogItem, index: number) => void): void {
    let globalIndex = 0;
    for (const chunk of this.chunks) {
      for (const item of chunk) {
        callback(item, globalIndex++);
      }
    }
  }

  /**
   * 导出为文本
   */
  public exportToText(format: 'hex' | 'ascii' = 'hex'): string {
    const lines: string[] = [];
    
    this.forEach((item) => {
      const timestamp = new Date(item.timestamp).toISOString();
      const direction = item.direction.toUpperCase();
      const data = format === 'hex' 
        ? Array.from(item.data).map(b => b.toString(16).padStart(2, '0')).join(' ')
        : new TextDecoder().decode(item.data);
      
      lines.push(`[${timestamp}] ${direction}: ${data}`);
    });
    
    return lines.join('\n');
  }
}
