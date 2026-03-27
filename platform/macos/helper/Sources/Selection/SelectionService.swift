import Foundation

struct SelectionService {
    func readSelection() -> BridgeResponse {
        BridgeResponse.error(
            code: "no_selection",
            message: "Selection reading is not implemented yet",
            retryable: true
        )
    }
}

