import { encrypt, decrypt } from '@/lib/utils/encryption';
import crypto from 'crypto';

process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-testing-32ch';

function legacyEncrypt(text: string): string {
  const key = crypto.scryptSync(process.env.ENCRYPTION_SECRET!, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

describe('encryption', () => {
  it('should encrypt and decrypt text', () => {
    const original = 'my-secret-api-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^v2:/);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext each time', () => {
    const text = 'same-text';
    const e1 = encrypt(text);
    const e2 = encrypt(text);
    expect(e1).not.toBe(e2);
  });

  it('should reject tampered ciphertext', () => {
    const encrypted = encrypt('sensitive-key');
    const tampered = encrypted.replace(/.$/, encrypted.endsWith('0') ? '1' : '0');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should decrypt legacy CBC ciphertext', () => {
    const original = 'legacy-secret-api-key';
    const encrypted = legacyEncrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });
});
