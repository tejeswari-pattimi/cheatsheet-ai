import { safeStorage } from 'electron';

export class SecureConfigHelper {
  static encrypt(text: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(text).toString('base64');
    }
    // Fallback if encryption is not available (e.g. dev environment sometimes)
    // Warning: This is not secure, but ensures functionality in environments without keychain
    console.warn('safeStorage not available, storing as plain text (insecure)');
    return text;
  }

  static decrypt(encryptedText: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(encryptedText, 'base64');
        return safeStorage.decryptString(buffer);
      } catch (error) {
        // If decryption fails, it might be plain text (migration scenario)
        return encryptedText;
      }
    }
    return encryptedText;
  }

  static isEncrypted(text: string): boolean {
    if (!text || text.length === 0) return false;
    // Simple heuristic: Base64 strings are usually encrypted data
    // But since we can't be sure, we rely on try-decrypt pattern
    return true;
  }
}
