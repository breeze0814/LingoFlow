[Root](../CLAUDE.md) > **platform**

# Platform Bridge Module

## Module Responsibility

Platform-specific native code for features that cannot be implemented in Rust alone. Currently contains macOS Swift helper for screen capture, OCR (Apple Vision), permissions, and text selection.

## Entry Points & Startup

### macOS Helper (`macos/helper/`)

- **Main entry**: `Sources/App/main.swift` - Swift executable entry point
- **Package manifest**: `Package.swift` - Swift Package Manager configuration
- **Communication**: stdin/stdout JSON bridge with Rust backend

### Startup Sequence

1. Rust backend spawns helper process via `platform::macos_helper`
2. Helper reads JSON commands from stdin
3. Executes platform-specific operations
4. Writes JSON responses to stdout
5. Rust backend parses responses

## Key Interfaces

### JSON Bridge Protocol

**Request format**:
```json
{
  "action": "capture_screen" | "ocr_image" | "check_permissions" | "read_selection",
  "params": { ... }
}
```

**Response format**:
```json
{
  "success": true,
  "data": { ... }
}
```
or
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Swift Modules

**Capture** (`Sources/Capture/CaptureService.swift`):
- Screen capture functionality
- Window capture
- Region capture

**OCR** (`Sources/OCR/OcrService.swift`):
- Apple Vision Framework integration
- Text recognition from images
- Language detection

**Permission** (`Sources/Permission/PermissionService.swift`):
- Screen recording permission check
- Accessibility permission check
- Permission request dialogs

**Selection** (`Sources/Selection/SelectionService.swift`):
- Read selected text from active application
- Clipboard integration

**IO** (`Sources/IO/StdIOBridge.swift`):
- stdin/stdout JSON communication
- Error handling
- Message serialization

**Core** (`Sources/Core/`):
- `BridgeModels.swift` - Shared data models
- `BridgeError.swift` - Error types

## Dependencies & Configuration

### Swift Dependencies

- Foundation - Core Swift framework
- AppKit - macOS UI framework
- Vision - Apple Vision Framework for OCR
- ScreenCaptureKit - Screen capture APIs (macOS 12.3+)

### Build Configuration

- Swift Package Manager (SPM)
- Build script: `scripts/build-macos-helper.mjs`
- Output: `src-tauri/binaries/lingoflow-helper-macos-{arch}`

## Data Models

### Bridge Models (`Sources/Core/BridgeModels.swift`)

- `BridgeRequest` - Command request from Rust
- `BridgeResponse` - Response to Rust
- `CaptureParams` - Screen capture parameters
- `OcrParams` - OCR parameters
- `PermissionStatus` - Permission status

### Error Models (`Sources/Core/BridgeError.swift`)

- `BridgeError` - Error enum with codes
- Error codes: `INVALID_JSON`, `UNKNOWN_ACTION`, `CAPTURE_FAILED`, `OCR_FAILED`, etc.

## Testing

### Test Location

- `Tests/BridgeModelsTests.swift` - Bridge model tests

### Running Tests

```bash
npm run test:swift                                     # Run Swift tests
node ./scripts/run-swift-tests.mjs                    # Direct script
swift test --package-path platform/macos/helper       # Direct Swift test
```

## Quality Tools

- **Swift compiler** - Built-in type checking
- **SwiftLint** - Code linting (if configured)
- **Swift format** - Code formatting

## Common Issues

### macOS Version Requirements

- Screen capture requires macOS 12.3+ (ScreenCaptureKit)
- Some features may require specific macOS versions
- Check availability before using APIs

### Permission Requirements

- Screen recording permission required for capture
- Accessibility permission required for text selection
- App must request permissions before use

### Process Communication

- Helper process must be built before running app
- Build script automatically invoked by `npm run dev`
- Binary must be in `src-tauri/binaries/` for Tauri to bundle

## Related Files

### Swift Source Files (10 files)

**App**:
- `Sources/App/main.swift`

**Modules**:
- `Sources/Capture/CaptureService.swift`
- `Sources/OCR/OcrService.swift`
- `Sources/Permission/PermissionService.swift`
- `Sources/Selection/SelectionService.swift`
- `Sources/IO/StdIOBridge.swift`
- `Sources/Core/BridgeModels.swift`
- `Sources/Core/BridgeError.swift`

**Tests**:
- `Tests/BridgeModelsTests.swift`

**Configuration**:
- `Package.swift`

### Build Scripts

- `scripts/build-macos-helper.mjs` - Build helper executable
- `scripts/run-swift-tests.mjs` - Run Swift tests

## Changelog

**2026-04-19 17:26:20** - Initial module documentation created during AI context initialization.
