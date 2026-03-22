# Changelog

All notable changes to ChainCSS will be documented in this file.

## [1.11.3] - 2024-03-22

### Added
- `.end()` method to properly handle hover styles
- Atomic CSS optimization with `--atomic` flag
- Class map generation (`.map.json`, `.classes.js`, `.classes.d.ts`)
- Vite plugin with HMR support
- Webpack plugin for build-time compilation
- Next.js plugin for SSR support
- Recipe system (variant API similar to CVA)
- Design tokens system with theme switching
- At-rules support: `@media`, `@keyframes`, `@supports`, `@container`, `@layer`, `@counter-style`, `@property`

### Changed
- Removed `vm2` dependency, now using native Node.js module system
- Improved build performance (up to 2x faster)
- Better error messages with stack traces
- Enhanced TypeScript types for at-rules and hover states

### Fixed
- Hover styles now correctly generate separate `:hover` rules
- `transition` and `cursor` properties no longer incorrectly added to hover styles
- CSS property validation warnings improved

### Deprecated
- None

### Removed
- `vm2` dependency (no longer needed)

## [1.11.2] - 2024-03-20

### Added
- Initial atomic optimizer implementation
- Cache system for faster rebuilds

### Fixed
- CSS property loading from CDN fallback

## [1.11.0] - 2024-03-15

### Added
- Initial release of ChainCSS
- Chainable API with `$()` function
- React hooks: `useChainStyles`, `useDynamicChainStyles`, `useThemeChainStyles`
- Build-time compilation with `.jcss` files
- Design token system
- Autoprefixer integration