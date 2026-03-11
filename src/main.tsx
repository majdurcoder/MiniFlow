import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DictationWidget } from "./DictationWidget";
import { HistoryWindow } from "./HistoryWindow";
import { TranscriptViewer } from "./TranscriptViewer";
import "./styles/globals.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// Simple path-based routing: each Tauri window loads a different URL path
const path = window.location.pathname;

if (path === "/widget") {
  root.render(
    <React.StrictMode>
      <DictationWidget />
    </React.StrictMode>
  );
} else if (path === "/history") {
  root.render(
    <React.StrictMode>
      <HistoryWindow />
    </React.StrictMode>
  );
} else if (path === "/transcripts") {
  root.render(
    <React.StrictMode>
      <TranscriptViewer />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
