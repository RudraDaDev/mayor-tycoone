// ============================================================================
// ◈ PROJECT CROWN — Retro Pixel Audio & Ambient Music Engine (js/audio.js)
// ============================================================================

class CrownAudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.musicEnabled = false;
    this.sfxVolume = 0.35;
    this.musicVolume = 0.18;
    this.musicTimer = null;
    this.stepIndex = 0;
    this.currentMood = "Spring";
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.08, type = "square", gainVal = 0.12, slideFreq = null) {
    if (!this.sfxEnabled) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideFreq), now + duration);
    }

    const vol = Math.max(0.001, gainVal * this.sfxVolume);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  play(sfxName) {
    if (!this.sfxEnabled) return;
    switch (sfxName) {
      case "click":
        this.playTone(620, 0.04, "square", 0.14, 780);
        break;
      case "tab":
        this.playTone(480, 0.045, "triangle", 0.16, 640);
        break;
      case "cash":
        this.playTone(880, 0.06, "square", 0.15);
        setTimeout(() => this.playTone(1174.66, 0.11, "square", 0.15), 55);
        break;
      case "upgrade":
      case "construct":
        this.playTone(440, 0.07, "square", 0.16);
        setTimeout(() => this.playTone(554.37, 0.07, "square", 0.16), 65);
        setTimeout(() => this.playTone(659.25, 0.12, "square", 0.18), 130);
        break;
      case "research":
        this.playTone(523.25, 0.08, "triangle", 0.2);
        setTimeout(() => this.playTone(659.25, 0.08, "triangle", 0.2), 75);
        setTimeout(() => this.playTone(783.99, 0.08, "triangle", 0.2), 150);
        setTimeout(() => this.playTone(1046.5, 0.18, "triangle", 0.22), 225);
        break;
      case "award":
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 0.12, "square", 0.18), idx * 70);
        });
        break;
      case "alert":
        this.playTone(340, 0.09, "sawtooth", 0.16, 280);
        break;
      case "emergency":
        this.playTone(440, 0.14, "sawtooth", 0.22, 290);
        setTimeout(() => this.playTone(440, 0.16, "sawtooth", 0.22, 260), 160);
        break;
      case "news":
        this.playTone(740, 0.04, "square", 0.12);
        setTimeout(() => this.playTone(740, 0.04, "square", 0.12), 60);
        setTimeout(() => this.playTone(987, 0.08, "square", 0.14), 120);
        break;
      case "horn":
        this.playTone(130.81, 0.35, "sawtooth", 0.14, 123.47);
        break;
      default:
        this.playTone(540, 0.04, "square", 0.12);
    }
  }

  toggleMusic(forceState = null) {
    this.musicEnabled = forceState !== null ? forceState : !this.musicEnabled;
    if (this.musicEnabled) {
      this._startMusicLoop();
    } else {
      this._stopMusicLoop();
    }
    return this.musicEnabled;
  }

  setMood(season = "Spring") {
    this.currentMood = season;
  }

  _startMusicLoop() {
    this._stopMusicLoop();
    const scales = {
      Spring: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
      Summer: [293.66, 329.63, 369.99, 440.00, 493.88, 587.33],
      Autumn: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00],
      Winter: [196.00, 220.00, 246.94, 293.66, 329.63, 392.00]
    };

    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled) return;
      const ctx = this._ensureContext();
      if (!ctx || ctx.state !== "running") return;

      const scale = scales[this.currentMood] || scales.Spring;
      const note = scale[this.stepIndex % scale.length];
      this.stepIndex = (this.stepIndex + (Math.random() < 0.65 ? 1 : 2)) % scale.length;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note, now);

      const v = Math.max(0.001, this.musicVolume * 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(v, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    }, 1400);
  }

  _stopMusicLoop() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new CrownAudioEngine();
