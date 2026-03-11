import { useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";

export function TranscriptionArea() {
  const transcriptSegments = useAppStore((s) => s.transcriptSegments);
  const interimText = useAppStore((s) => s.interimText);
  const isListening = useAppStore((s) => s.isListening);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptSegments, interimText]);

  const hasContent = transcriptSegments.length > 0 || interimText;

  return (
    <div ref={scrollRef} className="max-h-32 overflow-y-auto">
      {!hasContent && (
        <p className="text-sm font-sans italic" style={{ color: "#8A8A8E" }}>
          {isListening ? "Listening... start speaking" : ""}
        </p>
      )}
      {hasContent && (
        <div className="font-sans leading-relaxed text-sm" style={{ color: "#1C1C1E" }}>
          {transcriptSegments.map((segment, i) => (
            <span
              key={segment.id}
              style={{ opacity: i === transcriptSegments.length - 1 && !interimText ? 1 : 0.5 }}
            >
              {segment.text}{" "}
            </span>
          ))}
          {interimText && (
            <span style={{ opacity: 0.8 }}>
              {interimText}
              <span className="inline-block w-0.5 h-[1em] align-middle ml-0.5 animate-blink" style={{ background: "#7A5C1E" }} />
            </span>
          )}
          {!interimText && transcriptSegments.length > 0 && isListening && (
            <span className="inline-block w-0.5 h-[1em] align-middle animate-blink" style={{ background: "#7A5C1E" }} />
          )}
        </div>
      )}
    </div>
  );
}
