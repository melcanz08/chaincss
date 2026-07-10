# Changelog

## v2.11.0 (2026-07-10)

### 🚀 Highlights
- **5 critical bugs fixed** — invalid CSS output, token leaks, ESM crashes, race conditions, and memory leaks resolved
- **Package exports fixed** — `chaincss/vite` and `chaincss/webpack` now resolve correctly
- **Type safety** — `StyleObject`, `IRRuleMeta`, `IRDeclarationMeta`, and pipeline types hardened
- **Performance** — O(n) → O(1) source map generation, accurate byte counting in compressor

### 🐛 Bug Fixes

**Critical (P0)**
- Fixed pseudo-class selector emitting `.chain-btn&:hover` instead of `.chain-btn:hover`
- Fixed `partitionForBuild` leaking dynamic functions into static CSS output
- Fixed atomic preset sharing mutable `atomicUsageMap` across parallel builds
- Fixed token resolver never reaching `var(--*)` fallback — `$token` leaked as invalid CSS
- Fixed `require()` crash in ESM browser builds (runtime/index.ts)

**Compiler**
- Fixed `layout-analyzer` camelCase/kebab-case disconnect — zero patterns matched before
- Fixed `tokenLowering` running after `cssCompressor` — resolved tokens never got minified
- Fixed `atomic-extractor` `globalUsage` map never written — zero extractions in single-file mode
- Fixed `token-resolver` `exec()` with `/g` flag infinite loop on string replacement
- Fixed `css-compressor` `0` word boundary missing negative values (`-0.5rem`)
- Fixed `css-compressor` shorthand collapse corrupting `font-family` with commas
- Fixed `css-printer` `if()` parentheses `.repeat()` closing brackets at wrong position
- Fixed `value-parser` blind `split(/[,\s]+/)` destroying function nesting
- Fixed `parser.ts` `msTransform` → `ms-transform` instead of `-ms-transform`
- Fixed `style-graph.ts` MD5 hashing breaking in FIPS mode
- Fixed `style-graph.ts` media query blind merging across `@media` boundaries
- Fixed `style-graph.ts` `mergedComponents` Map not JSON serializable
- Fixed `cloneIR` using `JSON.parse(JSON.stringify())` stripping prototypes
- Fixed `animations.ts` shorthand missing `fillMode` — overrode longhand property

**Runtime**
- Fixed `ChainCSSGlobal` injecting empty `<style>` tag
- Fixed `useChainStylesApplied` not deduplicating class names
- Fixed `injector.ts` recursive token resolution on arrays/pseudo-classes
- Fixed `react.tsx` HOC typed as `any` instead of `React.FC<P>`

**CLI & Plugins**
- Fixed Vite plugin double-compilation in `generateBundle`
- Fixed Vite plugin manual watcher instead of `handleHotUpdate`
- Fixed Vite plugin hardcoded `/assets/chaincss.css` path
- Fixed `dev.ts` JS bundle never rebuilding on CSS changes
- Fixed `check.ts` private `pipeline` property hack — added `setPipeline()` public API
- Fixed `check.ts` `--fix` flag counting fixes but never writing files

**Type System**
- Added `CSSProperties`, `PseudoStyles`, `PseudoClasses`, `ParsedStyleObject` interfaces
- Added `IRRuleMeta`, `IRDeclarationMeta` replacing `Record<string, unknown>`
- Added `OptimizationContext` index signature for custom passes
- Unified `StyleObject` type across codebase (was duplicated in `style-collector.ts`)
- Fixed `CompileOptions`/`CompileResult` conflicting across modules

### 🏗️ Improvements

**Pipeline**
- `shouldRun` refactored from 15-line if-else to data-driven `PASS_FEATURE_REQUIREMENTS` map
- `tokenLowering` moved to optimization phase — tokens compressed before emission
- `css-emitter` O(n) → O(1) source map generation
- `generateBundle` stitches CSS from memory cache instead of re-scanning filesystem
- `createPipeline('atomic')` creates fresh `atomicUsageMap` per call

**Security**
- Added `sanitizeCSSValue()` escaping `\`, `</`, `
`, `` in CSS output
- Added try/catch error boundaries around `compileToCSS` and `partitionForBuild`
- Token resolver warns on unresolved tokens instead of silently leaking `$token`

**Performance**
- `css-compressor` accurate byte counting via `Buffer.byteLength` (was `changes * 3` estimate)
- New collapse rules: `10px 10px` → `10px`, `0 0 0` → `0`
- `recipe.ts` returns `StyleDefinition` directly instead of rebuilding via `chain()`
- `getAllVariants` result cached — no duplicate generation in `compileAll`

**DX**
- `isValidPreset()` type guard exported from `unified-pipeline.ts`
- Deprecated functions annotated with "Will be removed in v4.0"
- `README.md` updated with docs link, FAQ, framework one-liner, performance methodology
- `basic.chain.ts` fixture includes expected CSS output comments

### ⚠️ Breaking Changes
- `chaincss/plugin/vite` still works but `chaincss/vite` is now the canonical path
- `prepublishOnly` script changed — ensure CI uses `npm run build`

### 📦 Package
- Added `./vite` and `./webpack` exports aliases
- Added `files: ["dist"]` to `package.json`
- Fixed `prepublishOnly` to `npm run build:clean && npm run build:types && node scripts/build.mjs`
- Removed broken `require` conditions for missing CJS artifacts
- `tsconfig.build.json` includes full `src/runtime/**/*` for proper type generation


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
## 2.8.0 (2026-06-26)

### Performance
- Pipeline trimmed to 6 core passes (down from 18): intent-normalizer, unit-normalizer, css-compressor, intent-resolver, token-resolver, css-emitter
- X-Large compilation (2000 rules, 20K declarations): 166ms → 52ms (3.2x faster)
- Cold start: 82ms → 21ms (3.9x faster)
- Bundle size: 221KB → 163KB (26% smaller)
- Memory peak: 95MB → 56MB (41% reduction)
- CSS compression: 10% average savings now measured and reported

### Architecture
- Compiler now uses new Pipeline by default instead of legacy PassManager
- Linters and analyzers preserved as documented opt-in plugins (accessibility, conflict detection, pattern analysis, dead code elimination)
- Legacy AtomicOptimizer stubbed — atomic extraction available via opt-in plugin
- Declaration history tracking gated on NODE_ENV (production memory savings)

### Benchmarking
- Full benchmark suite: cold/warm start, 4 scale scenarios, per-stage timing, CSS bytes saved, incremental potential
- JSON and Markdown output to benchmarks/results/
- Per-pass profiling identifies lowering stage as primary cost center (css-emitter)

### Breaking Changes
- None. All removed passes are available as opt-in imports.
