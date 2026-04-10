import ApplicationServices
import CoreGraphics
import Foundation

struct PermissionService {
    func getStatus() -> BridgeResponse {
        BridgeResponse.success(
            data: [
                "accessibility": AXIsProcessTrusted() ? "granted" : "denied",
                "screen_recording": screenRecordingStatus(),
            ]
        )
    }

    private func screenRecordingStatus() -> String {
        if #available(macOS 10.15, *) {
            return CGPreflightScreenCaptureAccess() ? "granted" : "denied"
        }
        return "unknown"
    }
}
