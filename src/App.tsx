import { useEffect, useState, useCallback, useMemo } from "react";
import { Sidebar } from "./components/Sidebar";
import { TranscriptionArea } from "./components/TranscriptionArea";
import { MicrophoneButton } from "./components/MicrophoneButton";
import { CommandBar } from "./components/CommandBar";
import { ActionFeed } from "./components/ActionFeed";
import { SettingsModal } from "./components/SettingsModal";
import { useTranscription } from "./hooks/useTranscription";
import { useAgent } from "./hooks/useAgent";
import { useAppStore } from "./stores/appStore";
import {
  hasApiKeys,
  onDictationStatus,
  onDictationError,
  onDictationTranscript,
  onOpenSettings,
  getUserName,
  getHistory,
  getDictionary,
  getSnippets,
  clearHistory,
  addDictionaryWord,
  removeDictionaryWord,
  addSnippet,
  removeSnippet,
} from "./lib/bridge";

type Tab = "home" | "dictionary" | "snippets";

interface HistoryEntry {
  id: string;
  timestamp: string;
  transcript: string;
  entry_type: string;
  actions: { action: string; success: boolean; message: string }[];
  success: boolean;
}

function App() {
  const setKeyStatus = useAppStore((s) => s.setKeyStatus);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setDictationActive = useAppStore((s) => s.setDictationActive);
  const setDictationError = useAppStore((s) => s.setDictationError);
  const setDictationTranscript = useAppStore((s) => s.setDictationTranscript);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [userName, setUserName] = useState("there");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useTranscription();
  useAgent();

  useEffect(() => {
    getUserName()
      .then((name) => { if (name) setUserName(name); })
      .catch(() => {});
  }, []);

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      const data = await getHistory();
      setHistory(data.reverse());
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  // Dictation event listeners
  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;
    let unlistenTranscript: (() => void) | undefined;

    const setup = async () => {
      unlistenStatus = await onDictationStatus((event) => {
        setDictationActive(event.active);
        if (event.error) setDictationError(event.error);
      });
      unlistenError = await onDictationError((error) => {
        setDictationError(error);
      });
      unlistenTranscript = await onDictationTranscript((event) => {
        setDictationTranscript(event.text);
      });
      unlistenSettings = await onOpenSettings(() => {
        setShowSettings(true);
      });
    };

    setup();
    return () => {
      unlistenStatus?.();
      unlistenError?.();
      unlistenSettings?.();
      unlistenTranscript?.();
    };
  }, [setDictationActive, setDictationError, setDictationTranscript, setShowSettings]);

  // Check API keys on startup
  useEffect(() => {
    let retries = 0;
    const checkKeys = () => {
      hasApiKeys()
        .then((keys) => {
          setKeyStatus(!!keys.deepgram, !!keys.openai);
          if (!keys.deepgram || !keys.openai) setShowSettings(true);
          setReady(true);
        })
        .catch(() => {
          retries++;
          if (retries < 10) setTimeout(checkKeys, 200);
          else { setShowSettings(true); setReady(true); }
        });
    };
    checkKeys();
  }, [setKeyStatus, setShowSettings]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "#F3F3F1" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: "#1C1C1E" }}>
            M
          </div>
          <p className="text-sm font-sans" style={{ color: "#8A8A8E" }}>Loading MiniFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F3F3F1" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main white card */}
      <div className="flex-1 p-3 pl-0 min-w-0 overflow-hidden">
        <div className="h-full bg-white rounded-[28px] overflow-hidden flex flex-col">
          {activeTab === "home" && (
            <HomeTab userName={userName} history={history} onClearHistory={async () => { await clearHistory(); setHistory([]); }} />
          )}
          {activeTab === "dictionary" && <DictionaryTab />}
          {activeTab === "snippets" && <SnippetsTab />}
        </div>
      </div>

      <SettingsModal />
    </div>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

interface HomeTabProps {
  userName: string;
  history: HistoryEntry[];
  onClearHistory: () => void;
}

function HomeTab({ userName, history, onClearHistory }: HomeTabProps) {
  const isListening = useAppStore((s) => s.isListening);
  const showActionPanel = useAppStore((s) => s.showActionPanel);

  // Group history by date label
  const grouped = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    const groups: { label: string; entries: HistoryEntry[] }[] = [];
    const buckets: Record<string, HistoryEntry[]> = {};

    for (const entry of history) {
      const d = new Date(entry.timestamp).toDateString();
      const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(entry.timestamp).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      if (!buckets[label]) {
        buckets[label] = [];
        groups.push({ label, entries: buckets[label] });
      }
      buckets[label].push(entry);
    }

    return groups;
  }, [history]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-8 pb-6">
            {/* Welcome header */}
            <h1 className="text-3xl mb-3" style={{ color: "#1C1C1E", lineHeight: "1.2", fontFamily: "'Sansita', sans-serif" }}>
              Welcome back, {userName}
            </h1>

            {/* Fn key hero card */}
            <div
              className="rounded-2xl p-5 mb-5 border"
              style={{ background: "#FFFCF0", borderColor: "#EDE6C3" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-sans text-sm font-medium mb-1" style={{ color: "#1C1C1E" }}>
                    Hold{" "}
                    <kbd
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mx-0.5"
                      style={{ background: "#F5E6B8", color: "#7A5C1E", border: "1px solid #E8D49A", fontFamily: "inherit" }}
                    >
                      fn
                    </kbd>{" "}
                    to start dictating
                  </p>
                  <p className="font-sans text-xs" style={{ color: "#8A8A8E" }}>
                    Speak naturally — MiniFlow transcribes and executes your voice commands in any app.
                  </p>
                </div>
                <MicrophoneButton />
              </div>

              {/* Live transcription (shown when listening) */}
              {isListening && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EDE6C3" }}>
                  <TranscriptionArea />
                </div>
              )}
            </div>

            {/* Command bar */}
            <div className="mb-6">
              <CommandBar />
            </div>

            {/* History */}
            {grouped.length > 0 ? (
              <div className="space-y-5">
                {grouped.map(({ label, entries }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A8A8E" }}>
                        {label}
                      </h3>
                      {label === "Today" && entries.length > 0 && (
                        <button
                          onClick={onClearHistory}
                          className="font-sans text-xs transition-colors"
                          style={{ color: "#C0C0BE" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#9B1C1C")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#C0C0BE")}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {entries.map((entry) => (
                        <HistoryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: "#F3F3F1" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="font-sans text-sm font-medium mb-1" style={{ color: "#6B6B70" }}>No activity yet</p>
                <p className="font-sans text-xs" style={{ color: "#9CA3AF" }}>Hold Fn to start dictating</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Feed panel */}
      {showActionPanel && (
        <div className="w-72 border-l flex-shrink-0" style={{ borderColor: "#F0F0EE" }}>
          <ActionFeed />
        </div>
      )}
    </div>
  );
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const time = (() => {
    try {
      return new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return ""; }
  })();

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F8F7")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Type dot */}
      <div className="mt-1.5 flex-shrink-0">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: entry.entry_type === "command" ? "#2E5FA3" : "#2D6A4F" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm leading-snug truncate" style={{ color: "#1C1C1E" }}>
          {entry.transcript}
        </p>
        {entry.actions && entry.actions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.actions.slice(0, 3).map((action, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-sans"
                style={{
                  background: action.success ? "#F0FDF4" : "#FFF1F0",
                  color: action.success ? "#2D6A4F" : "#9B1C1C",
                }}
              >
                {action.success ? "✓" : "✗"} {action.action.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Time */}
      <span className="flex-shrink-0 font-sans text-xs mt-0.5" style={{ color: "#B0B0AD" }}>
        {time}
      </span>
    </div>
  );
}

// ── Dictionary Tab ────────────────────────────────────────────────────────────

function DictionaryTab() {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [fromWord, setFromWord] = useState("");
  const [toWord, setToWord] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDictionary().then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!fromWord.trim() || !toWord.trim()) return;
    await addDictionaryWord(fromWord.trim(), toWord.trim());
    const updated = await getDictionary();
    setEntries(updated);
    setFromWord("");
    setToWord("");
  };

  const handleRemove = async (key: string) => {
    await removeDictionaryWord(key);
    setEntries((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <TabLayout title="Dictionary" subtitle="Replace spoken words with custom text">
      {/* Add form */}
      <div className="flex gap-2 mb-6">
        <input
          value={fromWord}
          onChange={(e) => setFromWord(e.target.value)}
          placeholder="Say this..."
          className="flex-1 px-3 py-2 rounded-lg border text-sm font-sans outline-none transition-colors"
          style={{ borderColor: "#E5E5E3", color: "#1C1C1E", background: "#FAFAF9" }}
          onFocus={(e) => (e.target.style.borderColor = "#1C1C1E")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
        />
        <input
          value={toWord}
          onChange={(e) => setToWord(e.target.value)}
          placeholder="Replace with..."
          className="flex-1 px-3 py-2 rounded-lg border text-sm font-sans outline-none transition-colors"
          style={{ borderColor: "#E5E5E3", color: "#1C1C1E", background: "#FAFAF9" }}
          onFocus={(e) => (e.target.style.borderColor = "#1C1C1E")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg text-sm font-sans font-medium text-white transition-opacity"
          style={{ background: "#1C1C1E" }}
        >
          Add
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm font-sans text-center py-8" style={{ color: "#8A8A8E" }}>Loading...</p>
      ) : Object.keys(entries).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-sans mb-1" style={{ color: "#6B6B70" }}>No dictionary entries</p>
          <p className="text-xs font-sans" style={{ color: "#9CA3AF" }}>Add words above to customize transcription</p>
        </div>
      ) : (
        <div className="space-y-1">
          {Object.entries(entries).map(([from, to]) => (
            <div
              key={from}
              className="flex items-center gap-3 px-4 py-3 rounded-xl group transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F8F7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex-1 text-sm font-sans font-medium" style={{ color: "#1C1C1E" }}>{from}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B0AD" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              <span className="flex-1 text-sm font-sans" style={{ color: "#6B6B70" }}>{to}</span>
              <button
                onClick={() => handleRemove(from)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                style={{ color: "#9B1C1C" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </TabLayout>
  );
}

// ── Snippets Tab ──────────────────────────────────────────────────────────────

function SnippetsTab() {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSnippets().then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!trigger.trim() || !expansion.trim()) return;
    await addSnippet(trigger.trim(), expansion.trim());
    const updated = await getSnippets();
    setEntries(updated);
    setTrigger("");
    setExpansion("");
  };

  const handleRemove = async (key: string) => {
    await removeSnippet(key);
    setEntries((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <TabLayout title="Snippets" subtitle="Say a trigger phrase to expand into full text">
      {/* Add form */}
      <div className="flex gap-2 mb-6">
        <input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="Trigger phrase..."
          className="flex-1 px-3 py-2 rounded-lg border text-sm font-sans outline-none transition-colors"
          style={{ borderColor: "#E5E5E3", color: "#1C1C1E", background: "#FAFAF9" }}
          onFocus={(e) => (e.target.style.borderColor = "#1C1C1E")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
        />
        <input
          value={expansion}
          onChange={(e) => setExpansion(e.target.value)}
          placeholder="Expands to..."
          className="flex-1 px-3 py-2 rounded-lg border text-sm font-sans outline-none transition-colors"
          style={{ borderColor: "#E5E5E3", color: "#1C1C1E", background: "#FAFAF9" }}
          onFocus={(e) => (e.target.style.borderColor = "#1C1C1E")}
          onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg text-sm font-sans font-medium text-white"
          style={{ background: "#1C1C1E" }}
        >
          Add
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm font-sans text-center py-8" style={{ color: "#8A8A8E" }}>Loading...</p>
      ) : Object.keys(entries).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-sans mb-1" style={{ color: "#6B6B70" }}>No snippets yet</p>
          <p className="text-xs font-sans" style={{ color: "#9CA3AF" }}>Add trigger phrases to expand when spoken</p>
        </div>
      ) : (
        <div className="space-y-1">
          {Object.entries(entries).map(([trig, exp]) => (
            <div
              key={trig}
              className="flex items-start gap-3 px-4 py-3 rounded-xl group transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F8F7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex-shrink-0 mt-0.5">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium"
                  style={{ background: "#FFFCF0", color: "#7A5C1E", border: "1px solid #EDE6C3" }}
                >
                  {trig}
                </span>
              </div>
              <svg className="mt-1.5 flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0B0AD" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              <p className="flex-1 text-sm font-sans leading-snug" style={{ color: "#6B6B70" }}>{exp}</p>
              <button
                onClick={() => handleRemove(trig)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded mt-0.5 flex-shrink-0"
                style={{ color: "#9B1C1C" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </TabLayout>
  );
}

// ── Shared Tab Layout ─────────────────────────────────────────────────────────

function TabLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-8 pb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ color: "#1C1C1E" }}>{title}</h1>
        <p className="text-sm font-sans mb-6" style={{ color: "#8A8A8E" }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export default App;
