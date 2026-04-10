# Changelog

All notable changes to ChainCSS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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