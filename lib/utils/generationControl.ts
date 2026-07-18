export const GENERATION_REQUEST_LIMIT = 20;

export function shouldContinueGeneration(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { completed?: unknown }).completed === false;
}
