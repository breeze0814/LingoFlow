import Foundation

enum HelperError: Error {
    case permissionDenied(String)
    case operationFailed(String)

    var code: String {
        switch self {
        case .permissionDenied:
            return "permission_denied"
        case .operationFailed:
            return "internal_error"
        }
    }

    var message: String {
        switch self {
        case .permissionDenied(let message), .operationFailed(let message):
            return message
        }
    }
}

