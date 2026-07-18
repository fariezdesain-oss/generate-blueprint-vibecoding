export function extractDocumentSummary(content: string, maxChars: number): string {
  if (!content) return '';
  if (content.length <= maxChars) return content;

  const lines = content.split('\n');
  const extractedLines: string[] = [];
  let currentLength = 0;
  let inCodeBlock = false;
  let paragraphLinesAdded = 0;

  for (const line of lines) {
    if (line.startsWith('\`\`\`')) inCodeBlock = !inCodeBlock;

    const isHeading = line.startsWith('#');
    const isEmpty = line.trim() === '';

    if (isHeading) {
      paragraphLinesAdded = 0; // reset for new section
      extractedLines.push(line);
      currentLength += line.length + 1;
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
