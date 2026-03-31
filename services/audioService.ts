/**
 * AudioService provides a robust way to generate realistic phone sounds
 * using the Web Audio API, avoiding external file loading issues.
 */

class AudioService {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: any = null;

  private initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Plays a realistic ringback tone (tuuuut... tuuuut...)
   */
  playRingback() {
    this.stopAll();
    this.initContext();
    if (!this.audioCtx) return;

    const playTone = () => {
      if (!this.audioCtx) return;
      
      // Create oscillator for the tone (400Hz + 450Hz is standard for some regions)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(400, this.audioCtx.currentTime);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(450, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 2.0); // 2 seconds tone

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start();
      osc2.start();
      
      // Stop after 2 seconds
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        osc1.disconnect();
        osc2.disconnect();
        gain.disconnect();
      }, 2000);
    };

    // Initial play
    playTone();
    
    // Repeat every 4 seconds (2s tone + 2s silence)
    this.intervalId = setInterval(playTone, 4000);
  }

  /**
   * Plays a realistic hang-up tone (beep-beep-beep)
   */
  playHangup() {
    this.stopAll();
    this.initContext();
    if (!this.audioCtx) return;

    const playBeep = (startTime: number) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    };

    const now = this.audioCtx.currentTime;
    playBeep(now);
    playBeep(now + 0.3);
    playBeep(now + 0.6);
  }

  stopAll() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const audioService = new AudioService();
