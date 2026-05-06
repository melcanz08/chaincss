import { createChain } from 'chaincss';

export const styles = {
  card: createChain()
    .background('white')
    .borderRadius(12)
    .padding(24)
    .boxShadow('0 4px 6px rgba(0,0,0,0.1)')
    .border('1px solid #e2e8f0')
    .$el('card'),

  heading: createChain()
    .fontSize(24)
    .fontWeight(700)
    .color('#1e293b')
    .marginBottom(8)
    .$el('card-heading'),

  text: createChain()
    .fontSize(16)
    .color('#64748b')
    .lineHeight(1.5)
    .$el('card-text'),
};