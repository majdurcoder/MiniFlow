import { useCallback, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { startListening, stopListening } from "../lib/bridge";

export function MicrophoneButton() {
  const isListening = useAppStore((s) => s.isListening);
  const setListening = useAppStore((s) => s.setListening);
  const hasDeepgramKey = useAppStore((s) => s.hasDeepgramKey);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const [isLoading, setIsLoading] = useState(false);
  const { start: startCapture, stop: stopCapture } = useAudioCapture();

  const toggleListening = useCallback(async () => {
    if (isLoading) return;
    if (!hasDeepgramKey) { setShowSettings(true); return; }

    setIsLoading(true);
    try {
      if (isListening) {
        stopCapture();
        await stopListening();
        setListening(false);
      } else {
        const sampleRate = await startCapture();
        await startListening(sampleRate);
        setListening(true);
      }
    } catch (err) {
      console.error("[MiniFlow] Error:", err);
      stopCapture();
      try { await stopListening(); } catch {}
      setListening(false);
    } finally {
      setIsLoading(false);
    }
  }, [isListening, isLoading, hasDeepgramKey, setListening, setShowSettings, startCapture, stopCapture]);

  return (
    <button
      onClick={toggleListening}
      disabled={isLoading}
      className="relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
      style={{
        background: isListening ? "#FEE2E2" : "#F3F3F1",
        border: `1.5px solid ${isListening ? "#FECACA" : "#E5E5E3"}`,
        color: isListening ? "#9B1C1C" : "#6B6B70",
        cursor: isLoading ? "wait" : "pointer",
        opacity: isLoading ? 0.6 : 1,
      }}
      title={isLoading ? "Connecting..." : isListening ? "Stop" : "Start listening"}
    >
      {/* Pulse when listening */}
      {isListening && !isLoading && (
        <span
          className="absolute inset-0 rounded-full animate-pulse-ring"
          style={{ background: "rgba(220, 38, 38, 0.15)" }}
        />
      )}
      {isLoading ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : isListening ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
      )}
    </button>
  );
}
