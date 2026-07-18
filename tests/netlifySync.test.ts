import { execFileSync } from 'child_process';

import { hasPlaceholder } from '@/lib/utils/docQuality';
import { FILE_LABELS, FILE_ORDER } from '@/lib/utils/sequentialPrompts';

describe('netlify shared sync', () => {
  function readNetlifyConstants(samples: string[] = []) {
    const script = `
      const constants = await import('./netlify/shared/constants.mjs');
      const samples = ${JSON.stringify(samples)};
      console.log(JSON.stringify({
        FILE_ORDER: constants.FILE_ORDER,
        FILE_LABELS: constants.FILE_LABELS,
        placeholderResults: samples.map((sample) => constants.hasPlaceholder(sample)),
      }));
    `;

    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
  }

  it('keeps FILE_ORDER and FILE_LABELS in sync with TS source', () => {
    const netlifyConstants = readNetlifyConstants();

    expect(netlifyConstants.FILE_ORDER).toEqual(FILE_ORDER);
    expect(netlifyConstants.FILE_LABELS).toEqual(FILE_LABELS);
  });

  it('keeps placeholder detection behavior in sync with TS source', () => {
    const samples = [
      'TODO',
      'TBD',
      'placeholder',
      'sesuaikan dengan kebutuhan',
      'ganti dengan nama aplikasi',
      'ubah sesuai role pengguna',
      'isi dengan endpoint produksi',
      'contoh: user',
      'misalnya: admin',
      'Dokumen final berisi requirement spesifik tanpa token generik.',
    ];
    const netlifyConstants = readNetlifyConstants(samples);

    expect(netlifyConstants.placeholderResults).toEqual(samples.map((sample) => hasPlaceholder(sample)));
  });
});
