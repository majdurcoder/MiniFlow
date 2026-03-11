import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../stores/appStore";
import {
  saveApiKey,
  hasApiKeys,
  getConnectedProviders,
  startOAuth,
  disconnectProvider,
  saveLanguage,
  getLanguage,
  getDictionary,
  addDictionaryWord,
  removeDictionaryWord,
  getSnippets,
  addSnippet,
  removeSnippet,
  getStylePreferences,
  saveStylePreference,
  getAdvancedSettings,
  saveAdvancedSetting,
  saveUserName,
  getUserName,
} from "../lib/bridge";

type SettingsTab = "keys" | "connectors" | "dictionary" | "snippets" | "styles" | "advanced";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "keys", label: "API Keys" },
  { id: "connectors", label: "Connectors" },
  { id: "dictionary", label: "Dictionary" },
  { id: "snippets", label: "Snippets" },
  { id: "styles", label: "Styles" },
  { id: "advanced", label: "Advanced" },
];

const CONNECTORS = [
  { id: "google", name: "Google", desc: "Gmail, Drive, Calendar" },
  { id: "slack", name: "Slack", desc: "Messages & Channels" },
  { id: "discord", name: "Discord", desc: "Servers & Messages" },
  { id: "github", name: "GitHub", desc: "Issues & PRs" },
  { id: "jira", name: "Jira", desc: "Tickets & Sprints" },
  { id: "linear", name: "Linear", desc: "Issues & Projects" },
  { id: "notion", name: "Notion", desc: "Pages & Databases" },
  { id: "spotify", name: "Spotify", desc: "Music & Playback" },
];

const NOVA3_LANGUAGES = [
  { code: "multi", label: "Multilingual (auto-detect)" },
  { code: "en", label: "English" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-IN", label: "English (India)" },
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "es", label: "Spanish" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sv", label: "Swedish" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 transition-colors duration-200"
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        background: checked ? "#1C1C1E" : "#E5E5E3",
        border: "none",
        cursor: "pointer",
      }}
    >
      <div
        className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? "18px" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
      />
    </button>
  );
}

function FormInput({
  label, type = "text", value, onChange, placeholder, hint,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: "#6B6B70" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border text-sm font-sans outline-none transition-colors"
        style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
        onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
        onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
      />
      {hint && <p className="text-xs font-sans mt-1.5" style={{ color: "#9CA3AF" }}>{hint}</p>}
    </div>
  );
}

export function SettingsModal() {
  const showSettings = useAppStore((s) => s.showSettings);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setKeyStatus = useAppStore((s) => s.setKeyStatus);

  const [deepgramKey, setDeepgramKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [userName, setUserName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [existingDeepgram, setExistingDeepgram] = useState(false);
  const [existingOpenai, setExistingOpenai] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>("keys");
  const [selectedLanguage, setSelectedLanguage] = useState("multi");
  const [dictWords, setDictWords] = useState<Record<string, string>>({});
  const [newDictFrom, setNewDictFrom] = useState("");
  const [newDictTo, setNewDictTo] = useState("");
  const [snippets, setSnippetsState] = useState<Record<string, string>>({});
  const [newSnipTrigger, setNewSnipTrigger] = useState("");
  const [newSnipExpansion, setNewSnipExpansion] = useState("");
  const [stylePrefs, setStylePrefs] = useState<Record<string, string>>({});
  const [advancedSettings, setAdvancedSettingsState] = useState<Record<string, boolean>>({
    whisper_mode: false,
    developer_mode: false,
    filler_removal: true,
  });

  const loadConnected = useCallback(() => {
    getConnectedProviders().then(setConnectedProviders).catch(() => {});
  }, []);

  useEffect(() => {
    if (showSettings) {
      hasApiKeys().then((keys) => { setExistingDeepgram(!!keys.deepgram); setExistingOpenai(!!keys.openai); }).catch(() => {});
      getLanguage().then(setSelectedLanguage).catch(() => {});
      getUserName().then((name) => setUserName(name ?? "")).catch(() => {});
      loadConnected();
      getDictionary().then(setDictWords).catch(() => {});
      getSnippets().then(setSnippetsState).catch(() => {});
      getStylePreferences().then(setStylePrefs).catch(() => {});
      getAdvancedSettings().then(setAdvancedSettingsState).catch(() => {});
    }
  }, [showSettings, loadConnected]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      if (deepgramKey.trim()) await saveApiKey("deepgram", deepgramKey.trim());
      if (openaiKey.trim()) await saveApiKey("openai", openaiKey.trim());
      await saveUserName(userName);
      const keys = await hasApiKeys();
      setKeyStatus(!!keys.deepgram, !!keys.openai);
      setExistingDeepgram(!!keys.deepgram);
      setExistingOpenai(!!keys.openai);
      setSaved(true);
      setDeepgramKey("");
      setOpenaiKey("");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [deepgramKey, openaiKey, userName, setKeyStatus]);

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        onClick={() => setShowSettings(false)}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 animate-fade-in flex overflow-hidden"
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          maxHeight: "80vh",
        }}
      >
        {/* Left sidebar tabs */}
        <div className="flex flex-col w-44 flex-shrink-0 py-5 px-3" style={{ background: "#F8F8F7", borderRight: "1px solid #F0F0EE" }}>
          <div className="px-2 mb-5">
            <span className="text-sm font-sans font-semibold" style={{ color: "#1C1C1E" }}>Settings</span>
          </div>

          <nav className="space-y-0.5 flex-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-sans transition-colors"
                style={{
                  background: tab === t.id ? "#EBEBEA" : "transparent",
                  color: tab === t.id ? "#1C1C1E" : "#6B6B70",
                  fontWeight: tab === t.id ? 500 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#F0F0EE" }}>
            <h2 className="text-base font-sans font-semibold" style={{ color: "#1C1C1E" }}>
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "#9CA3AF" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F3F1"; e.currentTarget.style.color = "#1C1C1E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── API Keys Tab ── */}
            {tab === "keys" && (
              <div className="space-y-4">
                <FormInput
                  label={`OpenAI Secret Key${existingOpenai ? " — configured ✓" : ""}`}
                  type="password"
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  placeholder={existingOpenai ? "Enter new key to update..." : "sk-..."}
                />
                <FormInput
                  label={`Deepgram API Key${existingDeepgram ? " — configured ✓" : ""}`}
                  type="password"
                  value={deepgramKey}
                  onChange={setDeepgramKey}
                  placeholder={existingDeepgram ? "Enter new key to update..." : "Enter your Deepgram key..."}
                />
                <FormInput
                  label="Your Name"
                  value={userName}
                  onChange={setUserName}
                  placeholder="e.g. Rounak Lenka"
                  hint="Used in email sign-offs instead of [Your Name]."
                />

                {error && (
                  <div className="px-3 py-2.5 rounded-xl text-sm font-sans" style={{ background: "#FFF1F0", color: "#9B1C1C", border: "1px solid #FED7D7" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl text-sm font-sans font-medium transition-all"
                  style={{
                    background: saved ? "#F0FDF4" : "#1C1C1E",
                    color: saved ? "#2D6A4F" : "#FFFFFF",
                    cursor: saving ? "wait" : "pointer",
                    border: saved ? "1px solid #D1EDD8" : "none",
                  }}
                >
                  {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
                </button>

                <div className="pt-3 border-t" style={{ borderColor: "#F0F0EE" }}>
                  <label className="block text-xs font-sans font-medium mb-1.5" style={{ color: "#6B6B70" }}>
                    Transcription Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={async (e) => {
                      setSelectedLanguage(e.target.value);
                      try { await saveLanguage(e.target.value); } catch {}
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm font-sans outline-none"
                    style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
                  >
                    {NOVA3_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.label}</option>
                    ))}
                  </select>
                  <p className="text-xs font-sans mt-1.5" style={{ color: "#9CA3AF" }}>
                    Nova-3 model. Changes apply on next recording session.
                  </p>
                </div>

                <p className="text-xs font-sans text-center" style={{ color: "#C0C0BE" }}>
                  Keys are stored locally on your machine
                </p>
              </div>
            )}

            {/* ── Connectors Tab ── */}
            {tab === "connectors" && (
              <div>
                <p className="text-sm font-sans mb-4" style={{ color: "#8A8A8E" }}>
                  Connect services to unlock voice commands. Tokens are stored securely in your macOS Keychain.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CONNECTORS.map((c) => {
                    const isConnected = connectedProviders.includes(c.id);
                    const isConnecting = connectingProvider === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (isConnecting) return;
                          setConnectingProvider(c.id);
                          (isConnected ? disconnectProvider(c.id) : startOAuth(c.id))
                            .then(() => loadConnected())
                            .catch(() => {})
                            .finally(() => setConnectingProvider(null));
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border text-left transition-colors"
                        style={{
                          background: isConnected ? "#F7FDF9" : "#FAFAF9",
                          borderColor: isConnected ? "#D1EDD8" : "#E5E5E3",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-sans font-medium truncate" style={{ color: "#1C1C1E" }}>{c.name}</div>
                          <div className="text-xs font-sans truncate mt-0.5" style={{ color: isConnected ? "#2D6A4F" : "#9CA3AF" }}>
                            {isConnected ? "Connected" : c.desc}
                          </div>
                        </div>
                        {isConnecting ? (
                          <svg className="animate-spin flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        ) : (
                          <div
                            className="flex-shrink-0 w-8 h-[18px] rounded-full relative transition-colors"
                            style={{ background: isConnected ? "#1C1C1E" : "#E5E5E3" }}
                          >
                            <div
                              className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
                              style={{ left: isConnected ? "18px" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-sans text-center mt-4" style={{ color: "#C0C0BE" }}>
                  Set provider Client IDs via environment variables
                </p>
              </div>
            )}

            {/* ── Dictionary Tab ── */}
            {tab === "dictionary" && (
              <div className="space-y-4">
                <p className="text-sm font-sans" style={{ color: "#8A8A8E" }}>
                  Custom word replacements applied during dictation.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDictFrom}
                    onChange={(e) => setNewDictFrom(e.target.value)}
                    placeholder="Say this..."
                    className="flex-1 px-3 py-2.5 rounded-xl border text-sm font-sans outline-none"
                    style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
                    onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
                    onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
                  />
                  <input
                    type="text"
                    value={newDictTo}
                    onChange={(e) => setNewDictTo(e.target.value)}
                    placeholder="Replace with..."
                    className="flex-1 px-3 py-2.5 rounded-xl border text-sm font-sans outline-none"
                    style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
                    onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
                    onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newDictFrom.trim() && newDictTo.trim()) {
                        await addDictionaryWord(newDictFrom.trim(), newDictTo.trim());
                        setDictWords({ ...dictWords, [newDictFrom.trim().toLowerCase()]: newDictTo.trim() });
                        setNewDictFrom(""); setNewDictTo("");
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (newDictFrom.trim() && newDictTo.trim()) {
                        await addDictionaryWord(newDictFrom.trim(), newDictTo.trim());
                        setDictWords({ ...dictWords, [newDictFrom.trim().toLowerCase()]: newDictTo.trim() });
                        setNewDictFrom(""); setNewDictTo("");
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-sans font-medium text-white"
                    style={{ background: "#1C1C1E" }}
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {Object.entries(dictWords).map(([from, to]) => (
                    <div key={from} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group" style={{ background: "#F8F8F7" }}>
                      <span className="flex-1 text-sm font-sans font-medium" style={{ color: "#1C1C1E" }}>{from}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C0C0BE" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      <span className="flex-1 text-sm font-sans" style={{ color: "#6B6B70" }}>{to}</span>
                      <button
                        onClick={async () => { await removeDictionaryWord(from); const c = { ...dictWords }; delete c[from]; setDictWords(c); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                        style={{ color: "#9B1C1C" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {Object.keys(dictWords).length === 0 && (
                    <p className="text-xs font-sans text-center py-6" style={{ color: "#C0C0BE" }}>No entries yet</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Snippets Tab ── */}
            {tab === "snippets" && (
              <div className="space-y-4">
                <p className="text-sm font-sans" style={{ color: "#8A8A8E" }}>
                  Voice-triggered text expansions. Say the trigger phrase and it expands.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newSnipTrigger}
                    onChange={(e) => setNewSnipTrigger(e.target.value)}
                    placeholder="Trigger phrase..."
                    className="w-full px-3 py-2.5 rounded-xl border text-sm font-sans outline-none"
                    style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
                    onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
                    onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
                  />
                  <textarea
                    value={newSnipExpansion}
                    onChange={(e) => setNewSnipExpansion(e.target.value)}
                    placeholder="Expands to..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm font-sans outline-none resize-none"
                    style={{ borderColor: "#E5E5E3", background: "#FAFAF9", color: "#1C1C1E" }}
                    onFocus={(e) => (e.target.style.borderColor = "#9CA3AF")}
                    onBlur={(e) => (e.target.style.borderColor = "#E5E5E3")}
                  />
                  <button
                    onClick={async () => {
                      if (newSnipTrigger.trim() && newSnipExpansion.trim()) {
                        await addSnippet(newSnipTrigger.trim(), newSnipExpansion.trim());
                        setSnippetsState({ ...snippets, [newSnipTrigger.trim().toLowerCase()]: newSnipExpansion.trim() });
                        setNewSnipTrigger(""); setNewSnipExpansion("");
                      }
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-sans font-medium text-white"
                    style={{ background: "#1C1C1E" }}
                  >
                    Add Snippet
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {Object.entries(snippets).map(([trigger, expansion]) => (
                    <div key={trigger} className="flex items-start gap-3 px-3 py-2.5 rounded-xl group" style={{ background: "#F8F8F7" }}>
                      <span
                        className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium mt-0.5"
                        style={{ background: "#FFFCF0", color: "#7A5C1E", border: "1px solid #EDE6C3" }}
                      >
                        {trigger}
                      </span>
                      <p className="flex-1 text-xs font-sans leading-snug line-clamp-2" style={{ color: "#6B6B70" }}>{expansion}</p>
                      <button
                        onClick={async () => { await removeSnippet(trigger); const c = { ...snippets }; delete c[trigger]; setSnippetsState(c); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity flex-shrink-0"
                        style={{ color: "#9B1C1C" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {Object.keys(snippets).length === 0 && (
                    <p className="text-xs font-sans text-center py-6" style={{ color: "#C0C0BE" }}>No snippets yet</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Styles Tab ── */}
            {tab === "styles" && (
              <div className="space-y-3">
                <p className="text-sm font-sans mb-4" style={{ color: "#8A8A8E" }}>
                  Set your preferred writing tone for each app category.
                </p>
                {[
                  { key: "messaging", label: "Messaging", desc: "Slack, Discord, WhatsApp" },
                  { key: "email", label: "Email", desc: "Mail, Gmail, Outlook" },
                  { key: "code", label: "Code Editors", desc: "Cursor, VS Code, Terminal" },
                  { key: "other", label: "Other Apps", desc: "Everything else" },
                ].map((cat) => (
                  <div key={cat.key} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#F8F8F7" }}>
                    <div>
                      <div className="text-sm font-sans font-medium" style={{ color: "#1C1C1E" }}>{cat.label}</div>
                      <div className="text-xs font-sans mt-0.5" style={{ color: "#9CA3AF" }}>{cat.desc}</div>
                    </div>
                    <select
                      value={stylePrefs[cat.key] || "neutral"}
                      onChange={async (e) => {
                        await saveStylePreference(cat.key, e.target.value);
                        setStylePrefs({ ...stylePrefs, [cat.key]: e.target.value });
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none border"
                      style={{ background: "#FFFFFF", borderColor: "#E5E5E3", color: "#1C1C1E" }}
                    >
                      <option value="very_casual">Very Casual</option>
                      <option value="casual">Casual</option>
                      <option value="neutral">Neutral</option>
                      <option value="formal">Formal</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* ── Advanced Tab ── */}
            {tab === "advanced" && (
              <div className="space-y-3">
                <p className="text-sm font-sans mb-4" style={{ color: "#8A8A8E" }}>
                  Audio processing and text formatting features.
                </p>
                {[
                  { key: "filler_removal", label: "Filler Word Removal", desc: "Remove 'um', 'uh', 'like' from transcriptions" },
                  { key: "whisper_mode", label: "Whisper Mode", desc: "Amplify audio 3x for low-volume speech" },
                  { key: "developer_mode", label: "Developer Mode", desc: "Convert spoken variable names to camelCase in code editors" },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#F8F8F7" }}>
                    <div className="flex-1 mr-4">
                      <div className="text-sm font-sans font-medium" style={{ color: "#1C1C1E" }}>{setting.label}</div>
                      <div className="text-xs font-sans mt-0.5" style={{ color: "#9CA3AF" }}>{setting.desc}</div>
                    </div>
                    <Toggle
                      checked={!!advancedSettings[setting.key]}
                      onChange={async (val) => {
                        await saveAdvancedSetting(setting.key, val);
                        setAdvancedSettingsState({ ...advancedSettings, [setting.key]: val });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
