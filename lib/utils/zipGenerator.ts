import JSZip from 'jszip';

export async function generateZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();

  for (const [fileName, content] of Object.entries(files)) {
    zip.file(fileName, content);
  }

  return await zip.generateAsync({ type: 'blob' });
}
