import { useState, useCallback, KeyboardEvent } from "react";
import { useAppStore } from "../stores/appStore";
import { executeCommand } from "../lib/bridge";

export function CommandBar() {
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const transcriptSegments = useAppStore((s) => s.transcriptSegments);
  const hasOpenAIKey = useAppStore((s) => s.hasOpenAIKey);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setShowActionPanel = useAppStore((s) => s.setShowActionPanel);

  const handleExecute = useCallback(
    async (text?: string) => {
      const commandText = text || command || transcriptSegments.map((s) => s.text).join(" ");
      if (!commandText.trim()) return;
      if (!hasOpenAIKey) { setShowSettings(true); return; }

      setIsExecuting(true);
      setShowActionPanel(true);
      try {
        await executeCommand(commandText.trim());
      } catch (err) {
        console.error("Failed to execute command:", err);
      } finally {
        setIsExecuting(false);
        setCommand("");
      }
    },
    [command, transcriptSegments, hasOpenAIKey, setShowSettings, setShowActionPanel]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  const isWorking = isExecuting || agentStatus !== "idle";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#C0C0BE" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or ask AI..."
          disabled={isWorking}
          className="w-full h-11 rounded-xl border pl-10 pr-10 text-sm font-sans outline-none transition-colors"
          style={{ background: "#F8F8F7", borderColor: "#E5E5E3", color: "#1C1C1E" }}
          onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
        />
        {isWorking && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E5FA3" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        )}
      </div>

      <button
        onClick={() => handleExecute()}
        disabled={isWorking}
        className="h-11 px-4 rounded-xl text-sm font-sans font-medium transition-all flex items-center gap-2"
        style={{
          background: isWorking ? "#F3F3F1" : "#1C1C1E",
          color: isWorking ? "#8A8A8E" : "#FFFFFF",
          cursor: isWorking ? "wait" : "pointer",
        }}
      >
        {isWorking ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Working
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            {command ? "Send" : "Execute"}
          </>
        )}
      </button>
    </div>
  );
}
