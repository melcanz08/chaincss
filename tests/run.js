#!/usr/bin/env node

/**
 * ChainCSS Test Suite
 * Run with: npm test
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running ChainCSS Tests...\n');

// Test 1: Check if library loads
console.log('Test 1: Library imports');
try {
  const { $, recipe } = require('../node/btt.js');
  assert.ok(typeof $ === 'function', '$ should be a function');
  assert.ok(typeof recipe === 'function', 'recipe should be a function');
  console.log('   ✓ $ function loaded');
  console.log('   ✓ recipe function loaded');
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}

// Test 2: Basic $() functionality
console.log('\nTest 2: Basic $() chain');
try {
  const { $ } = require('../node/btt.js');
  const style = $()
    .color('red')
    .backgroundColor('blue')
    .block('.test');
  
  assert.ok(style.color === 'red', 'color should be red');
  assert.ok(style.backgroundColor === 'blue', 'backgroundColor should be blue');
  assert.ok(style.selectors.includes('.test'), 'selector should be .test');
  console.log('   ✓ Chainable API works');
} catch (err) {
  console.error('   Failed:', err.message);
  process.exit(1);
}

// Test 3: Hover with .end()
console.log('\n Test 3: Hover with .end()');
try {
  const { $ } = require('../node/btt.js');
  const style = $()
    .color('red')
    .hover()
      .color('blue')
      .end()
    .block();
  
  assert.ok(style.color === 'red', 'regular color should be red');
  assert.ok(style.hover.color === 'blue', 'hover color should be blue');
  console.log('   ✓ Hover styles separated correctly');
} catch (err) {
  console.error('    Failed:', err.message);
  process.exit(1);
}

// Test 4: Recipe system
console.log('\n Test 4: Recipe system');
try {
  const { $, recipe } = require('../node/btt.js');
  
  const button = recipe({
    base: $().padding('8px').block(),
    variants: {
      color: {
        primary: $().backgroundColor('blue').block(),
        danger: $().backgroundColor('red').block()
      }
    },
    defaultVariants: { color: 'primary' }
  });
  
  const primaryStyle = button({ color: 'primary' });
  const dangerStyle = button({ color: 'danger' });
  
  assert.ok(primaryStyle, 'primary style should exist');
  assert.ok(dangerStyle, 'danger style should exist');
  console.log('   ✓ Recipe system works');
} catch (err) {
  console.error('    Failed:', err.message);
  process.exit(1);
}

// Test 5: At-rules
console.log('\n Test 5: At-rules support');
try {
  const { $ } = require('../node/btt.js');
  
  const style = $()
    .media('(max-width: 768px)', (css) => {
      css
        .$('.container')
        .padding('10px')
        .block();
    })
    .block();
  
  assert.ok(style.atRules, 'atRules should exist');
  assert.ok(style.atRules[0].type === 'media', 'should have media rule');
  console.log('   ✓ At-rules work');
} catch (err) {
  console.error('    Failed:', err.message);
  process.exit(1);
}

// Test 6: CLI exists
console.log('\n Test 6: CLI tool');
try {
  const cliPath = path.join(__dirname, '../node/chaincss.js');
  assert.ok(fs.existsSync(cliPath), 'CLI file should exist');
  console.log('   ✓ CLI tool available');
} catch (err) {
  console.error('    Failed:', err.message);
  process.exit(1);
}

console.log('\n All tests passed!\n');
EOF