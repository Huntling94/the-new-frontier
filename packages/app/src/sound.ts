/**
 * Synthesised sound, from the squad test (S2.3b decision 10). Nothing is loaded:
 * every sound is built from oscillators and noise. There is no background drone
 * or music, which wait for S5.
 */

export type SoundName =
  | 'swing'
  | 'hit'
  | 'crit'
  | 'shoot'
  | 'hurt'
  | 'pickup'
  | 'gold'
  | 'level'
  | 'dash'
  | 'potion'
  | 'slam'
  | 'boss'
  | 'forge'
  | 'fail'
  | 'beacon'
  | 'click';

const VOLUME = 0.5;
const SILENT = 0.0001;
const LOWEST_PITCH = 20;
const TAIL = 0.02;

export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Starts audio. Browsers allow it only from a press, so the Start button calls this. */
  start(): void {
    if (this.context) return;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  /** `N` (D-013). */
  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : VOLUME;
  }

  /** The volume reaching the speakers, for tests. */
  get level(): number {
    return this.master?.gain.value ?? 0;
  }

  get running(): boolean {
    return this.context !== null;
  }

  play(name: SoundName): void {
    if (!this.context || this.muted) return;
    SOUNDS[name](this);
  }

  tone(frequency: number, seconds = 0.12, type: OscillatorType = 'square', volume = 0.12, slide = 0, delay = 0): void {
    const { context, master } = this;
    if (!context || !master) return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(LOWEST_PITCH, frequency + slide), at + seconds);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(SILENT, at + seconds);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + seconds + TAIL);
  }

  noiseHit(seconds = 0.12, frequency = 1800, volume = 0.2, q = 1): void {
    const { context, master } = this;
    if (!context || !master) return;
    if (!this.noise) {
      this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
    }
    const at = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(SILENT, at + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random());
    source.stop(at + seconds + TAIL);
  }
}

const chord = (sound: Sound, notes: readonly number[], seconds: number, volume: number, gap: number, type: OscillatorType = 'triangle'): void => {
  notes.forEach((note, index) => sound.tone(note, seconds, type, volume, 0, index * gap));
};

/** The squad test's sounds, unchanged. */
const SOUNDS: Readonly<Record<SoundName, (sound: Sound) => void>> = {
  swing: (s) => s.noiseHit(0.13, 2600, 0.09, 3),
  hit: (s) => {
    s.noiseHit(0.09, 900, 0.22);
    s.tone(150, 0.08, 'triangle', 0.13, -80);
  },
  crit: (s) => {
    s.noiseHit(0.16, 500, 0.3);
    s.tone(420, 0.14, 'sawtooth', 0.08, -280);
  },
  shoot: (s) => {
    s.noiseHit(0.14, 1400, 0.26, 0.7);
    s.tone(210, 0.1, 'square', 0.05, -140);
  },
  hurt: (s) => {
    s.tone(120, 0.2, 'sawtooth', 0.17, -60);
    s.noiseHit(0.14, 400, 0.2);
  },
  pickup: (s) => {
    s.tone(740, 0.07, 'triangle', 0.08);
    s.tone(990, 0.1, 'triangle', 0.08, 0, 0.06);
  },
  gold: (s) => s.tone(1320, 0.06, 'triangle', 0.05),
  level: (s) => chord(s, [392, 523, 659, 784, 1047], 0.28, 0.1, 0.09),
  dash: (s) => s.noiseHit(0.2, 700, 0.12, 0.6),
  potion: (s) => s.tone(330, 0.3, 'sine', 0.15, 500),
  slam: (s) => {
    s.noiseHit(0.4, 160, 0.5, 0.5);
    s.tone(70, 0.4, 'sine', 0.3, -30);
  },
  boss: (s) => {
    s.tone(82, 1.3, 'sawtooth', 0.16, -30);
    s.tone(55, 1.5, 'sine', 0.3);
  },
  forge: (s) => {
    s.noiseHit(0.2, 3200, 0.22, 8);
    s.tone(1760, 0.4, 'sine', 0.06);
  },
  fail: (s) => {
    s.tone(200, 0.5, 'sawtooth', 0.13, -150);
    s.noiseHit(0.35, 300, 0.2);
  },
  beacon: (s) => chord(s, [261, 392, 523, 784, 1047, 1568], 0.9, 0.1, 0.16, 'sine'),
  click: (s) => s.tone(880, 0.04, 'triangle', 0.05),
};
