// Web Audio sidetone. A single persistent sine oscillator is gated by a gain
// node with short ramps to avoid clicks. The AudioContext is created lazily and
// resumed on the first user gesture (browser autoplay policy).

const RAMP = 0.005; // seconds — envelope ramp to avoid key clicks

export class Sidetone {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private freq = 600;
  private volume = 0.2;

  setTone(hz: number) {
    this.freq = hz;
    if (this.osc && this.ctx) {
      this.osc.frequency.setValueAtTime(hz, this.ctx.currentTime);
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  /** Create/resume the audio graph. Call from a user-gesture handler. */
  async ensure() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      this.osc = this.ctx.createOscillator();
      this.osc.type = "sine";
      this.osc.frequency.value = this.freq;
      this.osc.connect(this.gain);
      this.osc.start();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  /** Begin the tone (ramp gain up). */
  keyOn() {
    if (!this.ctx || !this.gain) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(this.volume, t + RAMP);
  }

  /** End the tone (ramp gain down). */
  keyOff() {
    if (!this.ctx || !this.gain) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + RAMP);
  }
}
