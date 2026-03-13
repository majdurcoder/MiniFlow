import { useEffect, useState, useCallback } from "react";
import { getHistory, clearHistory } from "./lib/bridge";

interface HistoryAction {
  action: string;
  success: boolean;
  message: string;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  transcript: string;
  entry_type: string;
  actions: HistoryAction[];
  success: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  open_browser_tab: "Open Tab",
  search_google: "Google Search",
  open_application: "Open App",
  quit_application: "Quit App",
  clipboard_write: "Copy to Clipboard",
  clipboard_read: "Read Clipboard",
  open_finder: "Open Finder",
  create_file: "Create File",
  move_file: "Move File",
  response: "Response",
};

export function HistoryWindow() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getHistory();
      setEntries((data as HistoryEntry[]).reverse());
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    try {
      await clearHistory();
      setEntries([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-mini-bg text-mini-text font-body">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-mini-border/30">
        <div>
          <h1 className="font-display text-lg tracking-widest text-mini-accent">History</h1>
          <p className="font-display text-mini-text-muted mt-0.5" style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadHistory}
            className="px-3 py-1.5 font-display uppercase text-mini-text-muted hover:text-mini-text border border-mini-border/50 rounded-sm transition-colors"
            style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}
          >
            Refresh
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 font-display uppercase text-mini-error hover:text-mini-error/80 border border-mini-error/30 rounded-sm transition-colors"
              style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}
            >
              Clear All
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-mini-text-muted font-body italic">Loading history...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mini-text-muted">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="font-body text-lg">No history yet</p>
            <p className="font-body text-sm mt-1 opacity-60">
              Hold Fn to start dictating
            </p>
          </div>
        ) : (
          <div className="divide-y divide-mini-border/20">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-6 py-5 hover:bg-mini-surface/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Type indicator */}
                  <div
                    className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                      entry.entry_type === "command"
                        ? "bg-mini-accent/15 text-mini-accent"
                        : "bg-mini-success/15 text-mini-success"
                    }`}
                  >
                    {entry.entry_type === "command" ? "\u26A1" : "\u2328"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`font-display uppercase px-1.5 py-0.5 rounded-sm ${
                          entry.entry_type === "command"
                            ? "bg-mini-accent/10 text-mini-accent"
                            : "bg-mini-success/10 text-mini-success"
                        }`}
                        style={{ fontSize: "0.65rem", letterSpacing: "0.1em" }}
                      >
                        {entry.entry_type === "command" ? "Action" : "Dictation"}
                      </span>
                      <span className="font-display text-mini-text-muted" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>

                    <p className="font-body text-mini-text/90 mb-2" style={{ fontSize: "1rem" }}>
                      &ldquo;{entry.transcript}&rdquo;
                    </p>

                    {entry.actions.length > 0 && (
                      <div className="space-y-1.5">
                        {entry.actions.map((action, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm font-body ${
                              action.success
                                ? "bg-mini-success/5 text-mini-success"
                                : "bg-mini-error/5 text-mini-error"
                            }`}
                            style={{ fontSize: "0.85rem" }}
                          >
                            <span className="font-medium italic">
                              {ACTION_LABELS[action.action] || action.action}
                            </span>
                            <span className="text-mini-text-muted truncate flex-1">
                              {action.message}
                            </span>
                            <span>{action.success ? "\u2713" : "\u2717"}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.entry_type === "dictation" && entry.actions.length === 0 && (
                      <div className="flex items-center gap-2 text-mini-text-muted font-body italic" style={{ fontSize: "0.85rem" }}>
                        <span>\u2328</span>
                        <span>Typed into focused app</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 py-2 border-t border-mini-border/20 text-center">
        <span className="font-display text-mini-text-muted/50" style={{ fontSize: "0.65rem", letterSpacing: "0.1em" }}>
          MiniFlow History &mdash; Hold{" "}
          <kbd className="px-1 py-0.5 rounded-sm border border-mini-border text-mini-text-muted font-display" style={{ fontSize: "0.6rem" }}>
            Fn
          </kbd>{" "}
          to dictate
        </span>
      </footer>
    </div>
  );
}

export default HistoryWindow;
