import { useEffect } from "react";
import {
  onTranscription,
  onTranscriptionError,
  TranscriptEvent,
} from "../lib/bridge";
import { useAppStore } from "../stores/appStore";

export function useTranscription() {
  const addFinalSegment = useAppStore((s) => s.addFinalSegment);
  const setInterimText = useAppStore((s) => s.setInterimText);

  useEffect(() => {
    let unlistenTranscript: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setup = async () => {
      unlistenTranscript = await onTranscription((event: TranscriptEvent) => {
        if (event.is_final) {
          addFinalSegment(event.transcript, event.confidence);
        } else {
          setInterimText(event.transcript);
        }
      });

      unlistenError = await onTranscriptionError((error: string) => {
        console.error("Transcription error:", error);
      });
    };

    setup();

    return () => {
      unlistenTranscript?.();
      unlistenError?.();
    };
  }, [addFinalSegment, setInterimText]);
}
