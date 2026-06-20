class SoundEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled = localStorage.getItem('block_blast_sound') !== 'false';
  public vibrationEnabled = localStorage.getItem('block_blast_vibration') !== 'false';
  public bgmEnabled = localStorage.getItem('block_blast_bgm') !== 'false';
  
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

  setSoundEnabled(enabled: boolean) {
     this.soundEnabled = enabled;
     localStorage.setItem('block_blast_sound', String(enabled));
  }
  
  setVibrationEnabled(enabled: boolean) {
     this.vibrationEnabled = enabled;
     localStorage.setItem('block_blast_vibration', String(enabled));
  }
  
  setBGMEnabled(enabled: boolean) {
     this.bgmEnabled = enabled;
     localStorage.setItem('block_blast_bgm', String(enabled));
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
    if (this.soundEnabled && this.ctx) this.playTone(400, 'square', 0.1, 0.05);
    this.vibrate(30);
  }

  playPlace() {
    if (this.soundEnabled && this.ctx) this.playTone(300, 'sine', 0.15, 0.1);
    this.vibrate(40);
  }

  playClear() {
    if (this.soundEnabled && this.ctx) {
       this.playTone(600, 'triangle', 0.15, 0.15);
       setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.15), 100);
    }
    this.vibrate([100, 50, 100]);
  }

  playError() {
    if (this.soundEnabled && this.ctx) {
       this.playTone(150, 'sawtooth', 0.15, 0.15);
       setTimeout(() => this.playTone(100, 'sawtooth', 0.2, 0.15), 100);
    }
    this.vibrate([50, 50, 50]);
  }

  playGameOver() {
    if (this.soundEnabled && this.ctx) {
       this.playTone(200, 'sawtooth', 0.3, 0.2);
       setTimeout(() => this.playTone(150, 'sawtooth', 0.4, 0.3), 200);
       setTimeout(() => this.playTone(100, 'sawtooth', 0.5, 0.3), 500);
    }
    this.vibrate([200, 100, 300, 100, 400]);
  }

  private playTone(freq: number, type: OscillatorType, dur: number, vol: number = 0.1) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }
}

export const sound = new SoundEngine();
