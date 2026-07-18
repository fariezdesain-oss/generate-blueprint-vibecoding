import { extractDocumentSummary } from '@/lib/utils/docSummary';

describe('docSummary', () => {
  it('extracts headings and limits output size', () => {
    const content = `
# Title
Paragraph 1
Line 2
Line 3
Line 4
Line 5

## Subtitle
Para 2
Line 2
Line 3
Line 4

` + 'a'.repeat(2000) + '\nEND OF DOC';

    const summary = extractDocumentSummary(content, 200);
    expect(summary.length).toBeLessThanOrEqual(250); // slight buffer for markers
    expect(summary).toContain('# Title');
    expect(summary).toContain('## Subtitle');
    expect(summary).toContain('END OF DOC');
  });

  it('returns full content if short', () => {
    expect(extractDocumentSummary('Short text', 100)).toBe('Short text');
  });
});
