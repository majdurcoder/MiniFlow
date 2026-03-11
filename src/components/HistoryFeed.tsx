import { useEffect, useState, useCallback, useMemo } from "react";
import { getHistory, clearHistory } from "../lib/bridge";
import { Trash2, RefreshCw } from "lucide-react";

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

export function HistoryFeed() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "dictation" | "command">("all");

  const loadHistory = useCallback(async () => {
    try {
      const data = await getHistory();
      setEntries(data.reverse());
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  const handleClear = async () => {
    try {
      await clearHistory();
      setEntries([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.entry_type !== filter) return false;
      if (search.trim()) {
        return e.transcript.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [entries, search, filter]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  const FILTERS: { value: "all" | "dictation" | "command"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "dictation", label: "Dictation" },
    { value: "command", label: "Commands" },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="font-display uppercase tracking-widest text-mini-accent"
          style={{ fontSize: "0.8rem", letterSpacing: "0.1em" }}
        >
          History
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            className="p-1.5 text-mini-text-muted hover:text-mini-accent-light transition-colors rounded-sm"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="p-1.5 text-mini-text-muted hover:text-mini-error transition-colors rounded-sm"
              title="Clear history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="input-field flex-1 !py-1.5 !text-sm"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`font-display uppercase px-2.5 py-1 rounded-sm transition-all duration-200 ${
                filter === f.value
                  ? "text-mini-deep"
                  : "text-mini-text-muted hover:text-mini-text"
              }`}
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                ...(filter === f.value
                  ? {
                      background: "linear-gradient(135deg, #1E3A5F, #2E5FA3)",
                      border: "1px solid #2E5FA3",
                    }
                  : { border: "1px solid transparent" }),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-mini-text-muted font-body italic text-sm">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-mini-text-muted">
            <svg className="w-10 h-10 mb-2 opacity-15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm font-body">
              {search ? "No matching entries" : "No history yet"}
            </p>
            <p className="text-xs font-body mt-0.5 opacity-60">
              Hold Fn to start dictating
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="relative bg-mini-surface-light/60 border border-mini-border/20 rounded-lg p-3 overflow-hidden transition-colors hover:border-mini-border/40"
              >
                {/* Left accent */}
                <div
                  className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-lg"
                  style={{
                    background: entry.entry_type === "command" ? "#1E3A5F" : "#2D6A4F",
                  }}
                />

                <div className="pl-2">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-display uppercase px-1.5 py-0.5 rounded-sm ${
                        entry.entry_type === "command"
                          ? "bg-mini-accent/10 text-mini-accent"
                          : "bg-mini-success/10 text-mini-success"
                      }`}
                      style={{ fontSize: "0.6rem", letterSpacing: "0.08em" }}
                    >
                      {entry.entry_type === "command" ? "Command" : "Dictation"}
                    </span>
                    <span
                      className="font-display text-mini-text-muted"
                      style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}
                    >
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>

                  {/* Transcript text */}
                  <p className="font-body text-mini-text leading-snug" style={{ fontSize: "0.9rem" }}>
                    {entry.transcript}
                  </p>

                  {/* Action results */}
                  {entry.actions && entry.actions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.actions.map((action, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-body ${
                            action.success
                              ? "bg-mini-success/5 text-mini-success"
                              : "bg-mini-error/5 text-mini-error"
                          }`}
                        >
                          <span className="font-medium">
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

                  {entry.entry_type === "dictation" && (!entry.actions || entry.actions.length === 0) && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-mini-text-muted font-body italic" style={{ fontSize: "0.75rem" }}>
                      <span>{"\u2328"}</span>
                      <span>Typed into focused app</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
