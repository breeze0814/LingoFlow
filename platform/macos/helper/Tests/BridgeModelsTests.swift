import Testing
@testable import App

@Test
func successResponseHasNoError() {
    let response = BridgeResponse.success(data: ["status": "ok"])
    #expect(response.ok)
    #expect(response.error == nil)
}
