export const GENERATION_REQUEST_LIMIT = 20;

export function shouldContinueGeneration(data: unknown, active: boolean = true): boolean {
  if (!active || !data || typeof data !== 'object') return false;
  return (data as { completed?: unknown }).completed === false;
}
