import Foundation

struct PermissionService {
    func getStatus() -> BridgeResponse {
        BridgeResponse.success(
            data: [
                "accessibility": "unknown",
                "screen_recording": "unknown",
            ]
        )
    }
}

