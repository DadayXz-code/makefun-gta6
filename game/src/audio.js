// Procedural sound for Puerto Luna — everything is synthesized with the
// Web Audio API, so the game ships no audio files at all.
//
// The set: an engine hum whose pitch follows the car's speed, a two-tone
// police siren, a gunshot crack, a crash thud for wrecks and spike strips,
// and a bright chime for mission payouts. Nothing starts until the player
// presses a key (`ensure()`), because browsers block audio before the
// first user gesture; `setMuted` silences the master gain without
// tearing the graph down.
export class Sound {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.noiseBuffer = null;
  }

  ensure() {
    if (!this.context) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      const length = this.context.sampleRate;
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  burst(when, duration, filterFreq, peak) {
    if (!this.context) return;
    const src = this.context.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  tone(when, freq, duration, type, peak) {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  shot() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.burst(now, 0.14, 2600, 0.9);
    this.tone(now, 150, 0.09, 'square', 0.25);
  }

  crash() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.burst(now, 0.5, 420, 1.0);
    this.tone(now, 70, 0.4, 'sine', 0.6);
  }

  chime() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.tone(now, 660, 0.18, 'sine', 0.3);
    this.tone(now + 0.12, 880, 0.26, 'sine', 0.3);
  }

  horn() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.tone(now, 370, 0.22, 'square', 0.22);
    this.tone(now, 466, 0.22, 'square', 0.18);
  }

  engine(speed, inCar) {
    if (!this.context) return;
    if (!inCar) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const now = this.context.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 0.45, now, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.11, now, 0.08);
  }

  siren(on) {
    if (!this.context) return;
    if (!on) {
      if (this.sirenOsc) this.sirenGain.gain.setTargetAtTime(0, this.context.currentTime, 0.15);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.context.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.context.createGain();
      this.sirenGain.gain.value = 0;
      const lfo = this.context.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.context.createGain();
      lfoGain.gain.value = 240;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 780;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.05, this.context.currentTime, 0.15);
  }
}
