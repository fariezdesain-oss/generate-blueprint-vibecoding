import {
  FILE_ORDER,
  buildFilePrompt,
  countGeneratedSpecFiles,
  getNextMissingSpecFile,
  hasAllSpecFiles,
} from '@/lib/utils/sequentialPrompts';

describe('sequentialPrompts', () => {
  it('should use the numbered 7-document output order', () => {
    expect(FILE_ORDER).toEqual([
      '01_PRD.md',
      '02_ARCHITECTURE.md',
      '03_DATA_MODELS.md',
      '04_PROJECT_STANDARDS.md',
      '05_DESIGN_SYSTEM.md',
      '06_DELIVERY.md',
      '07_AGENT_CONTEXT.md',
    ]);
  });

  it('should count only current spec files and ignore legacy files', () => {
    const files = {
      '01_PRD.md': '# 01_PRD.md\n\nContent',
      '02_ARCHITECTURE.md': '# 02_ARCHITECTURE.md\n\nContent',
      'PRD.md': '# legacy',
      'VIBECODING_STEPS.md': '# legacy',
    };

    expect(countGeneratedSpecFiles(files)).toBe(2);
    expect(hasAllSpecFiles(files)).toBe(false);
    expect(getNextMissingSpecFile(files)).toBe('03_DATA_MODELS.md');
  });

  it('should detect when all current spec files exist', () => {
    const files = Object.fromEntries(FILE_ORDER.map((name) => [name, `# ${name}\n\nContent`])) as Record<string, string>;

    expect(countGeneratedSpecFiles(files)).toBe(7);
    expect(hasAllSpecFiles(files)).toBe(true);
    expect(getNextMissingSpecFile(files)).toBe('');
  });

  it('should generate a PRD prompt with strict scope boundaries', () => {
    const prompt = buildFilePrompt(0, [{ role: 'user', content: 'Saya ingin membuat aplikasi booking klinik.' }], {});

    expect(prompt).toContain('01_PRD.md');
    expect(prompt).toContain('HANYA membahas "apa yang dibangun"');
    expect(prompt).toContain('Jangan membahas database, API, struktur folder, desain visual');
  });
});
