import Foundation
let path = CommandLine.arguments[1]
let vectors = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: path))) as! [[String: String]]
for vector in vectors {
    let salt = Data(base64Encoded: vector["salt"]!)!
    let iv = Data(base64Encoded: vector["iv"]!)!
    let key = try AnchorCrypto.key(password: vector["password"]!, salt: salt)
    precondition(key.base64EncodedString() == vector["key"], "PBKDF2 differs from WebCrypto")
    let ciphertext = try AnchorCrypto.seal(key: key, iv: iv, plaintext: vector["plaintext"]!, aad: vector["aad"]!)
    precondition(ciphertext.base64EncodedString() == vector["ciphertext"], "AES-GCM differs from WebCrypto")
    let opened = try AnchorCrypto.open(key: key, iv: iv, ciphertext: ciphertext, aad: vector["aad"]!)
    precondition(opened == vector["plaintext"], "Backup round trip failed")
    precondition(AnchorCrypto.hash(opened) == vector["hash"], "SHA-256 differs from WebCrypto")
    do {
        _ = try AnchorCrypto.open(key: key, iv: iv, ciphertext: ciphertext, aad: vector["aad"]! + "tampered")
        fatalError("Unauthenticated header was accepted")
    } catch { /* Authentication must fail. */ }
}
print("Native PBKDF2, AES-GCM, SHA-256, Unicode encoding and tamper rejection match WebCrypto (\(vectors.count) vectors).")
