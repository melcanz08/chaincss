import React, { useState } from 'react';
import { chain } from 'chaincss';

function useCardStyles(isActive: boolean) {
  return chain()
    .bg('#1e293b')
    .padding(24)
    .rounded(12)
    .color(() => isActive ? '#22c55e' : '#94a3b8')
    .border(() => isActive
      ? '2px solid #22c55e'
      : '1px solid rgba(255,255,255,0.1)')
    .fs(16)
    .fw(500)
    .cursor('pointer')
    .transition('all 0.3s ease')
    .$el('dynamic-card');
}

export function DynamicDemo() {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <div style={{ padding: '60px 24px', background: '#0f172a' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
        Dynamic Auto-Detection
      </h2>
      <p style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}>
        <strong>bg, padding, rounded, fs, fw</strong> are static.
        <br />
        <strong>color, border</strong> are dynamic functions.
        <br />
        <em>ChainCSS auto-detects which is which. No manual mode switching.</em>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 700, margin: '0 auto' }}>
        {['React', 'Vue', 'Svelte', 'Solid'].map((name, i) => {
          const isActive = activeCard === i;
          const styles = useCardStyles(isActive);
          const resolved: Record<string, any> = {};
          for (const [k, v] of Object.entries(styles)) {
            if (k === 'selectors' || k.startsWith('_')) continue;
            resolved[k] = typeof v === 'function' ? v() : v;
          }
          return (
            <div
              key={name}
              style={resolved}
              onClick={() => setActiveCard(isActive ? null : i)}
            >
              {isActive ? '[X]' : '[ ]'} {name}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
        Click a card. color() and border() react to state.
        <br />
        bg(), padding(), rounded() are static and never change.
      </p>
    </div>
  );
}
