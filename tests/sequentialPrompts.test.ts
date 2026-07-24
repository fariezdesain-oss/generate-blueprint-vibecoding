import {
  FILE_ORDER,
  buildFilePrompt,
  countGeneratedSpecFiles,
  getNextMissingSpecFile,
  hasAllSpecFiles,
  buildConsistencyPrompt,
  buildSingleFileConsistencyPrompt,
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
      '08_TASKS.md',
      '09_AI_RULES.md',
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

    expect(countGeneratedSpecFiles(files)).toBe(9);
    expect(hasAllSpecFiles(files)).toBe(true);
    expect(getNextMissingSpecFile(files)).toBe('');
  });

  it('should generate a PRD prompt with strict scope boundaries', () => {
    const prompt = buildFilePrompt(0, [{ role: 'user', content: 'Saya ingin membuat aplikasi booking klinik.' }], {});

    expect(prompt).toContain('01_PRD.md');
    expect(prompt).toContain('HANYA membahas "apa yang dibangun"');
    expect(prompt).toContain('Jangan membahas database, API, struktur folder, desain visual');
  });

  it('should use Project State instead of raw chat for PRD when available', () => {
    const prompt = buildFilePrompt(
      0,
      [{ role: 'user', content: 'chat lama yang tidak perlu dikirim' }],
      {},
      0,
      'high',
      { nama_proyek: 'Booking Klinik', fitur: ['Reservasi dokter'] },
      'User memilih aplikasi web.',
    );

    expect(prompt).toContain('PROJECT STATE');
    expect(prompt).toContain('Booking Klinik');
    expect(prompt).toContain('ROLLING SUMMARY');
    expect(prompt).not.toContain('CONVERSATION:');
  });

  it('should generate atomic tasks prompt for low-context AI implementation', () => {
    const prompt = buildFilePrompt(7, [{ role: 'user', content: 'Saya ingin membuat aplikasi booking klinik.' }], {
      '01_PRD.md': '# 01_PRD.md\n\nAplikasi booking klinik',
    }, 900, 'low');

    expect(prompt).toContain('08_TASKS.md');
    expect(prompt).toContain('task atomic');
    expect(prompt).toContain('MODE LOW-CONTEXT');
    expect(prompt).toContain('model AI gratis/9router');
  });

  it('should generate AI rules prompt for implementation guardrails', () => {
    const prompt = buildFilePrompt(8, [{ role: 'user', content: 'Saya ingin membuat aplikasi booking klinik.' }], {
      '01_PRD.md': '# 01_PRD.md\n\nAplikasi booking klinik',
    });

    expect(prompt).toContain('09_AI_RULES.md');
    expect(prompt).toContain('never refactor unrelated code');
    expect(prompt).toContain('Ready-to-copy prompt template');
  });
});

  describe('formatOtherFiles', () => {
    it('should format other files properly using extractDocumentSummary when previewLimit > 0', () => {
      const files = {
        '01_PRD.md': 'PRD Content',
        '02_ARCHITECTURE.md': 'Architecture Content\nLine 2\nLine 3',
        '03_DATA_MODELS.md': 'Data Models Content\nLine 2\nLine 3'
      };
      
      const prompt = buildFilePrompt(3, [{ role: 'user', content: 'app' }], files, 15); // limit to 15 chars so summary truncates
      expect(prompt).toContain('--- 02_ARCHITECTURE.md (REFERENSI) ---');
      expect(prompt).toContain('--- 03_DATA_MODELS.md (REFERENSI) ---');
    });
  });

  describe('checkConversation', () => {
    it('should return insufficient context message if no context or goal', () => {
      const prompt = buildFilePrompt(0, [{ role: 'user', content: 'hello' }], {});
      expect(prompt).toBe('INSUFFICIENT_CONTEXT: Maaf, percakapan ini belum memiliki detail proyek yang cukup. Silakan lanjutkan diskusi dan tentukan dulu proyek atau program apa yang ingin Anda bangun.');
    });

    it('should pass checkConversation if it has problem/goal keywords', () => {
      const prompt = buildFilePrompt(0, [{ role: 'user', content: 'saya butuh sistem baru' }], {});
      expect(prompt).not.toContain('INSUFFICIENT_CONTEXT');
    });
  });

  describe('buildConsistencyPrompt', () => {
    it('should return empty string if no PRD', () => {
      const prompt = buildConsistencyPrompt({});
      expect(prompt).toBe('');
    });

    it('should build consistency prompt including PRD and summaries of other files', () => {
      const files = {
        '01_PRD.md': 'This is PRD',
        '02_ARCHITECTURE.md': 'This is Arch',
      };
      const prompt = buildConsistencyPrompt(files);
      expect(prompt).toContain('Periksa KONSISTENSI 9 dokumen');
      expect(prompt).toContain('--- 01_PRD.md (ACUAN UTAMA - LENGKAP) ---');
      expect(prompt).toContain('This is PRD');
      expect(prompt).toContain('--- 02_ARCHITECTURE.md (RINGKASAN) ---');
      expect(prompt).toContain('This is Arch');
    });
  });

  describe('buildSingleFileConsistencyPrompt', () => {
    it('should return empty string if no PRD or checking PRD itself', () => {
      expect(buildSingleFileConsistencyPrompt('02_ARCHITECTURE.md', 'content', {})).toBe('');
      expect(buildSingleFileConsistencyPrompt('01_PRD.md', 'content', { '01_PRD.md': 'PRD' })).toBe('');
    });

    it('should build single file consistency prompt', () => {
      const files = {
        '01_PRD.md': 'This is PRD',
        '03_DATA_MODELS.md': 'This is Data',
      };
      const prompt = buildSingleFileConsistencyPrompt('02_ARCHITECTURE.md', 'Arch content', files);
      expect(prompt).toContain('Tugas Anda adalah melakukan REGENERATE pada file 02_ARCHITECTURE.md');
      expect(prompt).toContain('--- 01_PRD.md (SOURCE OF TRUTH) ---');
      expect(prompt).toContain('This is PRD');
      expect(prompt).toContain('--- 03_DATA_MODELS.md (REFERENSI KONSISTENSI - WAJIB DIIKUTI) ---');
      expect(prompt).toContain('This is Data');
      expect(prompt).toContain('--- 02_ARCHITECTURE.md (FILE YANG HARUS DI-REGENERATE / DIPERIKSA) ---');
      expect(prompt).toContain('Arch content');
    });
  });

  describe('buildFilePrompt for remaining switch cases', () => {
    const messages = [{ role: 'user', content: 'membuat aplikasi' }];
    const files = { '01_PRD.md': 'Very long PRD content ' + 'A'.repeat(8500) };

    it('should generate ARCHITECTURE prompt', () => {
      const prompt = buildFilePrompt(1, messages, files);
      expect(prompt).toContain('02_ARCHITECTURE.md');
      expect(prompt).toContain('HANYA membahas "bagaimana sistem dibangun"');
      expect(prompt).toContain('[CATATAN: PRD di atas sangat lengkap. Fokus pada informasi yang RELEVAN untuk dokumen ini saja.');
    });

    it('should generate DATA_MODELS prompt', () => {
      const prompt = buildFilePrompt(2, messages, files);
      expect(prompt).toContain('03_DATA_MODELS.md');
      expect(prompt).toContain('HANYA membahas semua hal yang berhubungan dengan data');
    });

    it('should generate PROJECT_STANDARDS prompt', () => {
      const prompt = buildFilePrompt(3, messages, files);
      expect(prompt).toContain('04_PROJECT_STANDARDS.md');
      expect(prompt).toContain('menggabungkan standar coding/proyek dan environment schema');
    });

    it('should generate DESIGN_SYSTEM prompt', () => {
      const prompt = buildFilePrompt(4, messages, files);
      expect(prompt).toContain('05_DESIGN_SYSTEM.md');
      expect(prompt).toContain('HANYA membahas visual dan pengalaman antarmuka');
    });

    it('should generate DELIVERY prompt', () => {
      const prompt = buildFilePrompt(5, messages, files);
      expect(prompt).toContain('06_DELIVERY.md');
      expect(prompt).toContain('menggabungkan testing, security, dan delivery/release');
    });

    it('should generate AGENT_CONTEXT prompt', () => {
      const prompt = buildFilePrompt(6, messages, files);
      expect(prompt).toContain('07_AGENT_CONTEXT.md');
      expect(prompt).toContain('dibuat TERAKHIR sebagai root context ringkas untuk AI agent');
    });

    it('should generate fallback prompt for unknown file', () => {
      const prompt = buildFilePrompt(99, messages, files);
      expect(prompt).toContain('Buat dokumen undefined berdasarkan percakapan dan dokumen sebelumnya.');
    });
  });
