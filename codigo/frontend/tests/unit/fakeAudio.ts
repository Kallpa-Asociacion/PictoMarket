import { vi } from 'vitest';

// Minimal Web Audio double: records what the engine creates and schedules.
class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  setTargetAtTime(value: number) {
    this.value = value;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
export class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = '';
  buffer: unknown = null;
  disconnected = false;
  connect(node: FakeNode) {
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
  start() {}
  stop() {}
}
export class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new FakeNode();
  gains: FakeNode[] = [];
  sources: FakeNode[] = [];
  constructor() {
    FakeAudioContext.created.push(this);
  }
  createGain() {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeNode();
    this.sources.push(node);
    return node;
  }
  createBufferSource() {
    return this.createOscillator();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}
