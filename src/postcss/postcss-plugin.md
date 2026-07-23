# ChainCSS PostCSS Plugin

One plugin = all bundlers. Uses the real ChainCSS compiler for 100% accuracy.

---

## Supported Bundlers

| Bundler | Status |
|---------|--------|
| Vite | ✅ via postcss.config.js |
| Webpack | ✅ via postcss.config.js |
| Next.js | ✅ via postcss.config.js |
| Turbopack | ✅ (Next.js 13+) |
| Parcel | ✅ |
| Rspack | ✅ |
| Farm | ✅ |
| Any PostCSS-compatible tool | ✅ |

---

## How It Works

1. Scans your configured globs for `.chain.ts` / `.chain.js` files
2. Uses the **real `StyleCollector` + `compileToCSS`** — full API: `.box()`, `.typography()`, `.flex()`, `.hover()`, `.media()`, `.dynamic()`, etc.
3. Generates CSS with proper `var()` placeholders for dynamic properties
4. Replaces `@chaincss;` directive in your CSS with the generated styles

---

## Usage

### 1. CSS File

```css
/* app.css or globals.css */
@chaincss; /* Replaced with all collected ChainCSS styles */

/* Works alongside Tailwind */
@tailwind base;
@chaincss;
@tailwind utilities;
```

### 2. Configuration

```js
// postcss.config.js (CommonJS)
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: [
        './src/**/*.chain.{ts,js,tsx,jsx}',
        './app/**/*.chain.{ts,js,tsx,jsx}'
      ],
      debug: true
    },
    autoprefixer: {}
  }
}
```

```js
// postcss.config.mjs (ESM)
export default {
  plugins: {
    'chaincss/postcss': {
      content: ['./src/**/*.chain.{ts,js,tsx,jsx}']
    }
  }
}
```

### 3. Next.js App Router

```js
// postcss.config.js
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: ['./app/**/*.chain.{ts,js,tsx,jsx}']
    }
  }
}
```

```css
/* app/globals.css */
@chaincss;
```

```tsx
// app/layout.tsx — No extra components needed!
import './globals.css'

export default function Layout({ children }) {
  return <html><body>{children}</body></html>
}
```

### 4. Vite (Alternative to chaincss/vite Plugin)

```js
// postcss.config.js
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: ['./src/**/*.chain.{ts,js,tsx,jsx}']
    }
  }
}
```

---

## Full API Support

The PostCSS plugin uses the real ChainCSS compiler, so all methods work:

```typescript
// All of these compile correctly:
chain()
  .box({ padding: 24, borderRadius: 8 })
  .typography({ fontSize: 16, color: '#fff' })
  .flex({ align: 'center', gap: 8 })
  .hover().background({ color: 'blue' }).end()
  .media('(max-width: 640px)', (c) => c.box({ padding: 12 }))
  .$el('my-component')

chain.dynamic()
  .raw({ backgroundColor: (ctx) => ctx.isDark ? '#333' : '#fff' })
  .$el('theme-toggle')
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `string[]` | `['./src/**/*.chain.{ts,js,tsx,jsx}']` | Glob patterns for chain files |
| `output` | `string` | `null` | Optional file path to write CSS output |
| `debug` | `boolean` | `false` | Enable verbose logging |

---

## Comparison

| Feature | Tailwind | ChainCSS PostCSS |
|---------|----------|------------------|
| PostCSS plugin | `tailwindcss` | `chaincss/postcss` |
| Content scanning | Utility classes in JSX | `.chain.ts` files |
| Works in any bundler | ✅ | ✅ |
| Build-time CSS | ✅ | ✅ |
| Dynamic styles | ❌ | ✅ via `var()` + CSS custom properties |
| Type-safe API | ❌ | ✅ TypeScript `.chain.ts` |
| Zero-runtime (static) | ✅ | ✅ |
| Mixed mode (static + dynamic) | ❌ | ✅ |

---

## License

MIT

**Author:** Rommel Caneos · [Contact](mailto:rec0608m@gmail.com) · [Website](https://www.chaincss.dev)