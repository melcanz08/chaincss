# ChainCSS Comprehensive Code Review — v2.10.8 → v2.11.0

**Reviewer:** External architecture review  
**Date:** 2026-07-10  
**Scope:** 35+ core files, build system, pipeline, runtime, packaging  
**Result:** 5 P0 blockers fixed, ready to publish 2.11.0

---

## 1. Executive Summary

ChainCSS is a real compiler, not a runtime library. The 5-stage pipeline with IR, history tracking, and preset system differentiates it from Styled Components, Vanilla Extract, and Tailwind.

All P0 blockers are resolved. 552 tests pass. Zero build errors.

---

## 2. Architecture

```
chain() → StyleCollector → PropertyStore + RuleBuilder
  → StyleObject → parseStyleObject → ParsedStyleObject
  → Pipeline (normalize → validate → analyze → optimize → lower)
  → StyleIR (IRRule, IRDeclaration, IRAtRule, IRPseudoClass)
  → cssEmitter → CSS string
```

---

## 3. P0 Blockers — All Fixed

| # | Bug | Fix |
|---|-----|-----|
| P0-1 | Pseudo class `.chain-btn&:hover` invalid CSS | `resolveNestedSelector(parentSelector, pseudoClass)` |
| P0-2 | `partitionForBuild` leaks dynamics into static CSS | Returns `staticObject` from nested recursion |
| P0-3 | Shared mutable `atomicUsageMap` across pipeline instances | Fresh `Map` per `createPipeline()` call |
| P0-4 | Token fallback unreachable — `$token` leaked to CSS | `hadUnresolved` tracking + `var(--*)` fallback |
| P0-5 | `require()` crash in ESM browser builds | Static `import` at top level |

---

## 4. P1 High Priority — All Fixed

| # | Issue | Fix |
|---|-------|-----|
| 6 | Package exports missing `./vite`, `./webpack` | Added aliases, kept `./plugin/*` for backwards compat |
| 7 | `prepublishOnly` pointed to broken script | Fixed to full build pipeline |
| 8 | Missing `files: ["dist"]` | Added to `package.json` |
| 9 | `pseudoStore` created without tokens | Forwards `this.options?.tokens` |
| 10 | `createStyleProxyForChild` loses config | Accepts `{ debug, classPrefix, tokens }` |
| 11 | `property-store.ts` dead imports | Removed `resolveToken`, `TokenResolver` |
| 12 | `tsconfig.build.json` missing runtime types | Expanded `include`, added `skipLibCheck` |
| 13 | `browser.ts` VERSION from `index.js` | Changed to `./core/constants.js` |
| 14 | `css-compressor.ts` estimate bytes | Accurate `Buffer.byteLength` diff, new collapse rules |
| 15 | `atomic-extractor.ts` dead scope keys | Derives scope from rule structure |
| 16 | `style-collector.ts` dead `hoverStore` | Removed |
| 17 | `style-graph.ts` MD5 in FIPS mode | SHA256 |
| 18 | `layout-analyzer.ts` camelCase/kebab-case | Quoted kebab-case keys |
| 19 | `css-printer.ts` `if()` bracket `.repeat()` | Per-entry closing |
| 20 | `value-parser.ts` blind split | Depth-aware function-safe split |
| 21 | `token-resolver.ts` greedy regex | Tightened to `[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*` |
| 22 | `parser.ts` `msTransform` → `-ms-transform` | Vendor prefix regex fix |
| 23 | `vite.ts` double compilation, HMR, hardcoded path | Memory cache, `handleHotUpdate`, dynamic base |
| 24 | `check.ts` private property hack | `setPipeline()` public method |
| 25 | `compiler.ts` named+default exports | Both collected |
| 26 | `compiler.ts` `dynamic` dropped in `styleDefToObject` | Preserved |
| 27 | `style-graph.ts` media query blind merge | Composite hash key |
| 28 | `style-graph.ts` `mergedComponents` Map → Record | JSON serializable |
| 29 | `cloneIR` `JSON.parse(JSON.stringify())` | Structural deep clone |
| 30 | `react.tsx` `ChainCSSGlobal` empty injection | Actual CSS output |
| 31 | `recipe.ts` unnecessary `chain()` rebuild | Direct `StyleDefinition` return |
| 32 | `animations.ts` shorthand missing `fillMode` | Added to shorthand |

---

## 5. Remaining (Non-Blocking)

| Priority | Item |
|----------|------|
| P2 | `StyleDefinition` `[key: string]: any` — use `csstype` union |
| P2 | `constants.ts` 400-line god file — split into modules |
| P2 | `chalk@5` ESM-only — safe for CLI, risky if CJS imports |
| P2 | History truncation for large codebases (>20 per node in prod) |
| v2.12 | Delete `src/style-ir.ts` legacy IR, remove `src/compiler/legacy/*` |
| v3.0 | Strict `StyleObject` type, `intent.heal()` in proxy trap |

---

## 6. Final Status

| Metric | Value |
|--------|-------|
| Files reviewed | 35+ |
| Issues fixed | 90+ |
| P0 blockers resolved | 5/5 |
| P1 issues resolved | 27/27 |
| Tests passing | 552/552 |
| Build errors | 0 |
| Ready to publish | ✅ v2.11.0 |

---

## 7. Publish Checklist

- [x] All P0 patches applied
- [x] `npm run build` succeeds
- [x] `dist/` contains `browser.js`, `plugins/vite.js`, `runtime/react.d.ts`
- [x] `npm pack --dry-run` shows only `dist/` files
- [x] `./vite` and `./webpack` exports resolve
- [x] `prepublishOnly` runs full build
- [x] `files: ["dist"]` in `package.json`
- [x] 552 tests passing
- [ ] Bump version to 2.11.0
- [ ] Update CHANGELOG
- [ ] `git tag v2.11.0 && git push --tags`
- [ ] `npm publish`