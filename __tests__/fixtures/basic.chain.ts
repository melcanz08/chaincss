// __tests__/fixtures/basic.chain.ts
// Basic fixture for compiler tests

import { createChain } from '../../src/compiler/Chain.js';

export const containerStyles = createChain(false)
  .display('flex')
  .flexDirection('column')
  .gap(16)
  .padding(24)
  .$el('container');

export const headingStyles = createChain(false)
  .fontSize(24)
  .fontWeight(700)
  .color('#1e293b')
  .margin(0)
  .$el('heading');

export const buttonStyles = createChain(false)
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

export const cardStyles = createChain(false)
  .background('white')
  .borderRadius(12)
  .padding(24)
  .boxShadow('0 1px 3px rgba(0,0,0,0.1)')
  .hover()
  .boxShadow('0 4px 6px rgba(0,0,0,0.1)')
  .transform('translateY(-2px)')
  .end()
  .$el('card');