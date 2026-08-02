// ============================================================================
// FILE: benchmarks/fixture-worker.ts
// Worker thread to generate and stream macro fixtures directly to disk
// ============================================================================

import { parentPort, workerData } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';

interface WorkerTaskPayload {
  workerId: number;
  startIndex: number;
  count: number;
  outputDir: string;
  complexity: string;
  enableMacros: boolean;
}

async function executeWorkerTask() {
  const { workerId, startIndex, count, outputDir, complexity, enableMacros }: WorkerTaskPayload = workerData;
  
  // Ensure the target directory exists
  await fs.mkdir(outputDir, { recursive: true });

  let generatedBytes = 0;

  for (let i = 0; i < count; i++) {
    const fileIndex = startIndex + i;
    const fileName = `Component${fileIndex}.css`;
    const filePath = path.join(outputDir, fileName);

    // Generate heavy macro expansion syntax
    const macroBody = enableMacros ? `
  /* 136+ Macro Engine Shorthand */
  flex: row center between;
  gap: var(--token-space-md);
  bg: gradient(linear, var(--token-primary), var(--token-secondary));
  rounded: var(--token-radius-lg);` : `
  display: flex;
  justify-content: space-between;`;

    const fileContent = `
@component Component${fileIndex} {
  /* @entangle: [Component${Math.max(0, fileIndex - 1)}] */
  color: var(--token-text-main);
  font: var(--token-font-headline);
${macroBody}

  @media (max-width: 768px) {
    padding: var(--token-space-sm);
  }
}
`.trim();

    // Stream directly to disk asynchronously
    await fs.writeFile(filePath, fileContent, 'utf8');
    generatedBytes += Buffer.byteLength(fileContent, 'utf8');
  }

  if (parentPort) {
    parentPort.postMessage({
      success: true,
      workerId,
      filesWritten: count,
      bytesWritten: generatedBytes,
    });
  }
}

executeWorkerTask().catch((error) => {
  if (parentPort) {
    parentPort.postMessage({
      success: false,
      workerId: workerData.workerId,
      error: error.message,
    });
  }
});