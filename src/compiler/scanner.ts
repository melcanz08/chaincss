// src/compiler/scanner.ts
/**
 * Content Scanner - Extracts ChainCSS calls from source files
 */
import fs from 'fs';
import chalk from 'chalk';

export const scanContent = (text: string): string[] => {
  const regex = /(?:chain|smartChain|\$t?)\(((?:[^()]|\([^()]*\))*)\)(?:\s*\.\s*[a-zA-Z0-9]+\s*\([^)]*\))*/g;
  const matches = text.match(regex) || [];
  return matches.map(m => m.replace(/\s+/g, ''));
};

export function scanFileForStyles(
  filePath: string,
  optimizer: any,
  source: string | null = null
): { foundCount: number; errors: Error[] } {
  const errors: Error[] = [];
  let foundCount = 0;

  try {
    const content = source !== null ? source : fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim().length === 0) return { foundCount: 0, errors };

    const styleRegex = /(?:chain|smartChain|\$)\(((?:[^()]|\([^()]*\))*)\)/g;
    let match;

    while ((match = styleRegex.exec(content)) !== null) {
      try {
        const styleBody = match[1].trim();
        const cleanBody = styleBody.replace(/^['"\`]|['"\`]$/g, '');
        if (cleanBody && optimizer && typeof optimizer.trackStyles === 'function') {
          optimizer.trackStyles([{ selectors: { '&': cleanBody } }]);
          foundCount++;
        }
      } catch (parseError) {
        errors.push(parseError as Error);
      }
    }
  } catch (err) {
    errors.push(err as Error);
  }

  return { foundCount, errors };
}
