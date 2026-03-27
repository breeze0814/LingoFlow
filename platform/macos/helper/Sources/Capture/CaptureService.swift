import Foundation

struct CaptureService {
    func startInteractiveCapture() -> BridgeResponse {
        BridgeResponse.error(
            code: "capture_failed",
            message: "Capture flow is not implemented yet",
            retryable: true
        )
    }
}

