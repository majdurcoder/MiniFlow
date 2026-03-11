# MiniFlow V2 — Engineering Design Document

## Table of Contents
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Component Map](#3-component-map)
4. [Python Backend — miniflow-engine](#4-python-backend--miniflow-engine)
5. [Swift Frontend — MiniflowApp](#5-swift-frontend--miniflowapp)
6. [OAuth Layer — miniflow-auth](#6-oauth-layer--miniflow-auth)
7. [Data Flow: Voice Command End-to-End](#7-data-flow-voice-command-end-to-end)
8. [Data Flow: OAuth Connect](#8-data-flow-oauth-connect)
9. [API Contract](#9-api-contract)
10. [WebSocket Events](#10-websocket-events)
11. [Connector System](#11-connector-system)
12. [Agent Loop](#12-agent-loop)
13. [Storage & Config](#13-storage--config)
14. [Build Phases Roadmap](#14-build-phases-roadmap)

---

## 1. Overview

MiniFlow is a macOS menu-bar voice assistant. The user holds a hotkey (⌘Space), speaks a command in English/Hindi/Spanish, and the app either executes it (open a URL, send an email, create a Jira ticket) or types the transcription into the focused app.

**Tech stack:**
| Layer | Technology |
|---|---|
| UI | Swift + SwiftUI + AppKit (macOS 13+) |
| Backend | Python 3.11 + FastAPI + uvicorn |
| Speech-to-text | Deepgram Nova-2 (streaming WebSocket) |
| AI agent | OpenAI GPT-4o (function calling) |
| OAuth proxy | Vercel serverless (TypeScript) |
| Config/state | JSON files in `~/miniflow/` |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    macOS (user's machine)                    │
│                                                              │
│  ┌──────────────────┐    HTTP/WS     ┌──────────────────┐   │
│  │   MiniflowApp    │◄─────────────►│ miniflow-engine  │   │
│  │   (Swift/SwiftUI)│  localhost:8765│  (Python/FastAPI)│   │
│  │                  │               │                  │   │
│  │  • Menu bar icon │               │  • GPT-4o agent  │   │
│  │  • Floating panel│               │  • Deepgram STT  │   │
│  │  • Settings UI   │               │  • Connectors    │   │
│  │  • History UI    │               │  • Config/Store  │   │
│  └──────────────────┘               └────────┬─────────┘   │
│                                              │              │
└──────────────────────────────────────────────┼─────────────┘
                                               │ HTTPS
                    ┌──────────────────────────┼──────────────┐
                    │      External Services   │              │
                    │                          ▼              │
                    │  Deepgram ◄── audio   OpenAI           │
                    │  (wss://)  ──► text   GPT-4o           │
                    │                                         │
                    │  Gmail / Slack / GitHub / Jira /        │
                    │  Linear / Notion / Spotify / Discord    │
                    │                                         │
                    │         ┌──────────────────┐            │
                    │         │  miniflow-auth   │            │
                    │         │  (Vercel/TS)     │            │
                    │         │  OAuth proxy     │            │
                    │         └──────────────────┘            │
                    └─────────────────────────────────────────┘
```

The Swift app and Python backend are **two separate processes** on the same machine, communicating over localhost. They are eventually bundled together (Phase 7), with the Swift app launching the Python binary as a subprocess.

---

## 3. Component Map

```
Miniflow V2/
├── miniflow-engine/          Python FastAPI backend
│   ├── main.py               HTTP server + WebSocket manager
│   ├── agent.py              GPT-4o multi-turn agent loop
│   ├── audio.py              Deepgram WebSocket streaming
│   ├── dictation.py          Keystroke injection (CGEvent)
│   ├── config.py             Read/write ~/miniflow/*.json
│   ├── oauth.py              Token store + OAuth URL builder
│   ├── history.py            Command history CRUD
│   ├── dictionary.py         Word replacement mappings
│   ├── snippets.py           Text expansion triggers
│   ├── styles.py             Tone/style preferences
│   └── connectors/
│       ├── registry.py       Tool lookup + connector routing
│       ├── google.py         Gmail + Calendar + Drive
│       ├── slack.py          Slack
│       ├── discord.py        Discord
│       ├── github.py         GitHub
│       ├── jira.py           Jira (Atlassian Cloud)
│       ├── linear.py         Linear (GraphQL)
│       ├── notion.py         Notion
│       └── spotify.py        Spotify
│
├── MiniflowApp/              Swift macOS app
│   └── MiniflowApp/
│       ├── MiniflowApp.swift     @main SwiftUI App
│       ├── AppDelegate.swift     Menu bar + window management
│       ├── FloatingPanel.swift   NSPanel subclass
│       ├── Bridge/
│       │   ├── APIClient.swift   POST /invoke/:command
│       │   └── EventStream.swift WebSocket subscriber
│       ├── Models/
│       │   ├── ActionResult.swift
│       │   └── HistoryEntry.swift
│       ├── ViewModels/
│       │   ├── AgentViewModel.swift
│       │   └── SettingsViewModel.swift
│       └── Views/
│           ├── DictationWidget.swift  Main floating widget
│           ├── ActionFeed.swift       Inline results list
│           ├── SettingsView.swift     API keys + connectors
│           └── HistoryView.swift      Command history
│
└── miniflow-auth/            Vercel OAuth proxy (TypeScript)
    ├── api/auth/[provider].ts     Initiate OAuth (→ provider)
    ├── api/callback/[provider].ts Exchange code → token
    ├── api/refresh/[provider].ts  Refresh expired tokens
    └── lib/
        ├── providers.ts           Provider configs + scopes
        └── crypto.ts              AES-256-GCM token encoding
```

---

## 4. Python Backend — miniflow-engine

### 4.1 Server (main.py)

FastAPI app on `http://127.0.0.1:8765`.

**Startup**: wires event broadcasters into `audio`, `dictation`, `agent` modules so they can push WebSocket events to all connected Swift clients.

**Three endpoint types:**

| Endpoint | Purpose |
|---|---|
| `POST /invoke/:command` | Dispatches to a handler by command name |
| `GET /health` | Returns `{"status": "ok"}` — used by Swift to detect if backend is alive |
| `GET /callback` | Receives OAuth token from Vercel after user authenticates |
| `WS /ws` | Persistent WebSocket for backend→frontend events |

The `/invoke/` dispatcher is a flat dict of lambdas — no routing framework, easy to read and extend:
```python
handlers = {
    "execute_command": lambda b: agent.execute_command(b["command"]),
    "start_listening": lambda b: audio.start_listening(b.get("sampleRate", 16000)),
    ...
}
```

**CORS** is restricted to `http://localhost` and `http://127.0.0.1` (with any port).

### 4.2 Audio (audio.py)

The Swift app captures microphone audio and sends it as **base64-encoded PCM chunks** via `POST /invoke/send_audio_chunk`. The Python backend maintains a persistent WebSocket to Deepgram:

```
Swift mic → base64 chunks → POST /invoke/send_audio_chunk
                                     ↓
                           Python decodes base64 → raw PCM
                                     ↓
                           Deepgram wss:// (streaming)
                                     ↓
                           transcription events → WS broadcast
                                     ↓
                           Swift EventStream receives them
```

Deepgram parameters: `nova-2` model, `multi` language (auto-detects EN/HI/ES), interim results enabled.

### 4.3 Dictation (dictation.py)

When the agent decides the user's speech is plain text (not a command), it calls `type_text(text)` which uses **Quartz CGEvent** to inject keystrokes into whatever app is currently focused — same mechanism as macOS's built-in dictation.

Requires Accessibility permission (`AXIsProcessTrusted()`).

### 4.4 Agent (agent.py)

GPT-4o multi-turn loop, max 8 turns. On each call to `execute_command(text)`:

1. Looks up connected OAuth providers from `oauth.get_connected_providers()`
2. Fetches their tool definitions from `connector_registry.get_tools_for_providers()`
3. Builds messages: system prompt + optional file context injection + user text
4. Calls GPT-4o with all tools (local + connector)
5. On each tool call: tries local tools first; if unrecognised, routes to connector via `registry.execute_connector_tool()`
6. Feeds results back as `tool` role messages
7. If GPT-4o returns text (no tool calls): if `"DICTATION"` → inject raw text; otherwise → inject formatted text
8. Appends entry to history

**Local tools** (always available, no OAuth):
`open_browser_tab`, `search_google`, `open_application`, `quit_application`, `clipboard_write`, `clipboard_read`, `open_finder`, `create_file`, `move_file`

**File context injection**: if the user's command contains a filename (e.g. "fix the bug in main.py"), the agent uses `mdfind` to locate it on disk and injects its content into the prompt.

### 4.5 Connector System (connectors/)

Each connector module (`google.py`, `slack.py`, etc.) exposes:
- `TOOLS: list` — GPT-4o function definitions
- `execute(name, args, token) → (bool, str)` — runs the tool, returns (success, message)

`registry.py` provides:
- `get_tools_for_providers(providers)` — combines TOOLS from all connected providers
- `execute_connector_tool(tool_name, args, token_fn)` — routes by tool name prefix to the right module

**Prefix routing table:**
| Tool prefix | Provider | Module |
|---|---|---|
| `gmail_`, `calendar_`, `drive_` | `google` | `google.py` |
| `slack_` | `slack` | `slack.py` |
| `discord_` | `discord` | `discord.py` |
| `github_` | `github` | `github.py` |
| `jira_` | `jira` | `jira.py` |
| `linear_` | `linear` | `linear.py` |
| `notion_` | `notion` | `notion.py` |
| `spotify_` | `spotify` | `spotify.py` |

---

## 5. Swift Frontend — MiniflowApp

### 5.1 App Lifecycle

`MiniflowApp.swift` is the `@main` entry. It uses `@NSApplicationDelegateAdaptor` to hand lifecycle control to `AppDelegate`.

`AppDelegate` on launch:
1. Sets activation policy to `.accessory` (hides from Dock + CMD+Tab)
2. Creates `NSStatusItem` in the menu bar
3. Creates a `FloatingPanel` with `DictationWidget` as its content
4. Registers a global `NSEvent` monitor for ⌘Space
5. Calls `EventStream.shared.connect()`

`LSUIElement = YES` in `Info.plist` reinforces the accessory-mode behaviour.

### 5.2 FloatingPanel

An `NSPanel` subclass. Key properties:
- `isFloatingPanel = true` — stays above normal windows
- `level = .floating` — window level
- `collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]` — visible on all spaces
- `isOpaque = false`, `backgroundColor = .clear` — SwiftUI `.regularMaterial` shows through
- `canBecomeKey = true` — accepts keyboard input
- `isMovableByWindowBackground = true` — drag anywhere to reposition

### 5.3 Bridge — APIClient

Singleton. All calls are `POST http://127.0.0.1:8765/invoke/:command` with a JSON body.

```swift
func invoke<T: Decodable>(_ command: String, body: [String: Any] = [:]) async throws -> T
func invokeVoid(_ command: String, body: [String: Any] = [:]) async throws
func isBackendAlive() async -> Bool   // GET /health
```

Uses `keyDecodingStrategy = .convertFromSnakeCase` so Python's `snake_case` keys map automatically to Swift's `camelCase`.

### 5.4 Bridge — EventStream

Singleton. Maintains a `URLSessionWebSocketTask` to `ws://127.0.0.1:8765/ws`.

Auto-reconnects after 2 seconds on failure.

Published properties (observed by ViewModels via Combine):
| Property | Triggered by event |
|---|---|
| `transcription: TranscriptionEvent?` | `"transcription"` |
| `agentStatus: String` | `"agent-status"` |
| `lastActionResult: ActionResultPayload?` | `"action-result"` |
| `lastOAuthProvider: String?` | `"oauth-connected"` |
| `isConnected: Bool` | connection state |

### 5.5 View Hierarchy

```
DictationWidget (main floating view)
├── Transcript row            ← live Deepgram text
├── ActionFeed (up to 3)      ← last N action results
├── Error banner (optional)
└── Control bar
    ├── Status dot + label
    ├── Clear button
    └── Mic button (start/stop listening)
```

`AgentViewModel` drives everything:
- Subscribes to `EventStream.$transcription` → updates `transcript`, fires `executeCommand` on `isFinal`
- Subscribes to `EventStream.$agentStatus` → updates `isProcessing`
- Subscribes to `EventStream.$lastActionResult` → prepends to `actions` array

---

## 6. OAuth Layer — miniflow-auth

Deployed to Vercel. No user data is stored here — it's a pure proxy.

### Flow

```
1. Swift → POST /invoke/start_oauth { provider: "google" }
2. Python returns URL: https://miniflow-auth.vercel.app/api/auth/google?port=8765
3. Swift opens URL in browser (NSWorkspace.shared.open)
4. Vercel /api/auth/[provider] → redirects to Google OAuth page
5. User authenticates
6. Google → Vercel /api/callback/google?code=...&state=...
7. Vercel exchanges code for tokens
8. Vercel encodes token payload (base64url or AES-256-GCM if ENCRYPTION_KEY set)
9. Vercel → redirects to http://localhost:8765/callback?data={encoded}&state=...
10. Python /callback decodes payload, calls oauth.save_token(provider, payload)
11. Python broadcasts "oauth-connected" via WebSocket
12. Swift updates connected providers list
```

### Token storage

Tokens saved to `~/miniflow/connectors.json`:
```json
{
  "google": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3599,
    "provider": "google",
    "scopes": [...]
  },
  "slack": { ... }
}
```

### Provider configs (providers.ts)

| Provider | Auth URL | PKCE | Key scopes |
|---|---|---|---|
| `google` | accounts.google.com | yes | gmail, calendar, drive (readonly + send) |
| `slack` | slack.com/oauth/v2 | no | channels, chat:write, search |
| `github` | github.com/login | yes | repo, read:user |
| `discord` | discord.com/api/oauth2 | no | identify, guilds |
| `jira` | auth.atlassian.com | yes | read/write jira-work |
| `linear` | linear.app/oauth | yes | read, write, issues:create |
| `notion` | api.notion.com/v1/oauth | no | workspace access |
| `spotify` | accounts.spotify.com | yes | playback-state, modify-playback |

---

## 7. Data Flow: Voice Command End-to-End

```
User speaks
    │
    ▼
Swift AVFoundation mic capture (Phase 3 — TODO)
    │  PCM audio frames → base64
    ▼
POST /invoke/send_audio_chunk { chunk: "<base64>" }
    │
    ▼
audio.py → base64 decode → raw PCM bytes
    │
    ▼
Deepgram wss:// (existing connection)
    │
    ▼ (on interim/final result)
WebSocket broadcast: { event: "transcription", payload: { transcript, is_final, confidence } }
    │
    ▼
Swift EventStream receives → AgentViewModel.transcript updated → DictationWidget re-renders
    │
    └─ if is_final == true:
           ▼
       POST /invoke/execute_command { command: "open YouTube" }
           │
           ▼
       agent.py
         1. Load connected providers + their tools
         2. GPT-4o call with all tools
         3. GPT-4o returns: tool_call { open_browser_tab, url: "https://youtube.com" }
         4. _execute_local("open_browser_tab", { url: "..." })
            → subprocess: open -a "Google Chrome" https://youtube.com
         5. Broadcast: { event: "action-result", payload: { action, success, message } }
         6. Broadcast: { event: "agent-status", payload: "idle" }
           │
           ▼
       Swift EventStream → AgentViewModel.actions updated → ActionFeed re-renders
```

---

## 8. Data Flow: OAuth Connect

```
User taps "Connect" for Slack in SettingsView
    │
    ▼
SettingsViewModel.connectProvider("slack")
    │
    ▼
POST /invoke/start_oauth { provider: "slack" }
    │
    ▼
oauth.py returns "https://miniflow-auth.vercel.app/api/auth/slack?port=8765"
    │
    ▼
NSWorkspace.shared.open(url)   ← opens browser
    │
    ▼
User completes OAuth in browser
    │
    ▼
Vercel callback → http://localhost:8765/callback?data={base64_token}&state=...
    │
    ▼
main.py /callback endpoint:
  1. base64url decode data → JSON
  2. oauth.save_token("slack", { access_token, refresh_token, ... })
  3. broadcast "oauth-connected" { provider: "slack" }
    │
    ▼
Swift EventStream.lastOAuthProvider = "slack"
    │
    ▼
SettingsViewModel.load() called → connectedProviders updated → UI shows ✓ Connected
```

---

## 9. API Contract

All requests: `POST http://127.0.0.1:8765/invoke/:command`
Body: `application/json`
Response: `application/json`

### Audio
| Command | Body | Response |
|---|---|---|
| `start_listening` | `{ sampleRate: 16000 }` | `null` |
| `stop_listening` | `{}` | `null` |
| `send_audio_chunk` | `{ chunk: string }` (base64 PCM) | `null` |

### Agent
| Command | Body | Response |
|---|---|---|
| `execute_command` | `{ command: string }` | `ActionResult[]` |

### Config
| Command | Body | Response |
|---|---|---|
| `save_api_key` | `{ service, key }` | `null` |
| `get_api_key` | `{ service }` | `string` |
| `has_api_keys` | `{}` | `{ openai: string\|null, deepgram: string\|null }` |
| `save_language` | `{ language }` | `null` |
| `get_language` | `{}` | `string` |
| `get_advanced_settings` | `{}` | `{ whisper_mode, developer_mode, filler_removal }` |
| `save_advanced_setting` | `{ key, value }` | `null` |
| `save_user_name` | `{ name }` | `null` |
| `get_user_name` | `{}` | `string\|null` |

### Dictation
| Command | Body | Response |
|---|---|---|
| `start_dictation` | `{}` | `null` |
| `stop_dictation` | `{}` | `null` |
| `get_dictation_status` | `{}` | `bool` |
| `check_accessibility` | `{}` | `bool` |
| `open_accessibility_settings` | `{}` | `null` |

### OAuth / Connectors
| Command | Body | Response |
|---|---|---|
| `start_oauth` | `{ provider }` | `string` (URL) |
| `disconnect_provider` | `{ provider }` | `null` |
| `get_connected_providers` | `{}` | `string[]` |
| `is_provider_connected` | `{ provider }` | `bool` |
| `list_connectors` | `{}` | `{ id, display_name }[]` |

### History / Dictionary / Snippets / Styles
| Command | Body | Response |
|---|---|---|
| `get_history` | `{}` | `HistoryEntry[]` |
| `clear_history` | `{}` | `null` |
| `add_dictionary_word` | `{ from, to }` | `null` |
| `get_dictionary` | `{}` | `Record<string, string>` |
| `add_snippet` | `{ trigger, expansion }` | `null` |
| `get_snippets` | `{}` | `Record<string, string>` |
| `get_style_preferences` | `{}` | `Record<string, string>` |
| `save_style_preference` | `{ category, tone }` | `null` |

---

## 10. WebSocket Events

Connection: `ws://127.0.0.1:8765/ws`
Message format: `{ "event": string, "payload": any }`

| Event | Payload | Description |
|---|---|---|
| `transcription` | `{ transcript, is_final, confidence }` | Deepgram result |
| `transcription-error` | `string` | Deepgram connection/key error |
| `agent-status` | `"processing" \| "idle"` | Agent working/done |
| `action-result` | `{ action, success, message }` | Single tool execution result |
| `dictation-status` | `{ active, error }` | Dictation mode on/off |
| `dictation-transcript` | `{ text, is_final }` | Dictation mode transcript |
| `oauth-connected` | `{ provider }` | OAuth token saved |

---

## 11. Connector System

### Adding a new connector

1. Create `miniflow-engine/connectors/yourservice.py`:
   ```python
   TOOLS = [ { "type": "function", "function": { ... } }, ... ]

   def execute(name: str, args: dict, token: dict) -> tuple[bool, str]:
       ...
   ```

2. Add to `connectors/__init__.py`: `from . import yourservice`

3. Add entry to `connectors/registry.py`:
   - `CONNECTORS` list
   - `_modules()` dict
   - `PREFIX_MAP` entry

4. Add OAuth config to `miniflow-auth/lib/providers.ts`

5. Add scopes and the connector button to `SettingsView.swift`

### Connector tool naming convention

All tool names for a connector must share a common prefix: `yourservice_`. The registry uses this prefix to route tool calls.

---

## 12. Agent Loop

```
execute_command(text: str)
    │
    ├─ emit "agent-status" = "processing"
    ├─ load OpenAI API key from config
    ├─ inject file context (mdfind any filenames in text)
    ├─ prepend [User name: ...] [Today: ...]
    │
    ├─ build tools = LOCAL_TOOLS + connector_registry.get_tools_for_providers(connected)
    │
    └─ loop (max 8 turns):
           │
           ▼
       GPT-4o chat.completions.create(model="gpt-4o", tools=tools)
           │
           ├─ no tool_calls → text response
           │      ├─ "DICTATION" → type_text(original_input)
           │      └─ other → type_text(response)  [formatted email, list, etc.]
           │
           └─ tool_calls → for each call:
                  ├─ try _execute_local(name, args)
                  │     └─ if "__unknown__" → registry.execute_connector_tool(name, args, get_token)
                  ├─ emit "action-result"
                  └─ append tool result to messages → next turn
    │
    ├─ history.append_entry(...)
    └─ emit "agent-status" = "idle"
```

### System prompt rules (key excerpt)

- **Command detection**: if speech contains a verb matching any tool → call the tool. Never return DICTATION for commands.
- **Gmail rule**: any mention of email/mail → must use `gmail_*` tool.
- **Calendar rule**: meeting/schedule/book/appointment → must use `calendar_*` tool.
- **Spotify rule**: play/music/song/गाना/canción → must use `spotify_*` tool.
- **Multilingual**: understands EN/HI/ES, maps to same tools regardless of language.
- **File context**: if `[FILE CONTEXT: ...]` blocks are injected, use their content and output the full modified file.

---

## 13. Storage & Config

All data lives in `~/miniflow/` — plain JSON files, `chmod 600`.

| File | Contents |
|---|---|
| `miniflow_keys.json` | `{ "openai": "sk-...", "deepgram": "..." }` |
| `miniflow_settings.json` | language, whisper_mode, filler_removal, user_name, etc. |
| `connectors.json` | OAuth tokens keyed by provider name |
| `history.json` | Array of HistoryEntry (capped at 500) |
| `dictionary.json` | Word replacements `{ "gonna": "going to" }` |
| `snippets.json` | Text expansions `{ "@@email": "user@example.com" }` |
| `styles.json` | Tone preferences `{ "email": "professional" }` |

---

## 14. Build Phases Roadmap

| Phase | Status | What it covers |
|---|---|---|
| 1 | ✅ Done | Python backend: all connectors, OAuth callback, health endpoint |
| 2 | ✅ Done | Swift app skeleton: Xcode project, AppDelegate, panel, all views |
| 3 | 🔲 Next | Swift audio capture → PCM chunks → backend → transcription events back |
| 4 | 🔲 | Global hotkey refinement, mic permission prompt, panel animation |
| 5 | 🔲 | Settings + History windows fully wired; OAuth connect flow in UI |
| 6 | 🔲 | macOS polish: login item, Accessibility prompt, menu bar badge |
| 7 | 🔲 | Packaging: PyInstaller bundle, embed in .app, DMG distribution |
| 8 | 🔲 | Pro features: license gating, Stripe payments |
| 9 | 🔲 | Cloud sync: Supabase (history, settings) |

### Phase 3 detail (next)

Swift needs to:
1. Request microphone permission (`AVAudioSession` / `AVCaptureDevice`)
2. Tap `AVAudioEngine` input node at 16kHz mono
3. Convert audio buffer → raw PCM bytes → base64 string
4. POST `/invoke/send_audio_chunk` for each buffer callback (~100ms chunks)
5. Stop on mic button tap → POST `/invoke/stop_listening`

The transcription events flow back automatically via the existing WebSocket.
