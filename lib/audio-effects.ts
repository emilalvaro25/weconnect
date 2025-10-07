/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Manages audio effects like reverb and delay for a given AudioContext.
 */
export class AudioEffects {
  public input: GainNode;
  public output: GainNode;

  // Reverb nodes
  private reverb: ConvolverNode;
  private reverbWet: GainNode;
  private reverbDry: GainNode;
  private isReverbEnabled = false;

  // Delay (Echo) nodes
  private delay: DelayNode;
  private delayWet: GainNode;
  private delayDry: GainNode;
  private feedback: GainNode;
  private isDelayEnabled = false;

  constructor(private context: AudioContext) {
    this.input = this.context.createGain();
    this.output = this.context.createGain();

    // === Reverb Setup ===
    this.reverb = this.context.createConvolver();
    this.reverbWet = this.context.createGain();
    this.reverbDry = this.context.createGain();

    this.reverb.buffer = this.createImpulseResponse(); // Use a synthetic impulse response
    this.reverbWet.gain.value = 0; // Start with effect off
    this.reverbDry.gain.value = 1; // Start with dry signal passthrough

    // === Delay Setup ===
    this.delay = this.context.createDelay(2.0); // Max 2-second delay
    this.delayWet = this.context.createGain();
    this.delayDry = this.context.createGain();
    this.feedback = this.context.createGain();

    this.delay.delayTime.value = 0.5; // Default delay time
    this.feedback.gain.value = 0.4; // Default feedback
    this.delayWet.gain.value = 0; // Start with effect off
    this.delayDry.gain.value = 1; // Start with dry signal passthrough

    // === Routing ===
    // Input -> Reverb Path -> Delay Path -> Output
    this.input.connect(this.reverbDry);
    this.input.connect(this.reverb);
    this.reverb.connect(this.reverbWet);

    this.reverbDry.connect(this.delayDry);
    this.reverbWet.connect(this.delayDry); // Mix reverb output into delay's dry path

    this.reverbDry.connect(this.delay);
    this.reverbWet.connect(this.delay); // Mix reverb output into delay's wet path

    // Delay internal feedback loop
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);

    // Connect delay paths to output
    this.delay.connect(this.delayWet);
    this.delayDry.connect(this.output);
    this.delayWet.connect(this.output);
  }

  // --- Reverb Controls ---
  public toggleReverb(active: boolean) {
    this.isReverbEnabled = active;
    this.reverbWet.gain.setTargetAtTime(active ? 0.8 : 0, this.context.currentTime, 0.01);
    this.reverbDry.gain.setTargetAtTime(active ? 0.8 : 1, this.context.currentTime, 0.01);
  }

  public setReverbMix(value: number) {
    if (!this.isReverbEnabled) return;
    this.reverbWet.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    this.reverbDry.gain.setTargetAtTime(1 - value, this.context.currentTime, 0.01);
  }

  // --- Delay (Echo) Controls ---
  public toggleDelay(active: boolean) {
    this.isDelayEnabled = active;
    this.delayWet.gain.setTargetAtTime(active ? 0.5 : 0, this.context.currentTime, 0.01);
  }

  public setDelayTime(value: number) {
    this.delay.delayTime.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  public setDelayFeedback(value: number) {
    this.feedback.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  public setDelayMix(value: number) {
    if (!this.isDelayEnabled) return;
    this.delayWet.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }

  /**
   * Generates a synthetic impulse response for the convolver node.
   * This avoids needing to load an external audio file.
   */
  private createImpulseResponse(): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2; // 2 seconds reverb
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2.5);
      right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2.5);
    }
    return impulse;
  }
}
