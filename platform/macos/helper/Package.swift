// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "LingoFlowHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "lingoflow-helper", targets: ["App"]),
    ],
    targets: [
        .executableTarget(
            name: "App",
            path: "Sources"
        ),
        .testTarget(
            name: "AppTests",
            dependencies: ["App"],
            path: "Tests"
        ),
    ]
)
