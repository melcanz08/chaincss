# ChainCSS — Framework Integration Notes

Technical notes for integrating ChainCSS across frameworks and build tools.

---

## 1. CSS Custom Properties Naming Convention

Dynamic styles use CSS custom properties with this naming pattern:

```css
/* Correct: class-name + kebab-prop */
--chain-theme-toggle-background-color
--chain-counter-badge-background-color

/* Wrong: generic prefix + camelCase */
--chain-dynamic-backgroundColor
--chain-dynamic-color
```

All frameworks and build plugins generate the same naming convention.
The pattern is: `--${className}-${kebab-prop}`

---

## 2. Vue: `:style` Binding Limitation

Vue's `:style` object binding strips CSS custom property keys
(properties starting with `--`). Object syntax does not apply them.

**Workaround**: Use template ref + `el.style.setProperty()`:

```vue
<script setup>
import { ref, watch, onMounted } from 'vue'
import { themeToggle } from './theme.chain'

const isDark = ref(true)
const btnRef = ref(null)

const applyStyle = () => {
  const ctx = { isDark: isDark.value }
  const className = themeToggle.className
  for (const [prop, fn] of Object.entries(themeToggle.dynamic)) {
    const value = fn(ctx)
    const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
    btnRef.value.style.setProperty(`--${className}-${kebab}`, String(value))
  }
}

onMounted(() => applyStyle())
watch(isDark, () => applyStyle())
</script>

<template>
  <button ref="btnRef" :class="themeToggle.className" @click="isDark = !isDark">
    {{ isDark ? '🌙 Dark' : '☀️ Light' }}
  </button>
</template>
```

---

## 3. SvelteKit: CSS Loading

SvelteKit does not pick up CSS from the Vite plugin's `transformIndexHtml` hook.
The generated `.css` file exists on disk but is not injected into the page.

**Workaround**: Import the `.css` file directly in the component:

```svelte
<script lang="ts">
  import './theme.css'  // Explicitly import generated CSS
  import { themeToggle } from './theme.chain'
  // ...
</script>
```

---

## 4. TypeScript: Type `ctx` Explicitly

Dynamic functions receive `ctx` as a parameter. TypeScript cannot infer its type.
Always type it explicitly:

```typescript
// ✅ Good — typed context
chain.dynamic()
  .raw({ backgroundColor: (ctx: { isDark: boolean }) => ctx.isDark ? '#333' : '#fff' })
  .$el('btn')

// ❌ Avoid — loses type safety
chain.dynamic()
  .raw({ backgroundColor: (ctx: any) => ctx.isDark ? '#333' : '#fff' })
  .$el('btn')
```

For styles with multiple dynamic properties, define an interface:

```typescript
interface ThemeContext {
  isDark: boolean
  count?: number
  variant?: 'primary' | 'secondary'
}
```

---

## 5. Turbopack + PostCSS Configuration

Use `postcss.config.cjs` (CommonJS) for Turbopack compatibility.
ESM configs (`.mjs`) may not be processed correctly.

```js
// postcss.config.cjs — works with Turbopack + Webpack
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: ['./app/**/*.chain.{ts,js,tsx,jsx}'],
    },
  },
}
```

```css
/* app/globals.css */
@chaincss;  /* Replaced with all collected ChainCSS styles */
```

---

## 6. PostCSS Plugin: Use `.cjs` Extension

The PostCSS plugin source is `src/postcss/index.cjs` (CommonJS).
This is required because `package.json` has `"type": "module"`.
PostCSS plugins in ESM packages must use `.cjs` or handle `module.exports` carefully.

---

## 7. `var()` Fallback: Avoid `initial`

Using `initial` as a fallback in `var()` can break resolution in some browsers:

```css
/* ❌ Can break var() resolution */
background-color: var(--theme-bg, initial);

/* ✅ Works correctly */
background-color: var(--theme-bg);
```

When the custom property is not set, CSS defaults to the property's initial value
automatically. Explicit `initial` is redundant and can cause bugs.

---

## 8. Framework-Specific Dynamic Style Application

| Framework | Method | Notes |
|-----------|--------|-------|
| **React** | `useChainStyles({ styles }, { deps })` | Returns `styleVars` object; apply with `style={styleVars}` |
| **Vue** | `el.style.setProperty()` | `:style` binding strips CSS custom properties |
| **Svelte** | `el.style.setProperty()` in `$effect` | Import `.css` file explicitly in SvelteKit |
| **Solid** | `el.style.setProperty()` on events | Call `applyStyle()` after state changes |

---

## 9. Cache Clearing During Development

When switching between npm registry versions and local linked versions,
stale cache files may cause missing styles or dynamic functions. Clear them:

```bash
rm -rf .chaincss-cache
rm -rf src/**/*.class.js
rm -rf src/**/*.css
```

The compiler also maintains an in-memory cache. Restart the dev server
after clearing files.

---

## 10. Next.js Integration Paths

| Approach | Turbopack | Webpack | Notes |
|----------|-----------|---------|-------|
| `chaincss/postcss` | ✅ | ✅ | Recommended. Use `postcss.config.cjs` |
| `chaincss/next` plugin | ❌ | ✅ | Webpack only. Use `--webpack` flag |

**PostCSS setup (recommended):**
```js
// postcss.config.cjs
module.exports = {
  plugins: {
    'chaincss/postcss': {
      content: ['./app/**/*.chain.{ts,js,tsx,jsx}'],
    },
  },
}
```

**Next.js plugin (Webpack only):**
```ts
// next.config.ts
import withChainCSS from 'chaincss/next'

export default withChainCSS({
  inputs: ['./app/**/*.chain.{ts,js,tsx,jsx}'],
})({ webpack: {} })  // Forces Webpack
```

---

## 11. React: useChainStyles API

```tsx
import { useChainStyles } from 'chaincss/runtime'
import { themeToggle, counterBadge } from './playground.chain'

function Demo() {
  const [isDark, setIsDark] = useState(true)
  const [count, setCount] = useState(0)

  const { classes, styleVars } = useChainStyles(
    { themeToggle, counterBadge },
    { isDark, count }  // Context passed to dynamic functions
  )

  return (
    <button className={classes.themeToggle} style={styleVars} onClick={() => setIsDark(!isDark)}>
      Toggle
    </button>
  )
}
```

---

## License

MIT

**Author:** Rommel Caneos · [Contact](mailto:rec0608m@gmail.com) · [Website](https://www.chaincss.dev)