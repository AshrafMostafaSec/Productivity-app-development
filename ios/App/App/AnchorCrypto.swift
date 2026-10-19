import Foundation
import CryptoKit
import CommonCrypto

/// Shared by the iOS bridge and the macOS interoperability checks in CI.
enum AnchorCrypto {
    enum CryptoFailure: Error { case invalidParameters, derivationFailed }
    static func key(password: String, salt: Data) throws -> Data {
        guard salt.count == 16, password.utf8.count <= 1024 else { throw CryptoFailure.invalidParameters }
        var bytes = [UInt8](repeating: 0, count: 32)
        defer { _ = bytes.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) } }
        let status = bytes.withUnsafeMutableBytes { output in
            password.utf8CString.withUnsafeBufferPointer { input in
                salt.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), input.baseAddress!, input.count - 1,
                        saltBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 600000,
                        output.baseAddress!.assumingMemoryBound(to: UInt8.self), 32)
                }
            }
        }
        guard status == kCCSuccess else { throw CryptoFailure.derivationFailed }
        return Data(bytes)
    }
    static func seal(key: Data, iv: Data, plaintext: String, aad: String) throws -> Data {
        guard key.count == 32, iv.count == 12 else { throw CryptoFailure.invalidParameters }
        let sealed = try AES.GCM.seal(Data(plaintext.utf8), using: SymmetricKey(data: key), nonce: AES.GCM.Nonce(data: iv), authenticating: Data(aad.utf8))
        return sealed.ciphertext + sealed.tag
    }
    static func open(key: Data, iv: Data, ciphertext: Data, aad: String) throws -> String {
        guard key.count == 32, iv.count == 12, ciphertext.count >= 16 else { throw CryptoFailure.invalidParameters }
        let sealed = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: ciphertext.dropLast(16), tag: ciphertext.suffix(16))
        let plaintext = try AES.GCM.open(sealed, using: SymmetricKey(data: key), authenticating: Data(aad.utf8))
        guard let value = String(data: plaintext, encoding: .utf8) else { throw CryptoFailure.invalidParameters }
        return value
    }
    static func hash(_ value: String) -> String { SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined() }
}
