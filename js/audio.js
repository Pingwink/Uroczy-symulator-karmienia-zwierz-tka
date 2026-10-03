// Procedural Depressive Audio Engine via Web Audio API
class HorrorAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.masterGain = null;
    this.droneGain = null;
    this.heartbeatInterval = null;
    this.hungerLevel = 0.5; // 0 to 1
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientDrone();
      this.startHeartbeatLoop();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  startAmbientDrone() {
    if (!this.ctx) return;

    // Sub-bass drone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.droneGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(43.65, this.ctx.currentTime); // F1
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(44.2, this.ctx.currentTime); // Slight detune for pulsing dread

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, this.ctx.currentTime);
    filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.droneGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    osc1.start();
    osc2.start();

    // Cold wind generator (filtered pink noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // Subtle LFO modulation on wind frequency
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    whiteNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);
    whiteNoise.start();
  }

  setHunger(hungerRatio) {
    this.hungerLevel = Math.max(0, Math.min(1, hungerRatio));
    if (this.droneGain && this.ctx) {
      // Drone gets louder and harsher as hunger peaks
      const targetGain = 0.15 + this.hungerLevel * 0.25;
      this.droneGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.5);
    }
  }

  startHeartbeatLoop() {
    const triggerBeat = () => {
      if (this.ctx && !this.isMuted) {
        // High hunger means faster heartbeat
        const delay = 1800 - this.hungerLevel * 1200; // 1800ms down to 600ms
        this.playHeartbeat();
        this.heartbeatInterval = setTimeout(triggerBeat, Math.max(500, delay));
      } else {
        this.heartbeatInterval = setTimeout(triggerBeat, 1000);
      }
    };
    triggerBeat();
  }

  playHeartbeat() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // Lub
    this.createThump(now, 55, 0.4 * (0.4 + this.hungerLevel * 0.6));
    // Dub
    this.createThump(now + 0.15, 45, 0.25 * (0.4 + this.hungerLevel * 0.6));
  }

  createThump(time, freq, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(20, time + 0.12);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  playSquelch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Wet FM squelch
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(320, now);
    carrier.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(45, now);
    modGain.gain.setValueAtTime(180, now);
    modGain.gain.exponentialRampToValueAtTime(10, now + 0.18);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + 0.22);
    modulator.stop(now + 0.22);
  }

  playFleshDrop() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    this.createThump(now, 90, 0.4);
    this.playSquelch();
  }

  playMonsterGrowl() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Guttural wolf roar/growl
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.4);
    osc.frequency.linearRampToValueAtTime(50, now + 0.8);

    // Formant filter for throat resonance
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, now);
    filter.Q.setValueAtTime(5.0, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.9);
  }

  playCrunchBite() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Heavy visceral bone crunch (sharp noise burst)
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // 2. Wet tearing flesh impact
    this.playSquelch();
    setTimeout(() => this.playSquelch(), 70);

    // 3. Low impact sub slam
    this.createThump(now, 75, 0.6);
  }

  playFootstep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Deep heavy stomp
    this.createThump(now, 48, 0.25);

    // Gravel rock crunch
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(2.0, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  playCavernDrip() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 1200 + Math.random() * 600;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playDiceRoll() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.055 + Math.random() * 0.02;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650 + Math.random() * 450, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.035);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    }
  }

  playCritical() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [220, 277.18, 329.63, 440];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.18, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.75);
    });
  }
}

export const horrorAudio = new HorrorAudioEngine();
