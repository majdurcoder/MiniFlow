// bridge.ts — replaces tauri.ts
// All communication goes to the Python FastAPI backend.
// Commands → POST http://localhost:8765/invoke/:command
// Events   → WebSocket ws://localhost:8765/ws

const BASE = "http://localhost:8765"
const WS_URL = "ws://localhost:8765/ws"

// ── HTTP invoke ──

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/invoke/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  })
  if (!res.ok) throw new Error(`[bridge] ${command} failed: ${res.status}`)
  return res.json()
}

// ── WebSocket event bus ──

type EventCallback = (payload: unknown) => void
const handlers = new Map<string, Set<EventCallback>>()
let socket: WebSocket | null = null

function getSocket(): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN) return socket
  socket = new WebSocket(WS_URL)
  socket.onmessage = (e) => {
    try {
      const { event, payload } = JSON.parse(e.data)
      handlers.get(event)?.forEach((cb) => cb(payload))
    } catch {}
  }
  socket.onclose = () => {
    setTimeout(getSocket, 1000) // reconnect
  }
  return socket
}

function listen<T>(event: string, callback: (payload: T) => void): () => void {
  getSocket()
  if (!handlers.has(event)) handlers.set(event, new Set())
  handlers.get(event)!.add(callback as EventCallback)
  return () => handlers.get(event)?.delete(callback as EventCallback)
}

// ── Audio ──

export async function startListening(sampleRate: number): Promise<void> {
  return invoke("start_listening", { sampleRate })
}

export async function stopListening(): Promise<void> {
  return invoke("stop_listening")
}

export async function sendAudioChunk(chunk: string): Promise<void> {
  return invoke("send_audio_chunk", { chunk })
}

// ── Agent ──

export interface ActionResult {
  action: string
  success: boolean
  message: string
}

export async function executeCommand(command: string): Promise<ActionResult[]> {
  return invoke("execute_command", { command })
}

// ── Config ──

export async function saveApiKey(service: string, key: string): Promise<void> {
  return invoke("save_api_key", { service, key })
}

export async function getApiKey(service: string): Promise<string> {
  return invoke("get_api_key", { service })
}

export interface ApiKeys {
  deepgram: string | null
  openai: string | null
}

export async function hasApiKeys(): Promise<ApiKeys> {
  return invoke("has_api_keys")
}

export async function saveLanguage(language: string): Promise<void> {
  return invoke("save_language", { language })
}

export async function getLanguage(): Promise<string> {
  return invoke("get_language")
}

// ── Events ──

export interface TranscriptEvent {
  transcript: string
  is_final: boolean
  confidence: number
}

export function onTranscription(callback: (e: TranscriptEvent) => void): () => void {
  return listen("transcription", callback)
}

export function onTranscriptionError(callback: (error: string) => void): () => void {
  return listen("transcription-error", callback)
}

export function onAgentStatus(callback: (status: string) => void): () => void {
  return listen("agent-status", callback)
}

export function onActionResult(callback: (result: ActionResult) => void): () => void {
  return listen("action-result", callback)
}

// ── Dictation ──

export interface DictationStatusEvent {
  active: boolean
  error?: string | null
}

export function onDictationStatus(callback: (e: DictationStatusEvent) => void): () => void {
  return listen("dictation-status", callback)
}

export function onDictationError(callback: (error: string) => void): () => void {
  return listen("dictation-error", callback)
}

export function onOpenSettings(callback: () => void): () => void {
  return listen("open-settings", callback)
}

export interface DictationTranscriptEvent {
  text: string
  is_final: boolean
}

export function onDictationTranscript(callback: (e: DictationTranscriptEvent) => void): () => void {
  return listen("dictation-transcript", callback)
}

export async function getDictationStatus(): Promise<boolean> {
  return invoke("get_dictation_status")
}

export async function startDictation(): Promise<void> {
  return invoke("start_dictation")
}

export async function stopDictation(): Promise<void> {
  return invoke("stop_dictation")
}

// ── Accessibility ──

export async function checkAccessibility(): Promise<boolean> {
  return invoke("check_accessibility")
}

export async function openAccessibilitySettings(): Promise<void> {
  return invoke("open_accessibility_settings")
}

// ── OAuth / Connectors ──

export interface ConnectorInfo {
  id: string
  display_name: string
}

export async function startOAuth(provider: string): Promise<string> {
  return invoke("start_oauth", { provider })
}

export async function disconnectProvider(provider: string): Promise<void> {
  return invoke("disconnect_provider", { provider })
}

export async function getConnectedProviders(): Promise<string[]> {
  return invoke("get_connected_providers")
}

export async function isProviderConnected(provider: string): Promise<boolean> {
  return invoke("is_provider_connected", { provider })
}

export async function listConnectors(): Promise<ConnectorInfo[]> {
  return invoke("list_connectors")
}

// ── Dictionary ──

export async function addDictionaryWord(from: string, to: string): Promise<void> {
  return invoke("add_dictionary_word", { from, to })
}

export async function removeDictionaryWord(from: string): Promise<void> {
  return invoke("remove_dictionary_word", { from })
}

export async function getDictionary(): Promise<Record<string, string>> {
  return invoke("get_dictionary")
}

export async function importDictionary(entries: Record<string, string>): Promise<void> {
  return invoke("import_dictionary", { entries })
}

// ── Snippets ──

export async function addSnippet(trigger: string, expansion: string): Promise<void> {
  return invoke("add_snippet", { trigger, expansion })
}

export async function removeSnippet(trigger: string): Promise<void> {
  return invoke("remove_snippet", { trigger })
}

export async function getSnippets(): Promise<Record<string, string>> {
  return invoke("get_snippets")
}

// ── Styles ──

export async function getStylePreferences(): Promise<Record<string, string>> {
  return invoke("get_style_preferences")
}

export async function saveStylePreference(category: string, tone: string): Promise<void> {
  return invoke("save_style_preference", { category, tone })
}

// ── Advanced Settings ──

export async function getAdvancedSettings(): Promise<Record<string, boolean>> {
  return invoke("get_advanced_settings")
}

export async function saveAdvancedSetting(key: string, value: boolean): Promise<void> {
  return invoke("save_advanced_setting", { key, value })
}

// ── User Profile ──

export async function saveUserName(name: string): Promise<void> {
  return invoke("save_user_name", { name })
}

export async function getUserName(): Promise<string | null> {
  return invoke("get_user_name")
}

// ── App ──

export async function openSettings(): Promise<void> {
  return invoke("open_settings")
}

// ── History ──

export interface HistoryAction {
  action: string
  success: boolean
  message: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  transcript: string
  entry_type: string
  actions: HistoryAction[]
  success: boolean
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return invoke("get_history")
}

export async function clearHistory(): Promise<void> {
  return invoke("clear_history")
}
