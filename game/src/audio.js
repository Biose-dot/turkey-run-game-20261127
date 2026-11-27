// Tiny WebAudio synth: every sound is made at run time, no audio files.
// Gobble, dash whoosh, corn ping, hit thud, escape fanfare — all oscillators
// and filtered noise, so the game stays a handful of static files.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  function noise(dur, vol, freq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(c.destination);
      src.start();
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    gobble() {
      tone(320, 0.09, 'square', 0.08, 180);
      setTimeout(() => tone(280, 0.09, 'square', 0.08, 160), 90);
      setTimeout(() => tone(360, 0.12, 'square', 0.09, 200), 180);
    },
    jump() {
      tone(300, 0.14, 'sine', 0.07, 620);
    },
    dash() {
      noise(0.28, 0.16, 1200);
      tone(180, 0.25, 'sawtooth', 0.05, 720);
    },
    corn() {
      tone(880, 0.08, 'sine', 0.09);
      setTimeout(() => tone(1320, 0.1, 'sine', 0.08), 70);
    },
    hit() {
      tone(120, 0.25, 'sawtooth', 0.16, 50);
      noise(0.18, 0.14, 300);
    },
    smash() {
      noise(0.22, 0.18, 700);
      tone(220, 0.18, 'square', 0.1, 90);
    },
    escape() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.1), i * 130));
    },
    caught() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.09), i * 160));
    },
  };
}
