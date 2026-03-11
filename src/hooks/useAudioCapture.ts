import { useCallback, useRef } from "react";
import { sendAudioChunk } from "../lib/bridge";

// AudioWorklet processor code — captures PCM and converts float32 to int16
const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];
      if (this.bufferIndex >= this.bufferSize) {
        // Convert float32 [-1, 1] to int16 [-32768, 32767]
        const int16 = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function useAudioCapture() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const start = useCallback(async (): Promise<number> => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Use the system's native sample rate — don't force 16kHz as
      // WebKit may not support it and silently fall back to 44100/48000
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const actualSampleRate = audioContext.sampleRate;
      console.log(`[MiniFlow] Audio context sample rate: ${actualSampleRate}`);

      // Create and load the AudioWorklet processor
      const blob = new Blob([workletCode], {
        type: "application/javascript",
      });
      const workletUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Connect the microphone to the worklet
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      // Handle audio chunks from the worklet
      let chunkCount = 0;
      workletNode.port.onmessage = async (event: MessageEvent) => {
        const base64Chunk = arrayBufferToBase64(event.data);
        chunkCount++;
        if (chunkCount <= 3) {
          console.log(
            `[MiniFlow] Sending audio chunk #${chunkCount}, size=${event.data.byteLength} bytes`
          );
        }
        try {
          await sendAudioChunk(base64Chunk);
        } catch (err) {
          console.error("[MiniFlow] Failed to send audio chunk:", err);
        }
      };

      // Connect source -> worklet (don't connect to destination to avoid feedback)
      source.connect(workletNode);

      return actualSampleRate;
    } catch (err) {
      console.error("[MiniFlow] Failed to start audio capture:", err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    console.log("[MiniFlow] Audio capture stopped");
  }, []);

  return { start, stop };
}
