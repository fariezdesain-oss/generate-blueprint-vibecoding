export const PLACEHOLDER_PATTERNS = [
  /TODO/i,
  /TBD/i,
  /placeholder/i,
  /sesuaikan\s+dengan\s+kebutuhan/i,
  /ganti\s+dengan/i,
  /ubah\s+sesuai/i,
  /isi\s+dengan/i,
  /contoh:\s*\w+/i,
  /misalnya:?\s*\w+/i,
];

export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}
