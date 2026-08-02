# ChainCSS + Next.js — RSC & SSR Guide

ChainCSS works with Next.js App Router, Pages Router, Server Components, and Client Components.

---

## Architecture

| Environment | Entry Point | What it does |
|-------------|-------------|--------------|
| **Server (RSC)** | `chaincss/next/server` | Compiles styles at request time, collects CSS, injects via `<style>` tag |
| **Client** | `chaincss/next/client` | Injects styles into DOM, hydrates dynamic styles |
| **Build** | `chaincss/next` (plugin) | Pre-compiles `.chain.ts` files during Webpack build |

---

## Setup

### 1. Install

```bash
npm install chaincss
```

### 2. Add plugin to next.config.js

```js
// next.config.js
const withChainCSS = require('chaincss/next')

module.exports = withChainCSS({
  debug: true,
  inputs: [
    './app/**/*.chain.{ts,js,tsx,jsx}',
    './components/**/*.chain.{ts,js,tsx,jsx}'
  ]
})({
  // your existing next config
})
```

### 3. Add server styles to layout

```tsx
// app/layout.tsx
import { ChainCSSServerStyles } from 'chaincss/next/server'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <ChainCSSServerStyles />
      </body>
    </html>
  )
}
```

### 4. Create your styles

```typescript
// app/styles/home.chain.ts
import { chain } from 'chaincss/next/server'

export const heroCard = chain()
  .box({ padding: 24, borderRadius: 12 })
  .background({ color: '#1e293b' })
  .typography({ color: '#e2e8f0', fontSize: 18 })
  .hover()
    .background({ color: '#0f172a' })
    .transform({ custom: 'scale(1.02)' })
  .end()
  .$el()
```

### 5. Use in components

```tsx
// app/page.tsx — Server Component (0 KB JS for styles)
import { heroCard } from './styles/home.chain'

export default function Page() {
  return <div className={heroCard.root}>Hello ChainCSS!</div>
}
```

---

## Server Components (RSC)

Server Components use `chaincss/next/server`. The `ChainCSSServerStyles` component in your layout collects all styles used during the request and injects them as a `<style>` tag in the RSC payload.

```tsx
import { chain } from 'chaincss/next/server'

export default function ServerPage() {
  const styles = chain()
    .box({ padding: 24 })
    .flex({ gap: 16, direction: 'column' })
    .$el()

  return <div className={styles.root}>Rendered on server, zero JS shipped</div>
}
```

---

## Client Components

Client Components use `chaincss/next/client` with `useChainStyles` for dynamic styles.

```tsx
'use client'
import { useState } from 'react'
import { useChainStyles } from 'chaincss/next/client'
import { themeToggle } from '../styles/playground.chain'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  const { classes, styleVars } = useChainStyles(
    { themeToggle },
    { isDark }
  )

  return (
    <button
      className={classes.themeToggle}
      style={styleVars}
      onClick={() => setIsDark(!isDark)}
    >
      Toggle Theme
    </button>
  )
}
```

---

## Dynamic Styles (Mixed Mode)

Static parts compile to CSS at build time. Dynamic parts become CSS custom properties updated at runtime via `useChainStyles`.

```typescript
// styles/button.chain.ts
import { chain } from 'chaincss'

export const dynamicBtn = chain.dynamic()
  .box({ padding: '12px 24px', borderRadius: 8 })
  .raw({ backgroundColor: (ctx) => ctx.variant === 'primary' ? '#6366f1' : '#e0e0e0' })
  .raw({ color: (ctx) => ctx.variant === 'primary' ? '#fff' : '#333' })
  .$el('btn')
```

```tsx
// Client component
'use client'
import { useChainStyles } from 'chaincss/next/client'
import { dynamicBtn } from '../styles/button.chain'

export function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  const { classes, styleVars } = useChainStyles(
    { dynamicBtn },
    { variant }
  )

  return <button className={classes.dynamicBtn} style={styleVars}>Click</button>
}
```

---

## Full Feature Support

All ChainCSS features work in Next.js:

| Feature | Server | Client |
|---------|--------|--------|
| `.box()`, `.typography()`, `.flex()`, `.grid()` | ✅ | ✅ |
| `.hover()`, `.focus()`, `.active()` with `.end()` | ✅ | ✅ |
| `.media()` responsive queries | ✅ | ✅ |
| `.dynamic()` mixed mode | ✅ static parts | ✅ full runtime |
| `useChainStyles()` with context | ❌ (no state in RSC) | ✅ |
| Design tokens + entanglement | ✅ | ✅ |
| Macros (`glass()`, `pressable()`, etc.) | ✅ | ✅ |
| Figma sync | ✅ (build time) | ✅ (build time) |

---

## CSS Output

| Mode | Output |
|------|--------|
| **Development** | Inlined in `<style data-chaincss='server'>` |
| **Production** | Written to `.next/static/css/chaincss.css`, linked via `<link>` |

Dynamic properties use CSS custom properties with `var()` placeholders:

```css
.chain-btn {
  padding: 12px 24px;
  border-radius: 8px;
  background-color: var(--chain-btn-background-color, initial);
  color: var(--chain-btn-color, initial);
}
```

---

## PostCSS Alternative

You can also use the PostCSS plugin instead of the Next.js plugin. Works with any bundler.

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

No `ChainCSSServerStyles` needed — PostCSS injects CSS at build time.

---

## License

MIT

**Author:** Rommel Caneos · [Contact](mailto:rec0608m@gmail.com) · [Website](https://www.chaincss.dev)