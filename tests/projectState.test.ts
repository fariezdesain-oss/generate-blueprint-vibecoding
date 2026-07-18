import {
  buildProjectStatePrompt,
  buildProjectContext,
  isProjectStateUseful,
  mergeProjectState,
  shouldBuildRollingSummary,
} from '@/lib/utils/projectState';

describe('projectState', () => {
  it('mergeProjectState menggabungkan objek tanpa menghapus nilai lama', () => {
    const current = {
      nama_proyek: 'Kasir UMKM',
      fitur: ['Login'],
      tech_stack: { frontend: 'Next.js' },
    };

    expect(mergeProjectState(current, {
      fitur: ['Checkout'],
      tech_stack: { database: 'PostgreSQL' },
    })).toEqual({
      nama_proyek: 'Kasir UMKM',
      fitur: ['Login', 'Checkout'],
      tech_stack: { frontend: 'Next.js', database: 'PostgreSQL' },
    });
  });

  it('isProjectStateUseful hanya true jika ada informasi substansial', () => {
    expect(isProjectStateUseful({})).toBe(false);
    expect(isProjectStateUseful({ nama_proyek: '' })).toBe(false);
    expect(isProjectStateUseful({ nama_proyek: 'ERP Internal' })).toBe(true);
    expect(isProjectStateUseful({ fitur: ['Login'] })).toBe(true);
  });

  it('buildProjectContext memformat state dan summary untuk prompt', () => {
    const context = buildProjectContext({ nama_proyek: 'CRM', fitur: ['Pipeline'] }, 'User memilih web app.');

    expect(context).toContain('PROJECT STATE');
    expect(context).toContain('CRM');
    expect(context).toContain('ROLLING SUMMARY');
    expect(context).toContain('User memilih web app.');
  });

  it('buildProjectStatePrompt meminta JSON diff Bahasa Indonesia', () => {
    const prompt = buildProjectStatePrompt({ fitur: ['Login'] }, [{ role: 'user', content: 'User ingin checkout dan payment gateway.' }]);

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('Bahasa Indonesia');
    expect(prompt).toContain('Jangan hapus informasi lama');
    expect(prompt).toContain('checkout');
  });

  it('shouldBuildRollingSummary aktif setiap 20 pesan', () => {
    expect(shouldBuildRollingSummary(19)).toBe(false);
    expect(shouldBuildRollingSummary(20)).toBe(true);
    expect(shouldBuildRollingSummary(40)).toBe(true);
  });
});
