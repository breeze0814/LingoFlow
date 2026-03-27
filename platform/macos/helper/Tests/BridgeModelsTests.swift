import XCTest
@testable import App

final class BridgeModelsTests: XCTestCase {
    func testSuccessResponseHasNoError() {
        let response = BridgeResponse.success(data: ["status": "ok"])
        XCTAssertTrue(response.ok)
        XCTAssertNil(response.error)
    }
}
