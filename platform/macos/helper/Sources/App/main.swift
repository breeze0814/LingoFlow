import Foundation

let bridge = StdIOBridge()
let permissionService = PermissionService()
let selectionService = SelectionService()
let captureService = CaptureService()
let ocrService = OcrService()

let request = bridge.readRequest()
let response: BridgeResponse

switch request.command {
case "permission.get_status":
    response = permissionService.getStatus()
case "selection.read":
    response = selectionService.readSelection()
case "capture.start_interactive":
    response = captureService.startInteractiveCapture()
case "ocr.recognize":
    response = ocrService.recognize(
        from: request.payload?.imagePath,
        sourceLangHint: request.payload?.sourceLangHint
    )
default:
    response = BridgeResponse.error(
        code: "invalid_request",
        message: "Unsupported command: \(request.command)",
        retryable: false
    )
}

bridge.writeResponse(response)
