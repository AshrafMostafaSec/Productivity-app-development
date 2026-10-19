import { Native, isIOS } from './native';
export const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const buffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;
export function base64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(result);
}
export const unbase64 = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0));
export const randomBase64 = (size: number) => base64(crypto.getRandomValues(new Uint8Array(size)));
export async function deriveKey(password: string, salt: string): Promise<Uint8Array> {
  if (isIOS()) return unbase64((await Native.deriveKey({ password, salt, iterations: ITERATIONS })).key);
  const material = await crypto.subtle.importKey('raw', buffer(encoder.encode(password)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: buffer(unbase64(salt)), iterations: ITERATIONS }, material, 256));
}
export async function encrypt(key: Uint8Array, iv: string, plaintext: string, aad: string): Promise<string> {
  if (isIOS()) return (await Native.encrypt({ key: base64(key), iv, plaintext, aad })).ciphertext;
  const imported = await crypto.subtle.importKey('raw', buffer(key), 'AES-GCM', false, ['encrypt']);
  return base64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(unbase64(iv)), additionalData: buffer(encoder.encode(aad)), tagLength: 128 }, imported, buffer(encoder.encode(plaintext)))));
}
export async function decrypt(key: Uint8Array, iv: string, ciphertext: string, aad: string): Promise<string> {
  if (isIOS()) return (await Native.decrypt({ key: base64(key), iv, ciphertext, aad })).plaintext;
  const imported = await crypto.subtle.importKey('raw', buffer(key), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(unbase64(iv)), additionalData: buffer(encoder.encode(aad)), tagLength: 128 }, imported, buffer(unbase64(ciphertext))));
}
export async function sha256(value: string): Promise<string> {
  if (isIOS()) return (await Native.hash({ value })).hex;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(encoder.encode(value))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
