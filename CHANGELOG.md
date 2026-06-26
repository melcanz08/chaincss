# Changelog

## [2.7.0] - 2026-06-26

### Architecture — 5-Stage Compiler Pipeline

The entire compiler has been reorganized into a proper multi-stage pipeline:

Source → IR → Normalize → Validate → Analyze → Optimize → Lower → Emit CSS
text


- **`pipeline/`** directory with 5 distinct stages: normalizers, validators, analyzers, optimizers, lowering
- **`pipeline/ir/`** extracted as standalone subsystem: types, factory, parser, printer, utils
- **Conditional execution**: passes are skipped when IR has no relevant features (e.g., no constraints → skip constraint resolver)
- **`CompilerPass` interface**: unified interface for all pass types with phase discrimination
- Legacy `PassManager` deprecated — coexists with new `Pipeline` during migration

### Reorganization

- **`legacy/`**: 9 deprecated files moved (accessibility-engine, constraint-solver, intent-api, layout-intelligence, pattern-learner, responsive-inference, semantic-tokens, source-optimizer, atomic-optimizer)
- **`cache/`**: cache-manager, content-addressable-cache
- **`tokens/`**: tokens, theme-contract, token-resolver, design-orchestrator
- **`utils/`**: helpers, suggestions, shorthands
- **`features/`**: framework-codegen (was component-generator)

### Renames

- `generators/` → `lowering/` (aligns with compiler terminology)
- `css-generator.ts` → `css-emitter.ts`
- `ir/generator.ts` → `ir/css-printer.ts`
- `intent-engine.ts` → `intent-detector.ts` (normalizers)
- `token-resolver.ts` → `token-lowering.ts` (avoids name collision with tokens/token-resolver.ts)

### Vite Plugin

- New `useNewPipeline` option to switch between legacy PassManager and 5-stage Pipeline

### Internals

- 681 passing tests (41 new pipeline-specific tests)
- Full backward compatibility maintained

All notable changes to ChainCSS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.7] - 2026-04-24

### Added
- **Multi-framework runtime adapters**: First-class support for React, Vue 3, and Svelte 4/5
    - `chaincss/react`: `useChainStyles`, `createStyled`, `ChainProvider`
    - `chaincss/vue`: `useAtomicClasses`, `createStyledComponent`, `provideStyleContext` 
    - `chaincss/svelte`: `useAtomicClasses`, `createStyledComponent`, stores + actions
- **Unified runtime API**: Identical `compileRuntime()` behavior across all frameworks
- **HMR support**: Vite HMR integration for all runtimes. Styles hot-reload without full page refresh
- **Subpath exports**: Granular imports to keep bundle size minimal
- **TypeScript types**: Full `.d.ts` coverage for all framework adapters

### Changed
- Runtimes are now optional. Core `chaincss` has zero framework dependencies
- `peerDependencies` updated: `react`, `react-dom`, `vue`, `svelte` are all optional
- Build system split: `tsconfig.build.json` for core, `tsconfig.runtimes.json` for frameworks

### Fixed
- `import.meta.hot` TypeScript errors in runtimes. Added `vite/client` types
- Svelte adapter: Removed non-existent `getCurrentInstance`. Uses `import.meta.url` for moduleId
- Type narrowing issues when passing static objects vs stores to `useAtomicClasses`

### Developer Experience
- `npm run build` now produces 7 entry points: core, compiler, runtime, react, vue, svelte, plugins
- Framework builds gracefully skip if the framework isn't installed
- `sideEffects: false` + proper `exports` map = perfect tree-shaking

### Breaking Changes
None. 2.0.6 -> 2.0.7 is fully backward compatible. Existing `chaincss/runtime` imports still work.

## [2.0.0] - 2026-04-10

### 🎉 Major Release: Zero-Runtime Architecture

ChainCSS 2.0 is a complete rewrite focused on **zero-runtime CSS-in-JS** with optional runtime for development.

### ✨ Added

- **Zero-runtime mode**: Styles compile to static CSS at build time (0KB in production)
- **Shorthand properties**: `$.bg()`, `$.c()`, `$.p()`, `$.m()`, `$.rounded()`, etc. (write less, do more)
- **Responsive breakpoint methods**: `.mobile()`, `.tablet()`, `.desktop()`, `.sm()`, `.md()`, `.lg()`, `.xl()`
- **Animation presets**: `.fadeIn()`, `.slideInUp()`, `.pulse()`, `.spin()`, `.bounce()`, `.shake()`, etc.
- **Math/Calc helpers**: `$.calc()`, `$.add()`, `$.subtract()`, `$.multiply()`, `$.divide()`
- **Debug mode**: `.debug()` with console output showing source file and line number
- **Style versioning**: Source comments in CSS (`/* Generated from: nav.chain.js:15 */`)
- **Timeline/Diff viewer**: Track style changes with `chaincss build --timeline` and `chaincss timeline diff`
- **Configurable breakpoints**: Custom breakpoints in `chaincss.config.js`
- **Environment-aware defaults**: `readable` class names in development, `hash` in production
- **Atomic CSS optimization**: Automatic detection and reuse of common styles (opt-in)
- **CLI tool**: `chaincss init`, `chaincss build`, `chaincss watch`, `chaincss clean`
- **Vite plugin**: Seamless integration with Vite
- **Webpack plugin**: Webpack loader for .chain.js files
- **TypeScript support**: Full type definitions with generated types
- **Recipe system**: Variant-based component styling
- **Design tokens**: Built-in token system with theme contracts
- **Optional runtime**: 3.2KB runtime for development and dynamic theming
- **React hooks**: `useChainStyles`, `useDynamicChainStyles`, `useThemeChainStyles`, `createStyledComponent`
- **Vue composables**: `useAtomicClasses`, `createStyledComponent`
- **Improved file structure**: Each component has its own `styles/` folder with `.chain.js`, `.class.js`, and `.css` files
- **Global styles separation**: `global-style/` folder for global CSS
- **Better minification**: `global.css` minified for production, component CSS unminified for debugging

### 🔧 Changed

- Complete rewrite from runtime-only to hybrid architecture
- New package structure with ESM support
- Better tree-shaking for smaller bundles
- Improved CSS property validation
- Class name generation now uses `readable` format by default in development

### 🗑️ Removed

- `@melcanz85/chaincss` legacy package reference (now unified under `chaincss`)

### 📚 Documentation

- New documentation site with interactive playground
- Migration guide from v1.x
- API reference with examples
- CLI reference with all commands
- Configuration guide with all options

---

## [1.13.3] - 2026-03-30

### Fixed
- Bug fixes and performance improvements

### Changed
- Updated dependencies

---

## [1.0.0] - 2023-01-01

### 🎉 Initial Release

- Chainable CSS API
- Runtime style injection
- React hooks
- Vue composables
- Token system
- Recipe variants