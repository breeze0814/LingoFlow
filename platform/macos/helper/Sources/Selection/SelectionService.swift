import ApplicationServices
import Foundation

private let selectionReadRetryCount = 4
private let selectionReadRetryDelay: TimeInterval = 0.08
private let selectionMessagingTimeout: Float = 1.5

struct SelectionService {
    func readSelection() -> BridgeResponse {
        do {
            let selectedText = try readSelectedText()
            if selectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return BridgeResponse.error(
                    code: "no_selection",
                    message: "未检测到选中文本",
                    retryable: false
                )
            }
            return BridgeResponse.success(data: ["selectedText": selectedText])
        } catch let error as SelectionError {
            return BridgeResponse.error(
                code: error.code,
                message: error.message,
                retryable: error.retryable
            )
        } catch {
            return BridgeResponse.error(
                code: "selection_failed",
                message: "Selection reading failed: \(error.localizedDescription)",
                retryable: true
            )
        }
    }

    private func readSelectedText() throws -> String {
        guard accessibilityTrusted(prompt: true) else {
            throw SelectionError.permissionDenied(
                "需要启用辅助功能权限后才能读取选中文本。请在“系统设置 > 隐私与安全性 > 辅助功能”中允许当前应用后重试。"
            )
        }

        let systemWide = AXUIElementCreateSystemWide()
        configureMessagingTimeout(for: systemWide)

        if let focusedApplication = try readFocusedApplication(systemWide) {
            configureMessagingTimeout(for: focusedApplication)
            if let focusedElement = try readFocusedElement(focusedApplication) {
                configureMessagingTimeout(for: focusedElement)
                return try readSelectedText(from: focusedElement)
            }
        }

        guard let focusedElement = try readFocusedElement(systemWide) else {
            throw SelectionError.noSelection("未找到当前聚焦控件")
        }
        configureMessagingTimeout(for: focusedElement)
        return try readSelectedText(from: focusedElement)
    }

    private func readFocusedApplication(_ systemWide: AXUIElement) throws -> AXUIElement? {
        try readElementAttribute(
            from: systemWide,
            attribute: kAXFocusedApplicationAttribute as CFString,
            noValueMessage: "未找到当前聚焦应用"
        )
    }

    private func readFocusedElement(_ element: AXUIElement) throws -> AXUIElement? {
        try readElementAttribute(
            from: element,
            attribute: kAXFocusedUIElementAttribute as CFString,
            noValueMessage: "未找到当前聚焦控件"
        )
    }

    private func readElementAttribute(
        from element: AXUIElement,
        attribute: CFString,
        noValueMessage: String
    ) throws -> AXUIElement? {
        var lastStatus: AXError = .success

        for attempt in 0..<selectionReadRetryCount {
            var focusedValue: CFTypeRef?
            let status = AXUIElementCopyAttributeValue(
                element,
                attribute,
                &focusedValue
            )

            if status == .success {
                return (focusedValue as! AXUIElement)
            }
            if status == .apiDisabled {
                throw SelectionError.permissionDenied("系统未授予辅助功能权限")
            }
            if status == .noValue {
                if attempt < selectionReadRetryCount - 1 {
                    pauseBeforeRetry()
                    continue
                }
                return nil
            }
            if status == .cannotComplete, attempt < selectionReadRetryCount - 1 {
                pauseBeforeRetry()
                continue
            }

            lastStatus = status
            break
        }

        if lastStatus == .cannotComplete {
            throw SelectionError.selectionFailed(
                "无法读取辅助功能焦点对象。系统当前暂时无法完成辅助功能查询，请保持文本选中后重试。"
            )
        }
        if lastStatus == .noValue {
            throw SelectionError.noSelection(noValueMessage)
        }
        throw SelectionError.selectionFailed("无法读取聚焦控件: \(lastStatus.rawValue)")
    }

    private func readSelectedText(from element: AXUIElement) throws -> String {
        var lastStatus: AXError = .success

        for attempt in 0..<selectionReadRetryCount {
            var selectedValue: CFTypeRef?
            let status = AXUIElementCopyAttributeValue(
                element,
                kAXSelectedTextAttribute as CFString,
                &selectedValue
            )

            if status == .success, let selectedText = selectedValue as? String {
                return selectedText
            }
            if status == .apiDisabled {
                throw SelectionError.permissionDenied("系统未授予辅助功能权限")
            }
            if status == .attributeUnsupported {
                throw SelectionError.noSelection("当前应用没有可读取的选中文本")
            }
            if status == .noValue, attempt < selectionReadRetryCount - 1 {
                pauseBeforeRetry()
                continue
            }
            if status == .noValue {
                throw SelectionError.noSelection("当前应用没有可读取的选中文本")
            }
            if status == .cannotComplete, attempt < selectionReadRetryCount - 1 {
                pauseBeforeRetry()
                continue
            }

            lastStatus = status
            break
        }

        if lastStatus == .cannotComplete {
            throw SelectionError.selectionFailed(
                "无法读取选中文本。系统当前暂时无法完成辅助功能查询，请保持文本选中后重试。"
            )
        }
        throw SelectionError.selectionFailed("读取选中文本失败: \(lastStatus.rawValue)")
    }

    private func accessibilityTrusted(prompt: Bool) -> Bool {
        if !prompt {
            return AXIsProcessTrusted()
        }
        let options = [
            kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
        ] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    private func configureMessagingTimeout(for element: AXUIElement) {
        _ = AXUIElementSetMessagingTimeout(element, selectionMessagingTimeout)
    }

    private func pauseBeforeRetry() {
        Thread.sleep(forTimeInterval: selectionReadRetryDelay)
    }
}

private enum SelectionError: Error {
    case permissionDenied(String)
    case noSelection(String)
    case selectionFailed(String)

    var code: String {
        switch self {
        case .permissionDenied:
            return "permission_denied"
        case .noSelection:
            return "no_selection"
        case .selectionFailed:
            return "selection_failed"
        }
    }

    var message: String {
        switch self {
        case .permissionDenied(let message),
             .noSelection(let message),
             .selectionFailed(let message):
            return message
        }
    }

    var retryable: Bool {
        switch self {
        case .permissionDenied, .noSelection:
            return false
        case .selectionFailed:
            return true
        }
    }
}
