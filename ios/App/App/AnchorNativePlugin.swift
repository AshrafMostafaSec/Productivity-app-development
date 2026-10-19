import Foundation
import Capacitor
import GoogleSignIn

@objc(AnchorNativePlugin)
public final class AnchorNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AnchorNativePlugin"
    public let jsName = "AnchorNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPreviousData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readOriginalData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preserveOriginalData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleAuthorizeDrive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleSignOut", returnType: CAPPluginReturnPromise)
    ]
    private let ioQueue = DispatchQueue(label: "com.ashrafmostafa.anchoros.storage")
    private let limit = 8 * 1024 * 1024
    private let driveScope = "https://www.googleapis.com/auth/drive.appdata"

    private func file(_ name: String) throws -> URL {
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("AnchorOS", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        return root.appendingPathComponent(name)
    }
    private func read(_ name: String, call: CAPPluginCall) {
        ioQueue.async {
            do {
                let url = try self.file(name)
                guard FileManager.default.fileExists(atPath: url.path) else { call.resolve(["value": NSNull()]); return }
                let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
                guard ((attrs[.size] as? NSNumber)?.intValue ?? 0) <= self.limit else {
                    call.reject("The device file exceeds 8 MB. It has not been changed.", "TOO_LARGE"); return
                }
                let data = try Data(contentsOf: url)
                guard let value = String(data: data, encoding: .utf8) else { call.reject("The device file cannot be read. It has not been changed.", "INVALID_DATA"); return }
                call.resolve(["value": value])
            } catch { call.reject("Device storage could not be opened. Unlock the device and try again.", "STORAGE_READ") }
        }
    }
    @objc func readData(_ call: CAPPluginCall) { read("current.json", call: call) }
    @objc func readPreviousData(_ call: CAPPluginCall) { read("previous.json", call: call) }
    @objc func readOriginalData(_ call: CAPPluginCall) { read("original.json", call: call) }
    @objc func preserveOriginalData(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= limit else { call.reject("Invalid device file.", "INVALID_DATA"); return }
        ioQueue.async {
            do {
                let url = try self.file("original.json")
                if !FileManager.default.fileExists(atPath: url.path) {
                    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                }
                call.resolve()
            } catch { call.reject("The original device file could not be preserved.", "STORAGE_WRITE") }
        }
    }
    @objc func writeData(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= limit else { call.reject("Device data exceeds the 8 MB limit.", "TOO_LARGE"); return }
        ioQueue.async {
            do {
                _ = try JSONSerialization.jsonObject(with: data)
                let current = try self.file("current.json")
                if FileManager.default.fileExists(atPath: current.path) {
                    let previous = try Data(contentsOf: current)
                    try previous.write(to: self.file("previous.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                }
                // State and backup metadata share one atomically replaced file. A crash cannot split their commit.
                try data.write(to: current, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                call.resolve()
            } catch { call.reject("Changes could not be saved. Free some device space and try again.", "STORAGE_WRITE") }
        }
    }
    private func configure() -> Bool {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
              clientID.hasSuffix(".apps.googleusercontent.com"), !clientID.contains("YOUR_") else { return false }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        return true
    }
    private func account(_ user: GIDGoogleUser) -> [String: Any]? {
        guard let subject = user.userID, !subject.isEmpty else { return nil }
        return ["subject": subject, "email": user.profile?.email ?? "", "name": user.profile?.name ?? "Google account"]
    }
    @objc func googleStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.configure() else { call.resolve(["configured": false, "account": NSNull()]); return }
            if let user = GIDSignIn.sharedInstance.currentUser, let profile = self.account(user) {
                call.resolve(["configured": true, "account": profile]); return
            }
            guard GIDSignIn.sharedInstance.hasPreviousSignIn() else { call.resolve(["configured": true, "account": NSNull()]); return }
            GIDSignIn.sharedInstance.restorePreviousSignIn { user, _ in
                if let user = user, let profile = self.account(user) { call.resolve(["configured": true, "account": profile]) }
                else { call.resolve(["configured": true, "account": NSNull()]) }
            }
        }
    }
    @objc func googleSignIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.configure(), let presenter = self.bridge?.viewController else { call.reject("Google sign-in needs the iOS OAuth client configuration.", "NOT_CONFIGURED"); return }
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
                guard error == nil, let user = result?.user, let profile = self.account(user) else { call.reject("Google sign-in did not finish. Please try again.", "SIGN_IN"); return }
                call.resolve(["account": profile])
            }
        }
    }
    @objc func googleAuthorizeDrive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let user = GIDSignIn.sharedInstance.currentUser, let presenter = self.bridge?.viewController else { call.reject("Sign in again to enable backup.", "AUTH_REQUIRED"); return }
            if user.grantedScopes?.contains(self.driveScope) == true { call.resolve(); return }
            user.addScopes([self.driveScope], presenting: presenter) { result, error in
                guard error == nil, result?.user.grantedScopes?.contains(self.driveScope) == true else { call.reject("Allow Google Drive app storage to enable backup.", "SCOPE_REQUIRED"); return }
                call.resolve()
            }
        }
    }
    @objc func googleToken(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let user = GIDSignIn.sharedInstance.currentUser, user.grantedScopes?.contains(self.driveScope) == true else { call.reject("Reconnect Google and allow Drive backup.", "AUTH_REQUIRED"); return }
            user.refreshTokensIfNeeded { refreshed, error in
                guard error == nil, let refreshed = refreshed, let subject = refreshed.userID else { call.reject("Google access expired. Sign in again.", "AUTH_REQUIRED"); return }
                // Refresh tokens remain inside the Google SDK's native credential storage.
                call.resolve(["accessToken": refreshed.accessToken.tokenString, "subject": subject])
            }
        }
    }
    @objc func googleSignOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async { GIDSignIn.sharedInstance.signOut(); call.resolve() }
    }
}
