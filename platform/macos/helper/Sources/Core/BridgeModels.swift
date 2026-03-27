import Foundation

struct BridgeRequest: Codable {
    let command: String
    let payload: BridgePayload?
}

struct BridgePayload: Codable {
    let imagePath: String?
    let sourceLangHint: String?
}

struct BridgeError: Codable {
    let code: String
    let message: String
    let retryable: Bool
}

struct BridgeResponse: Codable {
    let ok: Bool
    let data: [String: String]?
    let error: BridgeError?

    static func success(data: [String: String]) -> BridgeResponse {
        BridgeResponse(ok: true, data: data, error: nil)
    }

    static func error(code: String, message: String, retryable: Bool) -> BridgeResponse {
        BridgeResponse(
            ok: false,
            data: nil,
            error: BridgeError(code: code, message: message, retryable: retryable)
        )
    }
}
