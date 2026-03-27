import Foundation

struct StdIOBridge {
    func readRequest() -> BridgeRequest {
        guard let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8),
              let data = input.data(using: .utf8),
              let request = try? JSONDecoder().decode(BridgeRequest.self, from: data) else {
            return BridgeRequest(command: "invalid_request", payload: nil)
        }
        return request
    }

    func writeResponse(_ response: BridgeResponse) {
        let encoded = (try? JSONEncoder().encode(response)) ?? Data("{}".utf8)
        FileHandle.standardOutput.write(encoded)
    }
}

