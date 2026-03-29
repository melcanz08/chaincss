#!/usr/bin/env node

/**
 * ChainCSS Benchmark Comparison
 * Run with: npm run benchmark:compare
 */

console.log('📊 ChainCSS Benchmark Comparison\n');
console.log('This will compare ChainCSS with other CSS-in-JS libraries.\n');
console.log('To run full benchmarks: npm run benchmark');
console.log('Check results at: https://chaincss.dev/benchmarks\n');

// Simple version info
const { version } = require('../../package.json');
console.log(`ChainCSS v${version} is ready for benchmarking!\n`);
console.log('For detailed benchmarks, please visit our documentation site.');