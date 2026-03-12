/**
 * PCM Processor Worklet
 *
 * Resamples microphone audio from the native sample rate (typically 48kHz)
 * to 16kHz, buffers into 500ms chunks (8000 samples), converts to Int16 PCM,
 * and posts each chunk to the main thread.
 */

const TARGET_SAMPLE_RATE = 16_000;
const CHUNK_SAMPLES = 8_000; // 500ms at 16kHz

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(CHUNK_SAMPLES);
    this._buffered = 0;
    // Pre-compute step: how many source samples per output sample
    // e.g., 48000/16000 = 3.0 (exact decimation), 44100/16000 ≈ 2.756
    this._resampleStep = sampleRate / TARGET_SAMPLE_RATE;

    // Fractional position tracker for linear interpolation resampling
    this._resampleOffset = 0;

    // DC offset removal state (single-pole HPF at ~20Hz)
    this._dcPrev = 0;
    this._dcPrevInput = 0;

    // Throttle level messages: accumulate RMS across blocks, emit every ~50ms
    this._levelSum = 0;
    this._levelCount = 0;
    this._levelInterval = Math.ceil(sampleRate / 128 / 20); // ~20 updates/sec

    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this._flush();
      }
    };
  }

  /**
   * Called by the Audio Worklet runtime with 128 Float32 samples per block.
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0]; // mono — first channel only

    // Post RMS level for the UI meter
    this._postLevel(channel);

    if (this._resampleStep <= 1.0) {
      // Audio is already at target rate (AudioContext created at 16kHz)
      // — direct buffer with DC offset removal
      for (let i = 0; i < channel.length; i++) {
        this._buffer[this._buffered++] = this._removeDCOffset(channel[i]);
        if (this._buffered >= CHUNK_SAMPLES) this._emitChunk();
      }
    } else {
      // Fallback: resample from higher native rate (keep existing path)
      this._resample(channel);
    }

    return true;
  }

  /**
   * Linear-interpolation resampler.
   * Walks through the input at steps of (targetRate / nativeRate) and
   * interpolates between adjacent source samples.
   */
  _resample(input) {
    const step = this._resampleStep;
    let offset = this._resampleOffset;

    while (offset < input.length) {
      const idx = Math.floor(offset);
      const frac = offset - idx;
      const a = input[idx];
      const b = idx + 1 < input.length ? input[idx + 1] : a;
      const sample = a + frac * (b - a);

      this._buffer[this._buffered++] = this._removeDCOffset(sample);

      if (this._buffered >= CHUNK_SAMPLES) {
        this._emitChunk();
      }

      offset += step;
    }

    // Carry fractional remainder into the next process() call
    this._resampleOffset = offset - input.length;
  }

  /**
   * Single-pole high-pass filter at ~20Hz to remove DC offset.
   * y[n] = x[n] - x[n-1] + 0.998 * y[n-1]
   */
  _removeDCOffset(sample) {
    const y = sample - this._dcPrevInput + 0.998 * this._dcPrev;
    this._dcPrevInput = sample;
    this._dcPrev = y;
    return y;
  }

  /**
   * Convert the Float32 buffer to Int16 PCM and post to main thread.
   */
  _emitChunk() {
    const pcm = this._float32ToInt16(this._buffer, this._buffered);
    this.port.postMessage({ type: 'chunk', pcm }, [pcm.buffer]);
    this._buffered = 0;
    // Reuse this._buffer — only the Int16Array was transferred
  }

  /**
   * Flush any remaining buffered samples (partial chunk) when recording stops.
   */
  _flush() {
    if (this._buffered > 0) {
      const pcm = this._float32ToInt16(this._buffer, this._buffered);
      this.port.postMessage({ type: 'chunk', pcm }, [pcm.buffer]);
      this._buffered = 0;
    }
    this.port.postMessage({ type: 'flush-done' });
  }

  /**
   * Convert Float32 samples [-1, 1] to Int16 [-32768, 32767].
   * Applies TPDF dither to prevent quantization artifacts in quiet passages.
   */
  _float32ToInt16(float32, length) {
    const int16 = new Int16Array(length);
    const ditherAmt = 1.0 / 32768.0; // 1 LSB in float domain
    for (let i = 0; i < length; i++) {
      // TPDF dither: triangular probability density function
      const dither = (Math.random() + Math.random() - 1.0) * ditherAmt;
      const s = Math.max(-1, Math.min(1, float32[i] + dither));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  /**
   * Accumulate RMS energy and post to main thread at ~20Hz for the level meter.
   */
  _postLevel(channel) {
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    this._levelSum += sum / channel.length;
    this._levelCount++;

    if (this._levelCount >= this._levelInterval) {
      const rms = Math.sqrt(this._levelSum / this._levelCount);
      this.port.postMessage({ type: 'level', rms });
      this._levelSum = 0;
      this._levelCount = 0;
    }
  }
}

registerProcessor('pcm-processor', PcmProcessor);
