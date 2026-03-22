/**
 * 高性能波形渲染器 - WebGL 实现
 * 支持每秒数千个点的实时绘制而不阻塞 UI
 */

export interface WaveformData {
  timestamp: number;
  values: Float32Array; // 多通道数据
}

export interface WaveformConfig {
  channels: number;
  colors: string[];
  sampleRate: number;
  timeWindow: number; // 显示时间窗口 (ms)
  yMin: number;
  yMax: number;
}

export class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  
  // 双缓冲数据
  private dataBufferA: Float32Array[] = [];
  private dataBufferB: Float32Array[] = [];
  private activeBuffer: 'A' | 'B' = 'A';
  private isSwapping = false;
  
  // 渲染状态
  private animationId: number | null = null;
  private lastRenderTime = 0;
  private frameInterval = 1000 / 60;
  
  // 数据队列
  private pendingData: WaveformData[] = [];
  private maxQueueSize = 1000;
  
  constructor(canvas: HTMLCanvasElement, private config: WaveformConfig) {
    this.canvas = canvas;
    this.initWebGL();
    this.initBuffers();
  }

  private initWebGL(): boolean {
    const gl = this.canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    }) || this.canvas.getContext('experimental-webgl') as WebGLRenderingContext;

    if (!gl) {
      console.error('WebGL not supported, falling back to Canvas2D');
      return false;
    }

    this.gl = gl;
    
    // 顶点着色器 - 简单的线条绘制
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      varying vec4 v_color;
      
      uniform vec2 u_resolution;
      uniform vec2 u_scale;
      uniform vec2 u_offset;
      
      void main() {
        vec2 clipSpace = ((a_position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        v_color = a_color;
      }
    `;

    // 片段着色器
    const fragmentShaderSource = `
      precision mediump float;
      varying vec4 v_color;
      
      void main() {
        gl_FragColor = v_color;
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return false;

    this.program = this.createProgram(vertexShader, fragmentShader);
    if (!this.program) return false;

    // 设置视口
    this.resize();
    gl.clearColor(0.06, 0.07, 0.08, 1.0);
    
    return true;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
    if (!this.gl) return null;
    const program = this.gl.createProgram();
    if (!program) return null;
    
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }

  private initBuffers(): void {
    // 为每个通道初始化双缓冲
    for (let i = 0; i < this.config.channels; i++) {
      this.dataBufferA.push(new Float32Array(0));
      this.dataBufferB.push(new Float32Array(0));
    }
  }

  /**
   * 添加数据到队列 - 非阻塞接口
   */
  public pushData(data: WaveformData): void {
    if (this.pendingData.length >= this.maxQueueSize) {
      // 队列满时丢弃最旧的数据
      this.pendingData.shift();
    }
    this.pendingData.push(data);
  }

  /**
   * 双缓冲数据交换
   */
  private swapBuffers(): void {
    if (this.isSwapping) return;
    this.isSwapping = true;

    // 将 pendingData 写入非活动缓冲区
    const targetBuffer = this.activeBuffer === 'A' ? this.dataBufferB : this.dataBufferA;
    
    // 处理队列中的数据
    while (this.pendingData.length > 0) {
      const data = this.pendingData.shift();
      if (!data) continue;

      // 按通道分发数据
      for (let ch = 0; ch < this.config.channels && ch < data.values.length; ch++) {
        const oldData = targetBuffer[ch];
        const newData = new Float32Array(oldData.length + 1);
        newData.set(oldData);
        newData[oldData.length] = data.values[ch];
        
        // 限制缓冲区大小，保持时间窗口内的数据
        const maxPoints = Math.ceil(this.config.timeWindow / 1000 * this.config.sampleRate);
        if (newData.length > maxPoints) {
          targetBuffer[ch] = newData.slice(newData.length - maxPoints);
        } else {
          targetBuffer[ch] = newData;
        }
      }
    }

    // 原子交换缓冲区指针
    this.activeBuffer = this.activeBuffer === 'A' ? 'B' : 'A';
    this.isSwapping = false;
  }

  /**
   * 渲染循环 - 使用 requestAnimationFrame
   */
  public startRender(): void {
    const render = (currentTime: number) => {
      const deltaTime = currentTime - this.lastRenderTime;
      
      // 限制帧率
      if (deltaTime >= this.frameInterval) {
        this.lastRenderTime = currentTime - (deltaTime % this.frameInterval);
        
        // 在渲染前交换缓冲区
        this.swapBuffers();
        this.render();
      }
      
      this.animationId = requestAnimationFrame(render);
    };
    
    this.animationId = requestAnimationFrame(render);
  }

  public stopRender(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private render(): void {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    const currentData = this.activeBuffer === 'A' ? this.dataBufferA : this.dataBufferB;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // 设置 uniform
    const resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);

    // 绘制每个通道
    for (let ch = 0; ch < this.config.channels; ch++) {
      this.drawChannel(ch, currentData[ch]);
    }
  }

  private drawChannel(channel: number, data: Float32Array): void {
    if (!this.gl || !this.program || data.length < 2) return;

    const gl = this.gl;
    const positions: number[] = [];
    const colors: number[] = [];

    // 转换数据为顶点坐标
    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = 40;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;

    const color = this.hexToRgb(this.config.colors[channel] || '#0ea5c7');

    for (let i = 0; i < data.length; i++) {
      const x = padding + (i / (data.length - 1)) * graphWidth;
      const normalizedY = (data[i] - this.config.yMin) / (this.config.yMax - this.config.yMin);
      const y = height - padding - normalizedY * graphHeight;

      positions.push(x, y);
      colors.push(color.r / 255, color.g / 255, color.b / 255, 1.0);
    }

    // 创建并绑定位置缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    const positionLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // 创建并绑定颜色缓冲区
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);

    const colorLoc = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

    // 绘制线条
    gl.drawArrays(gl.LINE_STRIP, 0, data.length);

    // 清理
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 14, g: 165, b: 199 };
  }

  public resize(): void {
    if (!this.gl) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public destroy(): void {
    this.stopRender();
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}

/**
 * Canvas 2D 降级渲染器 - 用于 WebGL 不支持的环境
 */
export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: Float32Array[] = [];
  private animationId: number | null = null;

  constructor(canvas: HTMLCanvasElement, private config: WaveformConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    
    for (let i = 0; i < config.channels; i++) {
      this.data.push(new Float32Array(0));
    }
    
    this.resize();
  }

  public pushData(data: WaveformData): void {
    for (let ch = 0; ch < this.config.channels && ch < data.values.length; ch++) {
      const oldData = this.data[ch];
      const newData = new Float32Array(oldData.length + 1);
      newData.set(oldData);
      newData[oldData.length] = data.values[ch];
      
      const maxPoints = Math.ceil(this.config.timeWindow / 1000 * this.config.sampleRate);
      this.data[ch] = newData.length > maxPoints 
        ? newData.slice(newData.length - maxPoints) 
        : newData;
    }
  }

  public startRender(): void {
    const render = () => {
      this.render();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  public stopRender(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 绘制网格
    this.drawGrid();

    // 绘制波形
    for (let ch = 0; ch < this.config.channels; ch++) {
      this.drawChannel(ch, this.data[ch]);
    }
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // 垂直网格
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 水平网格
    for (let i = 0; i <= 8; i++) {
      const y = (height / 8) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private drawChannel(channel: number, data: Float32Array): void {
    if (data.length < 2) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = 40;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;

    ctx.strokeStyle = this.config.colors[channel] || '#0ea5c7';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    
    for (let i = 0; i < data.length; i++) {
      const x = padding + (i / (data.length - 1)) * graphWidth;
      const normalizedY = (data[i] - this.config.yMin) / (this.config.yMax - this.config.yMin);
      const y = height - padding - normalizedY * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
  }

  public destroy(): void {
    this.stopRender();
  }
}

/**
 * 渲染器工厂 - 自动选择最佳渲染方式
 */
export function createWaveformRenderer(
  canvas: HTMLCanvasElement, 
  config: WaveformConfig
): WaveformRenderer | Canvas2DRenderer {
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (gl) {
    console.log('Using WebGL renderer');
    return new WaveformRenderer(canvas, config);
  } else {
    console.log('Using Canvas2D renderer (WebGL not available)');
    return new Canvas2DRenderer(canvas, config);
  }
}
