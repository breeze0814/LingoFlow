// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "MyDictHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "mydict-helper", targets: ["App"]),
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

