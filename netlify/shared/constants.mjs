// Shared constants between Netlify function and TS codebase.
// ponytail: TS has typed copies in sequentialPrompts.ts — keep in sync.

export const FILE_ORDER = [
  '01_PRD.md',
  '02_ARCHITECTURE.md',
  '03_DATA_MODELS.md',
  '04_PROJECT_STANDARDS.md',
  '05_DESIGN_SYSTEM.md',
  '06_DELIVERY.md',
  '07_AGENT_CONTEXT.md',
  '08_TASKS.md',
  '09_AI_RULES.md',
];

export const FILE_LABELS = {
  '01_PRD.md': 'Product Requirements Document',
  '02_ARCHITECTURE.md': 'System Architecture',
  '03_DATA_MODELS.md': 'Data Models & Database Schema',
  '04_PROJECT_STANDARDS.md': 'Project Standards',
  '05_DESIGN_SYSTEM.md': 'Design System',
  '06_DELIVERY.md': 'Testing, Security & Delivery',
  '07_AGENT_CONTEXT.md': 'Root AI Context File',
  '08_TASKS.md': 'Atomic Vibecoding Tasks',
  '09_AI_RULES.md': 'AI Implementation Rules',
};

export const PLACEHOLDER_PATTERNS = [
  /TODO/i, /TBD/i, /placeholder/i,
  /sesuaikan\s+dengan\s+kebutuhan/i,
  /ganti\s+dengan/i, /ubah\s+sesuai/i,
  /isi\s+dengan/i, /contoh:\s*\w+/i,
  /misalnya:?\s*\w+/i,
];

export function hasPlaceholder(text) {
  return PLACEHOLDER_PATTERNS.some(p => p.test(text));
}
