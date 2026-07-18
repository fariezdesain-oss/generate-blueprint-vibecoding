import { encrypt, decrypt } from '@/lib/utils/encryption';
import crypto from 'crypto';

process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-testing-32ch';

function v2Encrypt(text: string): string {
  const key = crypto.scryptSync(process.env.ENCRYPTION_SECRET!, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return ['v2', iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

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
    expect(encrypted).toMatch(/^v3:/);

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

  it('should decrypt v2 ciphertext', () => {
    const original = 'v2-secret-api-key';
    const encrypted = v2Encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('should decrypt legacy CBC ciphertext', () => {
    const original = 'legacy-secret-api-key';
    const encrypted = legacyEncrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('should use different v3 salts and keep salt distinct from iv', () => {
    const firstParts = encrypt('same-text').split(':');
    const secondParts = encrypt('same-text').split(':');

    expect(firstParts).toHaveLength(5);
    expect(firstParts[1]).not.toBe(secondParts[1]);
    expect(firstParts[1]).not.toBe(firstParts[2]);
    expect(secondParts[1]).not.toBe(secondParts[2]);
  });

  it('should reject malformed v3 ciphertext with extra part', () => {
    const encrypted = encrypt('secret') + ':extra';
    expect(() => decrypt(encrypted)).toThrow('Invalid encrypted text');
  });

  it('should reject malformed v2 ciphertext with missing or extra part', () => {
    const encrypted = v2Encrypt('secret');
    const missingPart = encrypted.split(':').slice(0, 3).join(':');
    const extraPart = encrypted + ':extra';

    expect(() => decrypt(missingPart)).toThrow('Invalid encrypted text');
    expect(() => decrypt(extraPart)).toThrow('Invalid encrypted text');
  });

  it('should reject unknown encrypted version prefixes', () => {
    expect(() => decrypt('v9:abc:def:ghi')).toThrow('Invalid encrypted text');
  });
});
