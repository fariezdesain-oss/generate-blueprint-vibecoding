export function extractDocumentSummary(content: string, maxChars: number): string {
  if (!content) return '';
  if (content.length <= maxChars) return content;

  const lines = content.split('\n');
  const extractedLines: string[] = [];
  let currentLength = 0;
  let inCodeBlock = false;
  let isMermaid = false;
  let paragraphLinesAdded = 0;

  for (const line of lines) {
    if (line.startsWith('\`\`\`')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock && line.toLowerCase().includes('mermaid')) {
        isMermaid = true;
      } else if (!inCodeBlock) {
        isMermaid = false;
      }
    }

    const isHeading = line.startsWith('#');
    const isEmpty = line.trim() === '';
    const isTable = line.trim().startsWith('|');

    if (isHeading) {
      paragraphLinesAdded = 0; // reset for new section
      extractedLines.push(line);
      currentLength += line.length + 1;
    } else if (isTable) {
      // Selalu masukkan baris tabel tanpa batas paragraphLinesAdded
      extractedLines.push(line);
      currentLength += line.length + 1;
    } else if (inCodeBlock && isMermaid) {
      // Selalu masukkan diagram mermaid
      extractedLines.push(line);
      currentLength += line.length + 1;
    } else if (line.startsWith('\`\`\`')) {
       // Selalu masukkan tanda buka/tutup kode jika dia mermaid
       if (isMermaid || !inCodeBlock) {
          extractedLines.push(line);
          currentLength += line.length + 1;
       }
    } else if (!isEmpty && !inCodeBlock && paragraphLinesAdded < 3) {
      extractedLines.push(line);
      currentLength += line.length + 1;
      paragraphLinesAdded++;
    }

    if (currentLength >= maxChars * 0.8) break; // Leave 20% room for end
  }

  // Add the last ~20% chars from the end of document
  const remainingTarget = maxChars - currentLength;
  if (remainingTarget > 100) {
    const tail = content.slice(-remainingTarget);
    return extractedLines.join('\n') + '\n\n... [potongan] ...\n\n' + tail;
  }

  return extractedLines.join('\n') + '\n\n... [dokumen dipotong untuk menghemat konteks]';
}
