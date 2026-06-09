// Web Audio sidetone. A single persistent sine oscillator is gated by a gain
// node with short ramps to avoid clicks. The AudioContext is created lazily and
// resumed on the first user gesture (browser autoplay policy).

const RAMP = 0.005; // seconds — envelope ramp to avoid key clicks

// A 1-second mono silent WAV (8-bit unsigned, midpoint 128 = silence). Played
// as a looping media element on iOS, this flips the page's audio session into
// the "playback" category so the hardware mute switch no longer silences our
// Web Audio sidetone (Safari otherwise treats Web Audio as mutable "ambient").
function silentWavUrl(): string {
  const sampleRate = 8000;
  const n = sampleRate; // 1s of samples
  const bytes = new Uint8Array(44 + n);
  const dv = new DataView(bytes.buffer);
  const w = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i));
  };
  w(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true); // PCM chunk size
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate, true); // byte rate (1 byte/sample, mono)
  dv.setUint16(32, 1, true); // block align
  dv.setUint16(34, 8, true); // bits per sample
  w(36, "data");
  dv.setUint32(40, n, true);
  bytes.fill(128, 44); // 8-bit unsigned silence
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return "data:audio/wav;base64," + btoa(bin);
}

export class Sidetone {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private freq = 600;
  private volume = 0.2;
  /** Set once we've asked iOS to ignore the mute switch (see ensure). */
  private playbackEnabled = false;
  private silentAudio: HTMLAudioElement | null = null;

  setTone(hz: number) {
    this.freq = hz;
    if (this.osc && this.ctx) {
      this.osc.frequency.setValueAtTime(hz, this.ctx.currentTime);
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  // Ask iOS to treat our audio as "playback" so the hardware mute (ring/silent)
  // switch doesn't silence it — like a music/video app rather than a UI beep.
  // Must run inside a user gesture (the media element needs to start playing).
  private enablePlaybackSession() {
    if (this.playbackEnabled) return;
    this.playbackEnabled = true;

    // Modern path: the Audio Session API (Safari 16.4+). Setting "playback"
    // is the supported way to opt out of the mute switch.
    const session = (navigator as unknown as { audioSession?: { type: string } })
      .audioSession;
    if (session) {
      try {
        session.type = "playback";
      } catch {
        // read-only / unsupported value — fall through to the media trick.
      }
    }

    // Fallback for older iOS: start a looping silent media element. Real media
    // playback switches the page's session to the playback category, after
    // which the Web Audio sidetone is also heard with the mute switch on.
    try {
      const a = new Audio(silentWavUrl());
      a.loop = true;
      a.setAttribute("playsinline", "");
      this.silentAudio = a;
      void a.play().catch(() => {});
    } catch {
      // Audio element unavailable — nothing more we can do here.
    }
  }

  /** Create/resume the audio graph. Call from a user-gesture handler. */
  async ensure() {
    this.enablePlaybackSession();
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

  /** A short low buzz to signal a wrong answer. */
  async error() {
    await this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 160;
    osc.connect(g);
    g.connect(this.ctx.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.volume, t + RAMP);
    g.gain.setValueAtTime(this.volume, t + 0.18);
    g.gain.linearRampToValueAtTime(0, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
