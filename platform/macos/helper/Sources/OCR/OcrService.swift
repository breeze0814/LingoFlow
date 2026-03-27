import AppKit
import Foundation
import Vision

private let providerId = "apple_vision"
private let fallbackLanguages = ["zh-Hans", "zh-Hant", "en-US"]
private let lineMergeThreshold: CGFloat = 0.02

private struct OcrRequestConfig {
    let recognitionLanguages: [String]
    let usesLanguageCorrection: Bool
}

struct OcrService {
    func recognize(from imagePath: String?, sourceLangHint: String?) -> BridgeResponse {
        guard let path = validateImagePath(imagePath) else {
            return BridgeResponse.error(
                code: "invalid_request",
                message: "imagePath is required",
                retryable: false
            )
        }
        guard let cgImage = loadCgImage(from: path) else {
            return BridgeResponse.error(
                code: "ocr_execution_failed",
                message: "Failed to load image: \(path)",
                retryable: false
            )
        }

        do {
            let config = makeConfig(sourceLangHint)
            let text = try extractText(from: cgImage, config: config)
            if text.isEmpty {
                return BridgeResponse.error(
                    code: "ocr_empty_result",
                    message: "OCR returned empty text",
                    retryable: false
                )
            }
            return BridgeResponse.success(data: [
                "providerId": providerId,
                "recognizedText": text
            ])
        } catch {
            return BridgeResponse.error(
                code: "ocr_execution_failed",
                message: "OCR execution failed: \(error.localizedDescription)",
                retryable: true
            )
        }
    }

    private func validateImagePath(_ imagePath: String?) -> String? {
        guard let imagePath, !imagePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return imagePath
    }

    private func loadCgImage(from path: String) -> CGImage? {
        guard let image = NSImage(contentsOfFile: path) else {
            return nil
        }
        var rect = CGRect(origin: .zero, size: image.size)
        return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
    }

    private func makeConfig(_ sourceLangHint: String?) -> OcrRequestConfig {
        let normalized = normalizeLanguage(sourceLangHint)
        let languages = recognitionLanguages(for: normalized)
        return OcrRequestConfig(
            recognitionLanguages: languages,
            usesLanguageCorrection: shouldUseLanguageCorrection(for: normalized)
        )
    }

    private func normalizeLanguage(_ sourceLangHint: String?) -> String? {
        guard let hint = sourceLangHint?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hint.isEmpty else {
            return nil
        }
        return hint.lowercased()
    }

    private func recognitionLanguages(for normalizedLang: String?) -> [String] {
        guard let normalizedLang else {
            return fallbackLanguages
        }
        if normalizedLang.hasPrefix("zh") {
            return fallbackLanguages
        }
        if normalizedLang.hasPrefix("en") {
            return ["en-US", "zh-Hans", "zh-Hant"]
        }
        if normalizedLang.hasPrefix("ja") {
            return ["ja-JP", "en-US", "zh-Hans"]
        }
        if normalizedLang.hasPrefix("ko") {
            return ["ko-KR", "en-US", "zh-Hans"]
        }
        if normalizedLang.hasPrefix("fr") {
            return ["fr-FR", "en-US", "zh-Hans"]
        }
        if normalizedLang.hasPrefix("de") {
            return ["de-DE", "en-US", "zh-Hans"]
        }
        return fallbackLanguages
    }

    private func shouldUseLanguageCorrection(for normalizedLang: String?) -> Bool {
        guard let normalizedLang else {
            return false
        }
        if normalizedLang.hasPrefix("zh") || normalizedLang.hasPrefix("ja") || normalizedLang.hasPrefix("ko") {
            return false
        }
        return true
    }

    private func extractText(from cgImage: CGImage, config: OcrRequestConfig) throws -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = config.recognitionLanguages
        request.usesLanguageCorrection = config.usesLanguageCorrection

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])

        let observations = request.results ?? []
        let lines = observations
            .sorted(by: orderObservations)
            .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func orderObservations(_ lhs: VNRecognizedTextObservation, _ rhs: VNRecognizedTextObservation) -> Bool {
        let left = lhs.boundingBox
        let right = rhs.boundingBox
        if abs(left.midY - right.midY) <= lineMergeThreshold {
            return left.minX < right.minX
        }
        return left.maxY > right.maxY
    }
}
