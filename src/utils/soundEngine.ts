import { safeStorage } from './safeStorage';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled = safeStorage.getItem('block_blast_sound') !== 'false';
  public vibrationEnabled = safeStorage.getItem('block_blast_vibration') !== 'false';
  public bgmEnabled = safeStorage.getItem('block_blast_bgm') !== 'false';
  
  private bgmInterval: number | null = null;
  private initialized = false;

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (!this.initialized) {
       this.initialized = true;
       if (this.bgmEnabled) {
          this.startBGM();
       }
    }
  }

  // Helper to attach to global events
  public unlockAudio() {
     this.init();
     if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
     }
  }

  setSoundEnabled(enabled: boolean) {
     this.soundEnabled = enabled;
     safeStorage.setItem('block_blast_sound', String(enabled));
  }
  
  setVibrationEnabled(enabled: boolean) {
     this.vibrationEnabled = enabled;
     safeStorage.setItem('block_blast_vibration', String(enabled));
  }
  
  setBGMEnabled(enabled: boolean) {
     this.bgmEnabled = enabled;
     safeStorage.setItem('block_blast_bgm', String(enabled));
     if (enabled && this.ctx) {
        this.startBGM();
     } else {
        this.stopBGM();
     }
  }

  startBGM() {
    if (!this.bgmEnabled || !this.ctx || this.bgmInterval) return;
    
    const notes = [220, 261.63, 329.63, 392.00, 329.63, 261.63]; // A3, C4, E4, G4, E4, C4
    let step = 0;
    
    this.bgmInterval = window.setInterval(() => {
        if (!this.ctx || !this.bgmEnabled) { this.stopBGM(); return; }
        const freq = notes[step % notes.length];
        this.playTone(freq, 'sine', 0.6, 0.015);
        step++;
    }, 600);
  }

  stopBGM() {
     if (this.bgmInterval) {
         clearInterval(this.bgmInterval);
         this.bgmInterval = null;
     }
  }

  vibrate(pattern: number | number[]) {
    if (this.vibrationEnabled && navigator.vibrate) {
      // Catch errors just in case browser blocks it
      try { navigator.vibrate(pattern); } catch(e) {}
    }
  }

  playClick() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(450, 'sine', 0.08, 0.95);
    this.vibrate(30);
  }

  playPlace() {
    if (!this.soundEnabled) return;
    this.init();
    // Crisp 2-step satisfying digital clicky snap
    this.playTone(280, 'square', 0.12, 0.98);
    setTimeout(() => this.playTone(420, 'triangle', 0.15, 0.98), 40);
    this.vibrate(45);
  }

  playClear() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(650, 'triangle', 0.25, 0.98);
    setTimeout(() => this.playTone(850, 'triangle', 0.25, 0.98), 70);
    setTimeout(() => this.playTone(1100, 'sine', 0.35, 1.2), 140);
    this.vibrate([100, 50, 100]);
  }

  playError() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(180, 'sawtooth', 0.25, 0.95);
    setTimeout(() => this.playTone(130, 'sawtooth', 0.25, 0.95), 100);
    this.vibrate([50, 50, 50]);
  }

  playGameOver() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(220, 'sawtooth', 0.4, 0.95);
    setTimeout(() => this.playTone(170, 'sawtooth', 0.5, 0.98), 200);
    setTimeout(() => this.playTone(120, 'sawtooth', 0.6, 1.2), 500);
    this.vibrate([200, 100, 300, 100, 400]);
  }

  playBomb() {
    if (!this.soundEnabled) return;
    this.init();
    // Exploding bass sound
    this.playTone(80, 'sawtooth', 0.8, 1.5);
    this.playTone(120, 'square', 0.4, 1.2);
    setTimeout(() => this.playTone(60, 'sawtooth', 1.0, 1.8), 100);
    this.vibrate([300, 50, 400]);
  }

  playSelect() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(600, 'sine', 0.05, 0.98); // Quick pop
    this.vibrate(20);
  }

  playDeselect() {
    if (!this.soundEnabled) return;
    this.init();
    this.playTone(300, 'sawtooth', 0.15, 0.95);
    this.playTone(200, 'sine', 0.2, 0.95);
    this.vibrate(30);
  }

  speakWord(word: string) {
    if (!this.soundEnabled) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = 1.35; // Energetic, fast pace
        utterance.pitch = 1.6; // High futuristic synth pitch
        utterance.volume = 1.5; // Maximum output volume
        window.speechSynthesis.speak(utterance);
      } else {
        // High-pitched synth celebratory backup chord
        this.playTone(523, 'sawtooth', 0.3, 0.95);
        setTimeout(() => this.playTone(659, 'sine', 0.35, 0.98), 100);
      }
    } catch (e) {}
  }

  private async playTone(freq: number, type: OscillatorType, dur: number, vol: number = 0.1) {
    if (!this.ctx) return;
    try {
      // Resume context if suspended (browser security)
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Amplified multiplier for extremely loud & rich sound outputs
      const loudVol = vol * 1.8;
      gain.gain.setValueAtTime(loudVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }
}

export const sound = new SoundEngine();
