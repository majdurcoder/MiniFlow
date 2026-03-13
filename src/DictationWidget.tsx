import { useEffect, useState } from "react";
import { onAgentStatus, onActionResult, onTranscriptionError, onDictationStatus, type ActionResult, type DictationStatusEvent } from "./lib/bridge";

type WidgetState = "listening" | "processing" | "result" | "error";

interface AgentResult {
  action_type: string;
  actions: { action: string; success: boolean; message: string }[];
  transcript: string;
}

const ACTION_LABELS: Record<string, string> = {
  open_browser_tab: "Opened tab",
  search_google: "Searched",
  open_application: "Opened app",
  quit_application: "Quit app",
  clipboard_write: "Copied",
  clipboard_read: "Read clipboard",
  open_finder: "Opened Finder",
  create_file: "Created file",
  move_file: "Moved file",
  response: "Done",
  gmail_send: "Email sent",
  gmail_search: "Searched mail",
  slack_send_message: "Slack sent",
  notion_create_page: "Page created",
  github_create_issue: "Issue created",
  jira_create_issue: "Ticket created",
  linear_create_issue: "Issue created",
  calendar_create_event: "Event created",
};

function WaveformBars() {
  return (
    <div className="flex items-center gap-[3px]" style={{ height: "16px" }}>
      {[6, 12, 16, 10, 6].map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: "3px",
            height: `${h}px`,
            background: "#1C1C1E",
            animation: "wave 1s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export function DictationWidget() {
  const [state, setState] = useState<WidgetState>("listening");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    unlisteners.push(onAgentStatus((status: string) => {
      if (status === "processing") setState("processing");
    }));
    unlisteners.push(onActionResult((res: ActionResult) => {
      setResult({ action_type: res.action, actions: [res], transcript: "" });
      setState("result");
    }));
    unlisteners.push(onTranscriptionError((err: string) => {
      setErrorMsg(err);
      setState("error");
    }));
    unlisteners.push(onDictationStatus((e: DictationStatusEvent) => {
      if (e.active) { setState("listening"); setResult(null); setErrorMsg(""); }
    }));
    return () => unlisteners.forEach((u) => u());
  }, []);

  // State-specific content
  let statusIcon: React.ReactNode;
  let label: string;
  let labelColor: string = "#1C1C1E";

  if (state === "listening") {
    statusIcon = <WaveformBars />;
    label = "Listening...";
    labelColor = "#1C1C1E";
  } else if (state === "processing") {
    statusIcon = (
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B70" strokeWidth="2.5">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
    label = "Processing...";
    labelColor = "#6B6B70";
  } else if (state === "result" && result) {
    const a = result.actions[0];
    const success = !a || a.success;
    statusIcon = (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: success ? "#DCFCE7" : "#FEE2E2", color: success ? "#166534" : "#991B1B" }}
      >
        {success ? "✓" : "✗"}
      </div>
    );
    label = a ? (ACTION_LABELS[a.action] || a.action) : "Typed";
    labelColor = success ? "#166534" : "#991B1B";
  } else if (state === "error") {
    statusIcon = (
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#FEE2E2", color: "#991B1B" }}>!</div>
    );
    label = errorMsg || "Error";
    labelColor = "#991B1B";
  } else {
    statusIcon = null;
    label = "";
  }

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "transparent" }}>
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(1); opacity: 0.7; }
          50% { transform: scaleY(1.6); opacity: 1; }
        }
        @keyframes pill-in {
          0% { opacity: 0; transform: scale(0.92) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: "46px",
          background: "rgba(255,255,255,0.96)",
          borderRadius: "23px",
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
          backdropFilter: "blur(12px)",
          minWidth: "220px",
          maxWidth: "320px",
          animation: visible ? "pill-in 0.2s ease-out forwards" : "none",
          opacity: visible ? undefined : 0,
        }}
      >
        {/* Mic icon */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: state === "error" ? "#FEE2E2" : "#1C1C1E" }}
        >
          {state === "listening" || state === "result" ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
            </svg>
          ) : state === "processing" ? (
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <span style={{ color: "#991B1B", fontSize: "12px", fontWeight: "bold" }}>!</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center gap-2.5 overflow-hidden min-w-0">
          {statusIcon}
          <span
            className="text-sm font-sans truncate"
            style={{ color: labelColor, fontWeight: state === "listening" ? 400 : 500 }}
          >
            {label}
          </span>
        </div>

        {/* Fn key badge */}
        <div
          className="flex-shrink-0 text-xs font-sans px-1.5 py-0.5 rounded-md"
          style={{
            background: "#F3F3F1",
            color: "#9CA3AF",
            border: "1px solid #E5E5E3",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          fn
        </div>
      </div>
    </div>
  );
}

export default DictationWidget;
