// __tests__/fixtures/basic.chain.ts
// Basic fixture for compiler tests
//
// Expected CSS output:
//   .container { display: flex; flex-direction: column; gap: 16px; padding: 24px; }
//   .heading { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0; }
//   .button { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #3b82f6; color: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
//   .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
//   .card:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.1); transform: translateY(-2px); }

import { chain } from '../../src/core/style-collector.js';

export const containerStyles = chain(false)
  .display('flex')
  .flexDirection('column')
  .gap(16)
  .padding(24)
  .$el('container');

export const headingStyles = chain(false)
  .fontSize(24)
  .fontWeight(700)
  .color('#1e293b')
  .margin(0)
  .$el('heading');

export const buttonStyles = chain(false)
  .display('inline-flex')
  .alignItems('center')
  .gap(8)
  .padding('12px 24px')
  .background('#3b82f6')
  .color('white')
  .borderRadius(8)
  .cursor('pointer')
  .transition('all 0.2s ease')
  .$el('button');

export const cardStyles = chain(false)
  .background('white')
  .borderRadius(12)
  .padding(24)
  .boxShadow('0 1px 3px rgba(0,0,0,0.1)')
  .hover()
  .boxShadow('0 4px 6px rgba(0,0,0,0.1)')
  .transform('translateY(-2px)')
  .end()
  .$el('card');