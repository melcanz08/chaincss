import { ChainCSSCompiler } from '../src/core/compiler.js';

const compiler = new ChainCSSCompiler({
  atomic: { enabled: false },
  output: { minify: false },
  verbose: false,
});

console.log('useNewPipeline:', compiler.useNewPipeline);
console.log('pipelineEnabled:', compiler.pipelineEnabled);

// Test compilation
const result = compiler.compileStyle('test', {
  color: 'red',
  padding: '12px',
  ':hover': { opacity: '0.8' }
});

console.log('CSS:', result.css?.slice(0, 100));
console.log('Diagnostics:', result.diagnostics?.length || 0);
