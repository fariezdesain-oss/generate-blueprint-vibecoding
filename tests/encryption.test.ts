import { encrypt, decrypt } from '@/lib/utils/encryption';

process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-testing-32ch';

describe('encryption', () => {
  it('should encrypt and decrypt text', () => {
    const original = 'my-secret-api-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext each time', () => {
    const text = 'same-text';
    const e1 = encrypt(text);
    const e2 = encrypt(text);
    expect(e1).not.toBe(e2);
  });
});
