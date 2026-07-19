const fs = require('fs');

const filesToUpdate = [
  'app/(auth)/update-password/page.tsx',
  'app/(dashboard)/generate/results/page.tsx',
  'components/ui/MarkdownRenderer.tsx',
  'components/ui/ProjectStatePanel.tsx',
  'app/(dashboard)/history/page.tsx',
  'components/ui/MermaidBlock.tsx',
  'components/ui/ProviderSelector.tsx',
  'components/ui/FilePreviewModal.tsx',
  'components/ui/ChatWindow.tsx',
  'components/ui/GeminiLoader.tsx',
  'components/ui/LogoutButton.tsx',
  'components/ui/SidebarHistory.tsx',
  'components/ui/FilePicker.tsx'
];

filesToUpdate.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Ganti class "animate-spin" dengan "animate-wand-swing" di semua komponen Wand2
    content = content.replace(/<Wand2([^>]*?)animate-spin([^>]*?)\/>/g, '<Wand2$1animate-wand-swing$2/>');
    // Jika formatnya pakai double tag (seperti text) kalau-kalau ada
    content = content.replace(/<Wand2([^>]*?)animate-spin([^>]*?)>/g, '<Wand2$1animate-wand-swing$2>');

    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`Updated ${file}`);
    }
  }
});
