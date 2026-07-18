import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const VERSION = 'v3';
const PREVIOUS_VERSION = 'v2';

function getKey(salt: Buffer | string): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  return crypto.scryptSync(secret, salt, 32);
}

export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return [VERSION, salt.toString('hex'), iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');

  if (parts[0] === VERSION) {
    const [, saltHex, ivHex, authTagHex, encrypted] = parts;
    if (parts.length !== 5 || !saltHex || !ivHex || !authTagHex || !encrypted) throw new Error('Invalid encrypted text');

    const key = getKey(Buffer.from(saltHex, 'hex'));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const key = getKey('salt');

  if (parts[0] === PREVIOUS_VERSION) {
    const [, ivHex, authTagHex, encrypted] = parts;
    if (parts.length !== 4 || !ivHex || !authTagHex || !encrypted) throw new Error('Invalid encrypted text');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (/^v\d+$/.test(parts[0])) throw new Error('Invalid encrypted text');

  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
