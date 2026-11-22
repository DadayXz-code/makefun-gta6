// Puerto Luna — every sound is synthesized live with WebAudio: no audio
// files, no network. The context is created lazily on the first user
// gesture and every call is guarded, so a headless browser never breaks.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    muted: false,
  };

  audio.ensure = function ensure() {
    if (audio.ctx || audio.muted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.4;
      audio.master.connect(audio.ctx.destination);
      // Engine hum: a sawtooth whose pitch follows the speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a triangle wave wobbling between two notes.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenLfo = audio.ctx.createOscillator();
      audio.sirenLfo.type = 'square';
      audio.sirenLfo.frequency.value = 0.7;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 220;
      audio.sirenLfo.connect(lfoGain);
      lfoGain.connect(audio.sirenOsc.frequency);
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenLfo.start();
    } catch {
      audio.ctx = null;
    }
  };

  audio.engine = function engine(speedRatio, driving) {
    if (!audio.ctx || audio.muted) return;
    try {
      const target = driving ? 0.05 + 0.06 * speedRatio : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(46 + 150 * speedRatio, audio.ctx.currentTime, 0.1);
    } catch {
      // Ignore audio glitches; the game must never stop for sound.
    }
  };

  audio.siren = function siren(on) {
    if (!audio.ctx || audio.muted) return;
    try {
      audio.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, audio.ctx.currentTime, 0.2);
    } catch {
      // Ignore.
    }
  };

  function blip(freq, dur, type, vol) {
    if (!audio.ctx || audio.muted) return;
    try {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.2, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc.stop(audio.ctx.currentTime + dur);
    } catch {
      // Ignore.
    }
  }

  function noise(dur, vol, low) {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 900;
      const gain = audio.ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    } catch {
      // Ignore.
    }
  }

  audio.shot = function shot() {
    noise(0.12, 0.4, 2400);
  };
  audio.crash = function crash() {
    noise(0.25, 0.35, 320);
  };
  audio.pickup = function pickup() {
    blip(660, 0.09, 'sine', 0.22);
    setTimeout(() => blip(990, 0.12, 'sine', 0.2), 70);
  };
  audio.jingle = function jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
  };
  audio.fail = function fail() {
    blip(220, 0.25, 'sawtooth', 0.15);
    setTimeout(() => blip(165, 0.35, 'sawtooth', 0.15), 160);
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) {
      try {
        audio.master.gain.value = audio.muted ? 0 : 0.4;
      } catch {
        // Ignore.
      }
    }
    return audio.muted;
  };

  return audio;
}
