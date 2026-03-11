import Foundation
import Combine
import AVFoundation

@MainActor
final class AgentViewModel: ObservableObject {

    @Published var isListening = false
    @Published var isProcessing = false
    @Published var transcript = ""
    @Published var actions: [ActionResult] = []
    @Published var errorMessage: String?
    @Published var needsAccessibility = false

    // New: for main window UI
    @Published var history: [HistoryEntry] = []
    @Published var userName = ""

    // Used by DictationPill to show last result
    @Published var lastResultAction: ActionResult?

    private let api = APIClient.shared
    private let events = EventStream.shared
    private let audio = AudioCaptureService.shared
    private var cancellables = Set<AnyCancellable>()
    private var historyTimer: Timer?

    // Accumulate final transcript segments during a Fn-hold session.
    // executeCommand is called ONCE with the full text when stopListening() fires.
    private var transcriptBuffer: [String] = []

    init() {
        Task {
            await checkAccessibility()
            await loadUserName()
            await loadHistory()
        }

        startHistoryPolling()

        // Mirror agent-status events
        events.$agentStatus
            .receive(on: RunLoop.main)
            .sink { [weak self] status in
                self?.isProcessing = (status == "processing")
            }
            .store(in: &cancellables)

        // Mirror transcription events — buffer finals, execute only when Fn released
        events.$transcription
            .compactMap { $0 }
            .receive(on: RunLoop.main)
            .sink { [weak self] event in
                guard let self else { return }
                if event.isFinal && !event.transcript.isEmpty {
                    self.transcriptBuffer.append(event.transcript)
                    // Show the accumulated transcript in the UI (joined)
                    self.transcript = self.transcriptBuffer.joined(separator: " ")
                } else if !event.isFinal {
                    // Show live interim text (won't be acted on)
                    let base = self.transcriptBuffer.joined(separator: " ")
                    self.transcript = base.isEmpty ? event.transcript : base + " " + event.transcript
                }
            }
            .store(in: &cancellables)

        // Append incoming action results
        events.$lastActionResult
            .compactMap { $0 }
            .receive(on: RunLoop.main)
            .sink { [weak self] result in
                let ar = ActionResult(action: result.action, success: result.success, message: result.message)
                self?.actions.insert(ar, at: 0)
                self?.lastResultAction = ar
            }
            .store(in: &cancellables)
    }

    deinit {
        historyTimer?.invalidate()
    }

    // MARK: - History

    func loadHistory() async {
        if let entries: [HistoryEntry] = try? await api.invoke("get_history") {
            history = entries
        }
    }

    func loadUserName() async {
        if let name: String = try? await api.invoke("get_user_name") {
            userName = name
        }
    }

    private func startHistoryPolling() {
        historyTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in await self?.loadHistory() }
        }
    }

    // MARK: - Audio

    func startListening(targetApp: String? = nil) async {
        guard !isListening else { return }
        isListening = true
        transcript = ""
        transcriptBuffer = []
        errorMessage = nil
        lastResultAction = nil

        let granted = await audio.requestPermission()
        guard granted else {
            isListening = false
            errorMessage = "Microphone access denied. Enable it in System Settings → Privacy → Microphone."
            return
        }

        // Engine may still be decompressing (PyInstaller onefile) — retry for up to 15s
        var engineReady = false
        for attempt in 1...15 {
            if await api.isBackendAlive() { engineReady = true; break }
            if attempt == 1 { errorMessage = "Starting engine…" }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        errorMessage = nil
        guard engineReady else {
            isListening = false
            errorMessage = "MiniFlow engine failed to start. Try relaunching the app."
            return
        }

        do {
            var body: [String: Any] = ["sampleRate": 16000]
            if let bundleID = targetApp { body["bundleID"] = bundleID }
            try await api.invokeVoid("start_listening", body: body)
            try audio.startCapture()
        } catch {
            isListening = false
            audio.stopCapture()
            errorMessage = error.localizedDescription
        }
    }

    func stopListening() async {
        guard isListening else { return }
        isListening = false
        audio.stopCapture()
        do { try await api.invokeVoid("stop_listening") } catch {}

        // The stop_listening HTTP call above already waits for Waves to flush (finalize + 2s timeout).
        // Give WebSocket events a moment to land before we collect the buffer.
        try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s

        // Execute with the full accumulated text from this session
        let fullText = transcriptBuffer.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        transcriptBuffer = []
        if !fullText.isEmpty {
            await executeCommand(fullText)
        }
    }

    // MARK: - Command execution

    func executeCommand(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            let results: [ActionResult] = try await api.invoke("execute_command", body: ["command": text])
            actions = results + actions
            lastResultAction = results.first
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearActions() {
        actions = []
        transcript = ""
        errorMessage = nil
        lastResultAction = nil
    }

    // MARK: - Accessibility

    func checkAccessibility() async {
        if let granted: Bool = try? await api.invoke("check_accessibility") {
            needsAccessibility = !granted
        }
    }

    func openAccessibilitySettings() {
        Task { try? await api.invokeVoid("open_accessibility_settings") }
    }
}
