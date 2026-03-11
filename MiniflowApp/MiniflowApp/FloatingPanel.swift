import AppKit

/// A borderless, non-activating floating panel that stays above regular windows.
/// The SwiftUI content view is responsible for all visual styling.
final class FloatingPanel: NSPanel {

    override init(
        contentRect: NSRect,
        styleMask style: NSWindow.StyleMask,
        backing backingStoreType: NSWindow.BackingStoreType,
        defer flag: Bool
    ) {
        super.init(
            contentRect: contentRect,
            styleMask: .nonactivatingPanel,
            backing: backingStoreType,
            defer: flag
        )
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isMovableByWindowBackground = true
        backgroundColor = .clear
        isOpaque = false
        hasShadow = false          // SwiftUI .shadow() handles this
        titlebarAppearsTransparent = true
        titleVisibility = .hidden
    }

    // Allow key events (e.g. typing in the command bar) without becoming main
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
