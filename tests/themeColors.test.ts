import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('warna adaptif tema', () => {
  test('renderer Markdown memakai token warna tema untuk konten', () => {
    const source = readSource('components/ui/MarkdownRenderer.tsx');

    expect(source).toContain('text-lg font-extrabold text-primary');
    expect(source).toContain('marker:text-secondary');
    expect(source).not.toContain('text-lg font-extrabold text-white');
    expect(source).not.toContain('marker:text-white');
  });

  test.each([
    ['components/ui/SidebarHistory.tsx', 'hover:text-white'],
    ['components/ui/SidebarHistory.tsx', '<p className="mb-6 text-sm font-medium text-white">'],
    ['app/(dashboard)/history/page.tsx', '<p className="mb-6 text-sm font-medium text-white">'],
    ['components/ui/ProjectStatePanel.tsx', 'FileJson size={18} className="text-white"'],
    ['components/ui/MobileNav.tsx', 'Plus size={16} className="text-white"'],
    ['components/ui/FilePicker.tsx', 'animate-wand-swing text-white'],
  ])('%s tidak memakai warna putih pada konten tanpa latar kontras', (file, unsafeClass) => {
    expect(readSource(file)).not.toContain(unsafeClass);
  });

  test.each([
    'components/ui/ProviderSelector.tsx',
    'app/(auth)/forgot-password/page.tsx',
    'app/(auth)/update-password/page.tsx',
  ])('%s memakai warna sukses adaptif', (file) => {
    expect(readSource(file)).toContain('text-emerald-600 dark:text-emerald-300');
  });
});
