import { useAppStore } from "../stores/appStore";

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

export function ActionFeed() {
  const actionResults = useAppStore((s) => s.actionResults);
  const showActionPanel = useAppStore((s) => s.showActionPanel);
  const setShowActionPanel = useAppStore((s) => s.setShowActionPanel);
  const clearActions = useAppStore((s) => s.clearActions);
  const agentStatus = useAppStore((s) => s.agentStatus);

  if (!showActionPanel) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#F0F0EE" }}>
        <span className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: "#8A8A8E" }}>
          Actions
        </span>
        <div className="flex items-center gap-1">
          {actionResults.length > 0 && (
            <button
              onClick={clearActions}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#C0C0BE" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#9B1C1C")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#C0C0BE")}
              title="Clear"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowActionPanel(false)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#C0C0BE" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1C1C1E")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#C0C0BE")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Agent status */}
        {agentStatus !== "idle" && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 animate-fade-in" style={{ background: "#F8F8F7" }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2E5FA3" }} />
            <span className="text-xs font-sans capitalize" style={{ color: "#2E5FA3" }}>{agentStatus}...</span>
          </div>
        )}

        {/* Empty state */}
        {actionResults.length === 0 && agentStatus === "idle" && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "#F3F3F1" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
              </svg>
            </div>
            <p className="text-xs font-sans" style={{ color: "#9CA3AF" }}>Execute a command to see results</p>
          </div>
        )}

        {/* Action cards */}
        <div className="space-y-2">
          {actionResults.map((result) => (
            <div
              key={result.id}
              className="px-3 py-3 rounded-xl border animate-fade-in"
              style={{
                background: result.success ? "#F7FDF9" : "#FFF7F7",
                borderColor: result.success ? "#D1EDD8" : "#F0D0D0",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-sans font-medium" style={{ color: "#1C1C1E" }}>
                  {ACTION_LABELS[result.action] || result.action}
                </span>
                <span className="text-xs font-sans" style={{ color: "#B0B0AD" }}>
                  {new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
              <p className="text-xs font-sans leading-snug" style={{ color: "#6B6B70" }}>{result.message}</p>
              <div className="mt-2">
                <span className="text-xs font-sans" style={{ color: result.success ? "#2D6A4F" : "#9B1C1C" }}>
                  {result.success ? "✓ Done" : "✗ Failed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
