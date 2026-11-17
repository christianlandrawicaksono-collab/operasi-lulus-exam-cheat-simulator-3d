/**
 * Procedural Web Audio API Sound System
 * Menghasilkan efek audio realistis tanpa ketergantungan aset eksternal.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.heartbeatOsc = null;
    this.heartbeatInterval = null;
    this.isHeartbeatPlaying = false;
    this.pencilNoiseNode = null;
    this.pencilGain = null;
    this.isWritingSound = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopHeartbeat();
      this.stopWritingSound();
    }
    return !this.isMuted;
  }

  // --- Suara Detak Jantung (Heartbeat) saat Kecurigaan Tinggi ---
  updateHeartbeat(suspicionPercent) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    if (suspicionPercent < 35) {
      this.stopHeartbeat();
      return;
    }

    // Interval berbanding terbalik dengan kecurigaan: makin curiga, makin cepat (1100ms -> 380ms)
    const factor = Math.min(1, (suspicionPercent - 35) / 65);
    const intervalMs = 1000 - factor * 650;

    if (!this.isHeartbeatPlaying) {
      this.isHeartbeatPlaying = true;
      this.startHeartbeatLoop(intervalMs);
    } else {
      // Update interval jika sudah berjalan
      this.currentHeartbeatIntervalMs = intervalMs;
    }
  }

  startHeartbeatLoop(initialInterval) {
    this.currentHeartbeatIntervalMs = initialInterval;
    const beat = () => {
      if (!this.isHeartbeatPlaying || this.isMuted) return;
      this.playThump(60, 0.12, 0.35); // Lub
      setTimeout(() => {
        if (!this.isHeartbeatPlaying || this.isMuted) return;
        this.playThump(50, 0.15, 0.25); // Dub
      }, 140);

      this.heartbeatTimeout = setTimeout(beat, this.currentHeartbeatIntervalMs);
    };
    beat();
  }

  playThump(freq, duration, volume) {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  stopHeartbeat() {
    this.isHeartbeatPlaying = false;
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // --- Suara Menulis Pensil di Kertas LJK ---
  startWritingSound() {
    if (this.isMuted || this.isWritingSound) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25;
      }

      this.pencilNoiseNode = this.ctx.createBufferSource();
      this.pencilNoiseNode.buffer = buffer;
      this.pencilNoiseNode.loop = true;

      // Bandpass filter agar terasa seperti gesekan grafit pensil pada kertas
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 2.5;

      this.pencilGain = this.ctx.createGain();
      this.pencilGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.pencilNoiseNode.connect(filter);
      filter.connect(this.pencilGain);
      this.pencilGain.connect(this.ctx.destination);

      this.pencilNoiseNode.start();
      this.isWritingSound = true;
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  stopWritingSound() {
    if (!this.isWritingSound) return;
    try {
      if (this.pencilNoiseNode) {
        this.pencilNoiseNode.stop();
        this.pencilNoiseNode.disconnect();
      }
    } catch (e) {}
    this.isWritingSound = false;
    this.pencilNoiseNode = null;
  }

  // --- Suara Gemerisik Kertas (Contekan) ---
  playPaperRustle() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const duration = 0.2;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {}
  }

  // --- Suara "Aha! / Kunci Dihafal" (Success Chime) ---
  playIdeaChime() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  // --- Suara Soal Terisi Selesai ---
  playQuestionComplete() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // --- Suara Peringatan / Bahaya Pengawas Curiga ---
  playSuspicionWarning() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // --- Suara Peluit / Tertangkap (Game Over) ---
  playCaughtWhistle() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.stopHeartbeat();
    this.stopWritingSound();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  // --- Suara Bel Kemenangan ---
  playVictoryJingle() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.stopHeartbeat();
    this.stopWritingSound();

    const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.2);
    });
  }
}
