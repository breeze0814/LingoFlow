import Foundation

struct CaptureService {
    func startInteractiveCapture(to imagePath: String?) -> BridgeResponse {
        let outputPath = resolvedOutputPath(imagePath)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = ["-i", "-x", outputPath]

        let errorPipe = Pipe()
        process.standardError = errorPipe

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return BridgeResponse.error(
                code: "capture_failed",
                message: "Failed to start capture flow: \(error.localizedDescription)",
                retryable: true
            )
        }

        let errorOutput = String(
            data: errorPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        )?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if process.terminationStatus == 0 {
            return BridgeResponse.success(data: ["imagePath": outputPath])
        }

        if process.terminationStatus == 1 {
            return BridgeResponse.error(
                code: "user_cancelled",
                message: "User cancelled screenshot capture",
                retryable: false
            )
        }

        if errorOutput.localizedCaseInsensitiveContains("permission") ||
            errorOutput.localizedCaseInsensitiveContains("not permitted") {
            return BridgeResponse.error(
                code: "permission_denied",
                message: errorOutput.isEmpty ? "Screenshot permission denied" : errorOutput,
                retryable: false
            )
        }

        return BridgeResponse.error(
            code: "capture_failed",
            message: errorOutput.isEmpty
                ? "Screenshot capture failed with status \(process.terminationStatus)"
                : errorOutput,
            retryable: true
        )
    }

    private func resolvedOutputPath(_ imagePath: String?) -> String {
        if let imagePath,
           !imagePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return imagePath
        }
        let fileName = "lingoflow-helper-capture-\(UUID().uuidString).png"
        return URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(fileName)
            .path
    }
}
