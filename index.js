const { $, run, compile, chain, tokens, createTokens } = require('./transpiler');
const { processor, watch } = require('./chaincss');

// Conditionally export React hooks if in React environment
let reactHooks = {};
try {
  // Check if React is available
  require.resolve('react');
  reactHooks = require('./react-hooks');
} catch {

}

module.exports = {
  $,
  run,
  compile,
  processor,
  watch,
  chain,
  tokens,
  createTokens,
  ...reactHooks
};