import { chain } from './dist/index.js';

const result = chain()
  .bg('red')
  .color(() => 'blue')
  .padding(16)
  .center()
  .$el('test');

console.log('bg:', result.backgroundColor);
console.log('color type:', typeof result.color);
console.log('padding:', result.padding);
console.log('has display:', !!result.display);
console.log('display value:', result.display);
