import type { ReactNode } from "react";
import { useAppStore } from "../stores/appStore";

type Tab = "home" | "dictionary" | "snippets";

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const NAV_ITEMS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "dictionary",
    label: "Dictionary",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: "snippets",
    label: "Snippets",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const dictationActive = useAppStore((s) => s.dictationActive);

  return (
    <div
      className="w-52 flex-shrink-0 flex flex-col py-6 px-3 h-full"
      style={{ background: "#F3F3F1" }}
    >
      {/* Logo */}
      <div className="px-3 mb-6">
        <span
          className="font-display block leading-none"
          style={{ fontSize: "19px", color: "#1C1C1E", letterSpacing: "0.05em" }}
        >
          MINIFLOW
        </span>
      </div>

      {/* Dictation status indicator */}
      {dictationActive && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: "#FFF3F3" }}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-sans" style={{ color: "#9B1C1C" }}>Dictating...</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors duration-150 font-sans text-sm"
              style={{
                background: isActive ? "#E3E3E0" : "transparent",
                color: isActive ? "#1C1C1E" : "#6B6B70",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <span style={{ color: isActive ? "#1C1C1E" : "#9CA3AF" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-1 mt-4">
        <div className="border-t border-dash-border mb-3" />

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors duration-150 font-sans text-sm"
          style={{ color: "#6B6B70" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#EBEBEA")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}
