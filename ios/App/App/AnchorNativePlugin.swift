import Foundation
import Capacitor
import UIKit
import UniformTypeIdentifiers
import CryptoKit
import CommonCrypto

@objc(AnchorNativePlugin)
public final class AnchorNativePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "AnchorNativePlugin"
    public let jsName = "AnchorNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPreviousData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readOriginalData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preserveOriginalData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readAccessData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeAccessData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deriveKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "encrypt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decrypt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "folderStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selectBackupFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listBackups", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBackup", returnType: CAPPluginReturnPromise),
    ]
    private let ioQueue = DispatchQueue(label: "com.ashrafmostafa.anchoros.storage")
    private let limit = 16 * 1024 * 1024

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
                    call.reject("The device file exceeds 16 MB. It has not been changed.", "TOO_LARGE"); return
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
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= limit else { call.reject("Device data exceeds the 16 MB limit.", "TOO_LARGE"); return }
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
    private var pickerCall: CAPPluginCall?
    private let bookmarkKey = "anchoros.backup.folder"
    private let folderTokenKey = "anchoros.backup.folder.token"
    private func failure(_ text: String) -> NSError { NSError(domain: "AnchorOS", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    @objc func readAccessData(_ call: CAPPluginCall) { read("access.json", call: call) }
    @objc func writeAccessData(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count < 64 * 1024 else { call.reject("Invalid local profile."); return }
        ioQueue.async {
            do { _ = try JSONSerialization.jsonObject(with: data); try data.write(to: self.file("access.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]); call.resolve() }
            catch { call.reject("The local profile could not be saved."); }
        }
    }
    @objc func deriveKey(_ call: CAPPluginCall) {
        guard let password = call.getString("password"), let text = call.getString("salt"), let salt = Data(base64Encoded: text), call.getInt("iterations") == 600000 else { call.reject("Invalid password parameters."); return }
        ioQueue.async { do { call.resolve(["key": try AnchorCrypto.key(password: password, salt: salt).base64EncodedString()]) } catch { call.reject("Password derivation failed.") } }
    }
    @objc func encrypt(_ call: CAPPluginCall) {
        guard let keyText = call.getString("key"), let key = Data(base64Encoded: keyText),
              let ivText = call.getString("iv"), let iv = Data(base64Encoded: ivText),
              let plaintext = call.getString("plaintext"), plaintext.utf8.count <= limit,
              let aad = call.getString("aad"), aad.utf8.count < 8192 else { call.reject("Invalid encryption parameters."); return }
        ioQueue.async { do { call.resolve(["ciphertext": try AnchorCrypto.seal(key: key, iv: iv, plaintext: plaintext, aad: aad).base64EncodedString()]) } catch { call.reject("Backup encryption failed.") } }
    }
    @objc func decrypt(_ call: CAPPluginCall) {
        guard let keyText = call.getString("key"), let key = Data(base64Encoded: keyText),
              let ivText = call.getString("iv"), let iv = Data(base64Encoded: ivText),
              let text = call.getString("ciphertext"), text.utf8.count <= 24 * 1024 * 1024,
              let ciphertext = Data(base64Encoded: text), ciphertext.count <= limit,
              let aad = call.getString("aad"), aad.utf8.count < 8192 else { call.reject("Invalid encrypted backup."); return }
        ioQueue.async { do { call.resolve(["plaintext": try AnchorCrypto.open(key: key, iv: iv, ciphertext: ciphertext, aad: aad)]) } catch { call.reject("The password is incorrect or the backup is damaged.") } }
    }
    @objc func hash(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), value.utf8.count <= limit else { call.reject("Data exceeds the file limit."); return }
        ioQueue.async { call.resolve(["hex": AnchorCrypto.hash(value)]) }
    }
    private func coordinated<T>(_ url: URL, writing: Bool = false, deleting: Bool = false, body: @escaping (URL) throws -> T) throws -> T {
        var coordinationError: NSError?
        var result: Result<T, Error>?
        let action: (URL) -> Void = { location in result = Result { try body(location) } }
        if writing { NSFileCoordinator().coordinate(writingItemAt: url, options: deleting ? .forDeleting : [], error: &coordinationError, byAccessor: action) }
        else { NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError, byAccessor: action) }
        if let error = coordinationError { throw error }
        guard let completed = result else { throw failure("The file provider did not complete the operation.") }
        return try completed.get()
    }
    private func withFolder<T>(_ token: String?, body: (URL) throws -> T) throws -> T {
        guard let bookmark = UserDefaults.standard.data(forKey: bookmarkKey),
              let currentToken = UserDefaults.standard.string(forKey: folderTokenKey),
              token == nil || token == currentToken else { throw failure("Choose your backup folder again. The previous selection is no longer available.") }
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        guard url.startAccessingSecurityScopedResource() else { throw failure("Folder access was revoked. Choose your backup folder again.") }
        defer { url.stopAccessingSecurityScopedResource() }
        if stale { UserDefaults.standard.set(try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil), forKey: bookmarkKey) }
        return try body(url)
    }
    @objc func folderStatus(_ call: CAPPluginCall) {
        ioQueue.async {
            guard UserDefaults.standard.data(forKey: self.bookmarkKey) != nil else { call.resolve(["configured": false, "name": NSNull(), "token": NSNull()]); return }
            do { try self.withFolder(nil) { url in
                call.resolve(["configured": true, "name": url.lastPathComponent, "token": UserDefaults.standard.string(forKey: self.folderTokenKey) ?? ""])
            } } catch { call.reject("The backup folder is unavailable. Choose it again in Profile & Backups.", "FOLDER_ACCESS") }
        }
    }
    @objc func selectBackupFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil, let presenter = self.bridge?.viewController else { call.reject("Close the existing folder picker first."); return }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self; picker.allowsMultipleSelection = false
            presenter.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.reject("Folder selection cancelled. Your previous folder has been kept.", "CANCELLED"); pickerCall = nil
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall else { return }; pickerCall = nil
        guard let url = urls.first else { call.reject("Choose a folder."); return }
        ioQueue.async {
            do {
                let home = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true).resolvingSymlinksInPath().path
                let path = url.resolvingSymlinksInPath().path
                guard path != home && !path.hasPrefix(home + "/") else { throw self.failure("Choose a folder outside AnchorOS. Files inside this app are deleted when it is uninstalled.") }
                guard url.startAccessingSecurityScopedResource() else { throw self.failure("This folder cannot be accessed. Choose another folder.") }
                defer { url.stopAccessingSecurityScopedResource() }
                let probe = url.appendingPathComponent("anchoros-permission-\(UUID().uuidString).tmp")
                try self.coordinated(probe, writing: true) { at in try Data().write(to: at, options: .atomic); try FileManager.default.removeItem(at: at) }
                let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
                let token = UUID().uuidString
                UserDefaults.standard.set(bookmark, forKey: self.bookmarkKey)
                UserDefaults.standard.set(token, forKey: self.folderTokenKey)
                call.resolve(["configured": true, "name": url.lastPathComponent, "token": token])
            } catch { call.reject(error.localizedDescription, "FOLDER_ACCESS") }
        }
    }
    private func backupURL(_ folder: URL, id: String) throws -> URL {
        guard id.range(of: "^anchoros-[0-9]+-[a-fA-F0-9-]{36}\\.anchorbackup$", options: .regularExpression) != nil else { throw failure("Invalid backup filename.") }
        return folder.appendingPathComponent(id, isDirectory: false)
    }
    private func backupBytes(_ url: URL) throws -> Data {
        try coordinated(url) { at in
            let attrs = try FileManager.default.attributesOfItem(atPath: at.path)
            guard ((attrs[.size] as? NSNumber)?.intValue ?? 0) <= self.limit else { throw self.failure("This backup exceeds 16 MB.") }
            let data = try Data(contentsOf: at)
            guard data.count <= self.limit else { throw self.failure("This backup exceeds 16 MB.") }; return data
        }
    }
    private func timestamp(_ milliseconds: Double) -> String { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter.string(from: Date(timeIntervalSince1970: milliseconds / 1000)) }
    @objc func listBackups(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else { call.reject("Choose a folder first."); return }
        ioQueue.async {
            do {
                let files: [[String: Any]] = try self.withFolder(token) { folder in
                    let urls = try self.coordinated(folder) { try FileManager.default.contentsOfDirectory(at: $0, includingPropertiesForKeys: nil) }.filter { $0.pathExtension == "anchorbackup" && $0.lastPathComponent.hasPrefix("anchoros-") }
                    guard urls.count <= 500 else { throw self.failure("This folder has too many backup files. Move older files to an archive folder.") }
                    var result: [[String: Any]] = []
                    for url in urls {
                        guard (try? self.backupURL(folder, id: url.lastPathComponent)) != nil else { continue }
                        let data = try self.backupBytes(url)
                        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                              let header = object["header"] as? [String: Any], header["format"] as? String == "anchoros-encrypted", header["kind"] as? String == "backup",
                              let profile = header["profile"] as? [String: Any], let subject = profile["subject"] as? String,
                              let meta = header["meta"] as? [String: Any], let installation = meta["installation"] as? String,
                              let revision = meta["revision"] as? NSNumber, let hash = meta["hash"] as? String, let created = meta["createdAt"] as? NSNumber else { continue }
                        result.append(["id": url.lastPathComponent, "name": url.lastPathComponent, "size": String(data.count), "createdTime": self.timestamp(created.doubleValue), "appProperties": ["app": "anchoros", "format": "1", "profile": subject, "installation": installation, "revision": revision.stringValue, "hash": hash]])
                    }
                    return result
                }
                call.resolve(["files": files])
            } catch { call.reject(error.localizedDescription, "FOLDER_READ") }
        }
    }
    @objc func readBackup(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let id = call.getString("id") else { call.reject("Choose a backup first."); return }
        ioQueue.async { do {
            let value = try self.withFolder(token) { folder -> String in
                let data = try self.backupBytes(self.backupURL(folder, id: id))
                guard let text = String(data: data, encoding: .utf8) else { throw self.failure("The backup is not readable.") }; return text
            }; call.resolve(["value": value])
        } catch { call.reject(error.localizedDescription, "FOLDER_READ") } }
    }
    @objc func writeBackup(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let id = call.getString("id"), let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= limit else { call.reject("The backup exceeds the file limit."); return }
        ioQueue.async { do {
            try self.withFolder(token) { folder in
                let url = try self.backupURL(folder, id: id)
                try self.coordinated(url, writing: true) { at in
                    guard !FileManager.default.fileExists(atPath: at.path) else { throw self.failure("A backup with this name already exists. It has not been replaced.") }
                    try data.write(to: at, options: .atomic)
                }
            }; call.resolve()
        } catch { call.reject(error.localizedDescription, "FOLDER_WRITE") } }
    }
    @objc func removeBackup(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let id = call.getString("id") else { call.reject("Choose a backup first."); return }
        ioQueue.async { do {
            try self.withFolder(token) { folder in try self.coordinated(self.backupURL(folder, id: id), writing: true, deleting: true) { try FileManager.default.removeItem(at: $0) } }; call.resolve()
        } catch { call.reject(error.localizedDescription, "FOLDER_WRITE") } }
    }
}
