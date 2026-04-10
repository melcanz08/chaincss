// chaincss/src/runtime/hmr.ts

import { styleInjector } from './injector.js';

interface HMRPayload {
  file: string;
  classes: Record<string, string>;
}

export function setupHMR() {
  if (typeof window === 'undefined') return;
  
  if (import.meta.hot) {
    import.meta.hot.on('chaincss:update', (payload: HMRPayload) => {
      console.log(`[HMR] Updating styles for ${payload.file}`);
      // Trigger style update
      // This would re-fetch and re-inject styles
    });
  }
}

export function registerForHMR(moduleId: string, styles: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      // Update styles when module updates
      console.log(`[HMR] Accepting update for ${moduleId}`);
    });
  }
}