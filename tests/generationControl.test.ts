import {
  GENERATION_REQUEST_LIMIT,
  isGenerationCancelled,
  shouldContinueGeneration,
} from '@/lib/utils/generationControl';

describe('generationControl', () => {
  it('continues only for an explicitly incomplete synchronous chunk', () => {
    expect(shouldContinueGeneration({ completed: false, nextFile: '02_ARCHITECTURE.md' })).toBe(true);
  });

  it('does not continue after user stops document generation', () => {
    expect(shouldContinueGeneration({ completed: false }, false)).toBe(false);
  });

  it('does not restart an accepted background job', () => {
    expect(shouldContinueGeneration({ jobId: 'session-1', mode: 'docs' })).toBe(false);
    expect(shouldContinueGeneration({ jobId: 'session-1', backgroundPending: true })).toBe(false);
  });

  it('does not continue after completion or malformed responses', () => {
    expect(shouldContinueGeneration({ completed: true })).toBe(false);
    expect(shouldContinueGeneration(null)).toBe(false);
  });

  it('recognizes a cancelled generation status', () => {
    expect(isGenerationCancelled('cancelled')).toBe(true);
    expect(isGenerationCancelled('generating')).toBe(false);
    expect(isGenerationCancelled(null)).toBe(false);
  });

  it('allows all document chunks plus retry headroom', () => {
    expect(GENERATION_REQUEST_LIMIT).toBeGreaterThanOrEqual(9);
  });
});
