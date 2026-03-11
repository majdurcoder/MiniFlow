import { create } from "zustand";

export interface TranscriptSegment {
  id: string;
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
}

export interface ActionResult {
  id: string;
  action: string;
  success: boolean;
  message: string;
  timestamp: number;
}

export interface AppState {
  // Audio / Recording
  isListening: boolean;
  setListening: (listening: boolean) => void;

  // Transcription
  transcriptSegments: TranscriptSegment[];
  interimText: string;
  addFinalSegment: (text: string, confidence: number) => void;
  setInterimText: (text: string) => void;
  clearTranscript: () => void;

  // Agent
  agentStatus: "idle" | "thinking" | "executing" | string;
  setAgentStatus: (status: string) => void;
  actionResults: ActionResult[];
  addActionResult: (result: Omit<ActionResult, "id" | "timestamp">) => void;
  clearActions: () => void;

  // Settings
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  hasDeepgramKey: boolean;
  hasOpenAIKey: boolean;
  setKeyStatus: (deepgram: boolean, openai: boolean) => void;

  // Sidebar
  showActionPanel: boolean;
  setShowActionPanel: (show: boolean) => void;

  // Dictation (global background mode)
  dictationActive: boolean;
  setDictationActive: (active: boolean) => void;
  dictationError: string | null;
  setDictationError: (error: string | null) => void;
  dictationTranscript: string;
  setDictationTranscript: (text: string) => void;
}

let segmentCounter = 0;
let actionCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  // Audio
  isListening: false,
  setListening: (listening) => set({ isListening: listening }),

  // Transcription
  transcriptSegments: [],
  interimText: "",
  addFinalSegment: (text, confidence) =>
    set((state) => ({
      transcriptSegments: [
        ...state.transcriptSegments,
        {
          id: `seg-${++segmentCounter}`,
          text,
          isFinal: true,
          confidence,
          timestamp: Date.now(),
        },
      ],
      interimText: "",
    })),
  setInterimText: (text) => set({ interimText: text }),
  clearTranscript: () => set({ transcriptSegments: [], interimText: "" }),

  // Agent
  agentStatus: "idle",
  setAgentStatus: (status) => set({ agentStatus: status }),
  actionResults: [],
  addActionResult: (result) =>
    set((state) => ({
      actionResults: [
        {
          ...result,
          id: `act-${++actionCounter}`,
          timestamp: Date.now(),
        },
        ...state.actionResults,
      ],
    })),
  clearActions: () => set({ actionResults: [] }),

  // Settings
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  hasDeepgramKey: false,
  hasOpenAIKey: false,
  setKeyStatus: (deepgram, openai) =>
    set({ hasDeepgramKey: deepgram, hasOpenAIKey: openai }),

  // Sidebar
  showActionPanel: true,
  setShowActionPanel: (show) => set({ showActionPanel: show }),

  // Dictation
  dictationActive: false,
  setDictationActive: (active) => set({ dictationActive: active }),
  dictationError: null,
  setDictationError: (error) => set({ dictationError: error }),
  dictationTranscript: "",
  setDictationTranscript: (text) => set({ dictationTranscript: text }),
}));
