export const MOCK_PORT_NAME = 'MOCK://ReplayPort';

export const isMockPort = (portName: string | null | undefined): boolean => {
  return typeof portName === 'string' && portName.startsWith('MOCK://');
};

type DataHandler = (data: number[]) => void;

class MockSerialReplay {
  private timer: number | null = null;
  private phase = 0;
  private callback: DataHandler | null = null;

  start(handler: DataHandler, intervalMs = 50): void {
    this.stop();
    this.callback = handler;
    this.timer = window.setInterval(() => {
      const frame = this.generateFrame();
      this.callback?.(frame);
    }, intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.callback = null;
  }

  injectResponse(payload: number[]): void {
    if (!this.callback || payload.length === 0) return;
    const response = payload.map((value, index) => {
      const offset = (index % 4) * 3;
      return (value + offset) & 0xff;
    });
    this.callback(response);
  }

  private generateFrame(): number[] {
    const channelCount = 4;
    const pointsPerFrame = 24;
    const bytes: number[] = [];

    for (let i = 0; i < pointsPerFrame; i++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const x = this.phase + i * 0.22 + ch * (Math.PI / 2);
        const wave = Math.sin(x) * 0.6 + Math.sin(x * 0.5) * 0.2;
        const normalized = Math.max(0, Math.min(1, (wave + 1) / 2));
        bytes.push(Math.round(normalized * 255));
      }
    }

    this.phase += 0.08;
    return bytes;
  }
}

export const mockSerialReplay = new MockSerialReplay();
