// __tests__/fixtures/with-tokens.chain.ts
// Token-based styles fixture

import { createChain, setTokenContext } from '../../src/compiler/Chain.js';

// Set up design tokens
setTokenContext({
  tokens: {
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      background: '#f8fafc',
      text: '#1e293b',
      muted: '#64748b',
      border: '#e2e8f0',
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
    },
    typography: {
      fontFamily: {
        sans: 'Inter, system-ui, sans-serif',
        mono: 'JetBrains Mono, monospace',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
    },
    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 6px rgba(0,0,0,0.1)',
      lg: '0 10px 15px rgba(0,0,0,0.1)',
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      full: '9999px',
    },
  },
  prefix: '$',
});

export const themedContainer = createChain(true)
  .display('flex')
  .flexDirection('column')
  .gap('$spacing.md')
  .padding('$spacing.lg')
  .background('$colors.background')
  .$el('themed-container');

export const themedCard = createChain(true)
  .background('white')
  .borderRadius('$radii.lg')
  .padding('$spacing.lg')
  .boxShadow('$shadows.md')
  .border('1px solid $colors.border')
  .$el('themed-card');

export const themedHeading = createChain(true)
  .fontFamily('$typography.fontFamily.sans')
  .fontSize('$typography.fontSize.2xl')
  .fontWeight(700)
  .color('$colors.text')
  .$el('themed-heading');

export const themedButton = createChain(true)
  .display('inline-flex')
  .alignItems('center')
  .justifyContent('center')
  .padding('$spacing.sm $spacing.md')
  .background('$colors.primary')
  .color('white')
  .fontSize('$typography.fontSize.sm')
  .fontWeight(600)
  .borderRadius('$radii.md')
  .border('none')
  .cursor('pointer')
  .hover()
  .opacity(0.9)
  .end()
  .$el('themed-button');