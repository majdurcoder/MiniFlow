import { useEffect, useState, useCallback, useMemo } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

interface HistoryEntry {
  id: string;
  timestamp: string;
  transcript: string;
  entry_type: string;
}

function waitForTauri(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).__TAURI_INTERNALS__) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).__TAURI_INTERNALS__) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 5000);
  });
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await waitForTauri();
  return tauriInvoke<T>(cmd, args);
}

export function TranscriptViewer() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "dictation" | "command">("all");

  const loadTranscripts = useCallback(async () => {
    try {
      const data = await invoke<HistoryEntry[]>("get_history");
      setEntries(data.reverse());
    } catch (e) {
      console.error("Failed to load transcripts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.entry_type !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return e.transcript.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, search, filter]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
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
    <div className="h-screen w-screen flex flex-col bg-mini-bg text-mini-text font-body">
      {/* Header */}
      <header className="px-6 py-5 border-b border-mini-border/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-lg tracking-widest text-mini-accent">
              Transcripts
            </h1>
            <p className="font-display text-mini-text-muted mt-0.5" style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}>
              {filtered.length} of {entries.length} transcripts
            </p>
          </div>
          <button
            onClick={loadTranscripts}
            className="px-3 py-1.5 font-display uppercase text-mini-text-muted hover:text-mini-text border border-mini-border/50 rounded-sm transition-colors"
            style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}
          >
            Refresh
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts..."
            className="input-field flex-1"
          />
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`font-display uppercase px-3 py-1 rounded-sm transition-all duration-200 ${
                  filter === f.value
                    ? "text-mini-deep"
                    : "text-mini-text-muted border border-mini-border/30 hover:text-mini-text"
                }`}
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                  ...(filter === f.value
                    ? {
                        background: "linear-gradient(135deg, #1E3A5F, #2E5FA3)",
                        border: "1px solid #2E5FA3",
                      }
                    : {}),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-mini-text-muted font-body italic">Loading transcripts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mini-text-muted">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-body text-lg">
              {search ? "No matching transcripts" : "No transcripts yet"}
            </p>
            <p className="font-body text-sm mt-1 opacity-60">
              Hold Fn to start dictating
            </p>
          </div>
        ) : (
          <div className="divide-y divide-mini-border/20">
            {filtered.map((entry, i) => (
              <div
                key={entry.id}
                className="relative px-6 py-5 hover:bg-mini-surface/50 transition-colors overflow-hidden"
              >
                {/* Left accent */}
                <div
                  className="absolute top-0 left-0 bottom-0 w-[3px]"
                  style={{
                    background: entry.entry_type === "command" ? "#1E3A5F" : "#2D6A4F",
                  }}
                />

                <div className="flex items-start gap-4 pl-2">
                  <span className="font-display text-mini-text-muted mt-1 w-4 text-right" style={{ fontSize: "0.7rem" }}>
                    {filtered.length - i}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`font-display uppercase px-1.5 py-0.5 rounded-sm ${
                          entry.entry_type === "command"
                            ? "bg-mini-accent/10 text-mini-accent"
                            : "bg-mini-success/10 text-mini-success"
                        }`}
                        style={{ fontSize: "0.6rem", letterSpacing: "0.1em" }}
                      >
                        {entry.entry_type}
                      </span>
                      <span className="font-display text-mini-text-muted" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="font-body text-mini-text leading-relaxed" style={{ fontSize: "1.05rem" }}>
                      {entry.transcript}
                    </p>
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
          MiniFlow Transcripts
        </span>
      </footer>
    </div>
  );
}

export default TranscriptViewer;
