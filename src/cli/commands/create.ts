// src/cli/commands/create.ts — npx chaincss create app --template entangled
// Scaffolds a full Vite + ChainCSS + Figma Sync + Entanglement app in one command

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { execSync } from 'child_process'

interface CreateOptions {
  template?: 'minimal' | 'entangled' | 'react' | 'vue'
  pm?: 'npm' | 'pnpm' | 'yarn' | 'bun'
  install?: boolean
  verbose?: boolean
}

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }) }
function write(p: string, content: string) { ensureDir(path.dirname(p)); fs.writeFileSync(p, content, 'utf8') }

function pkgJson(name: string, template: string) {
  const deps: Record<string, string> = {
    vite: "^5.4.0",
    chaincss: "workspace:*",
    typescript: "^5.5.0"
  }
  if (template.includes('react')) { deps['react'] = "^18.3.0"; deps['react-dom'] = "^18.3.0"; deps['@types/react'] = "^18.3.0" }
  return JSON.stringify({
    name, type: "module", private: true,
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      "tokens:watch": "chaincss entanglement --input tokens/global.json --watch --verbose",
      "tokens:fix": "chaincss entanglement --input tokens/global.json --fix",
      "audit": "chaincss audit --fix --write"
    },
    dependencies: {},
    devDependencies: deps
  }, null, 2)
}

function viteConfig(template: string) {
  const hasFigma = template === 'entangled'
  return `import { defineConfig } from 'vite'
import chaincss from 'chaincss/vite'
${hasFigma ? `import figmaSync from 'chaincss/figma-sync'` : '// import figmaSync from \'chaincss/figma-sync\''}

export default defineConfig({
  plugins: [
    ${hasFigma ? `figmaSync({\n      mode: 'url',\n      // Replace with your Tokens Studio GitHub raw URL\n      url: process.env.TOKENS_URL || 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',\n      output: 'tokens/global.json',\n      pollMs: 3000,\n      autoFix: true,\n      verbose: true\n    }),` : '// figmaSync({ mode: \'url\', url: \'https://.../tokens.json\' }),'}
    chaincss({
      verbose: true,
      atomic: true,
      tokens: {
        relationships: [
          { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
          { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
          { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 }
        ]
      }
    })
  ]
})
`
}

function chaincssConfig() {
  return `import { defineConfig } from 'chaincss'

export default defineConfig({
  inputs: ['src/**/*.{chain.ts,chain.tsx}'],
  output: { cssFile: 'dist/styles.css' },
  atomic: { enabled: true },
  prefixer: { enabled: true },
  tokens: {
    relationships: [
      // Derived: changing primary.500 auto updates 100 and 600
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.50', method: 'tint 90%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
      // Contrast: keeps text readable automatically
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },
      { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5, autoFix: 'lighten' }
    ]
  },
  // Breakpoints available as intents: sm:, md:, lg:
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' }
})
`
}

function appChainTs() {
  return `// src/App.chain.ts — Entangled example
// Change tokens/global.json colors.primary.500 and watch everything update with contrast fix

export const page = {
  selectors: ['.page'],
  minHeight: '100vh',
  background: 'var(--colors-background)',
  color: 'var(--colors-text-onSurface)',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

export const card = {
  selectors: ['.card'],
  intent: 'bgSurface shadowMd roundedXl p8 maxW420 wFull',
  border: '1px solid var(--colors-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  '&:hover': {
    intent: 'shadowLg lift',
    transition: 'all 200ms ease'
  }
}

export const button = {
  selectors: ['.btn'],
  intent: 'bgPrimary textOnPrimary roundedFull px6 py3 fontMedium',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  '&:hover': {
    intent: 'bgPrimary600 shadowMd',
    transform: 'translateY(-1px)'
  },
  '&:active': {
    transform: 'translateY(0px)'
  },
  '&[data-loading=true]': {
    intent: 'shimmer pointerEventsNone opacity70'
  }
}

export const badge = {
  selectors: ['.badge'],
  intent: 'bgPrimary100 textPrimary700 roundedFull px3 py1 textSm fontMedium',
  // This badge is entangled: primary.100 is derived from primary.500 via mix-white 80%
  // So when Figma changes primary.500, this badge auto updates and keeps contrast
}
`
}

function indexHtml(name: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — ChainCSS Entangled</title>
</head>
<body>
  <div class="page">
    <div class="card">
      <span class="badge">Entangled</span>
      <h1 style="margin:0;font-size:24px;font-weight:700">ChainCSS + Figma Live</h1>
      <p style="margin:0;opacity:0.7;line-height:1.5">Change <code>colors.primary.500</code> in Figma Tokens Studio. Watch this button and badge auto update with AA contrast fix, no reload.</p>
      <button class="btn">Primary Action</button>
      <p style="margin:0;font-size:12px;opacity:0.5">Run <code>npm run tokens:watch</code> alongside <code>npm run dev</code></p>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`
}

function mainTs() {
  return `import './App.chain.css'
// HMR is handled by chaincss/vite + figmaSync
console.log('[ChainCSS] Entangled app ready — change tokens/global.json to see live update')
`
}

export async function createCommand(appName?: string, opts: CreateOptions = {}) {
  const template = opts.template || 'entangled'
  const pm = opts.pm || 'npm'
  const name = appName || `my-chaincss-${template}-app`
  const root = path.join(process.cwd(), name)

  if (fs.existsSync(root)) {
    console.log(chalk.red(`Folder ${name} already exists`))
    process.exit(1)
  }

  console.log(chalk.cyan(`\n✨ Creating ChainCSS app: ${name} (${template})\n`))

  // dirs
  ensureDir(path.join(root, 'src'))
  ensureDir(path.join(root, 'tokens'))
  ensureDir(path.join(root, '.tokensstudio'))
  ensureDir(path.join(root, '.github', 'workflows'))

  // package.json
  write(path.join(root, 'package.json'), pkgJson(name, template))
  write(path.join(root, 'vite.config.ts'), viteConfig(template))
  write(path.join(root, 'chaincss.config.ts'), chaincssConfig())
  write(path.join(root, 'index.html'), indexHtml(name))
  write(path.join(root, 'src', 'main.ts'), mainTs())
  write(path.join(root, 'src', 'App.chain.ts'), appChainTs())

  // tokens
  write(path.join(root, 'tokens', '$metadata.json'), JSON.stringify({ tokenSetOrder: ['global', 'light', 'dark'] }, null, 2))
  write(path.join(root, 'tokens', '$themes.json'), JSON.stringify([{ id: 'light', name: 'Light', selectedTokenSets: { global: 'enabled' } }], null, 2))
  write(path.join(root, 'tokens', 'global.json'), JSON.stringify({
    colors: {
      primary: {
        "500": { value: "#6366f1", type: "color", description: "Source - entangled" },
        "100": { value: "#e0e7ff", type: "color", description: "derived mix-white 80% - auto" },
        "600": { value: "#4f46e5", type: "color", description: "derived shade 20% - auto" }
      },
      background: { value: "#ffffff", type: "color" },
      surface: { value: "#f8fafc", type: "color" },
      text: {
        onPrimary: { value: "#ffffff", type: "color" },
        onSurface: { value: "#0f172a", type: "color" },
        muted: { value: "#94a3b8", type: "color" }
      },
      border: { value: "#e2e8f0", type: "color" }
    }
  }, null, 2))

  // .env.example
  write(path.join(root, '.env.example'), `FIGMA_TOKEN=figd_xxx\nTOKENS_URL=https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json\n`)

  // .gitignore
  write(path.join(root, '.gitignore'), `node_modules\ndist\n.chaincss-cache\n*.class.js\n*.chain.css\n.env\n`)

  // Tokens Studio README
  write(path.join(root, '.tokensstudio', 'README.md'), `# Connect Figma

1. Figma -> Plugins -> Tokens Studio -> Settings -> Sync -> GitHub
   Repo: your-org/design-tokens
   Branch: main
   File: tokens/global.json

2. Set TOKENS_URL in .env to your raw URL:
   https://raw.githubusercontent.com/your-org/design-tokens/main/tokens/global.json

3. Run:
   npm run dev
   npm run tokens:watch

ChainCSS will poll, entangle, and HMR update the browser.
`)

  // GitHub Action
  write(path.join(root, '.github', 'workflows', 'chaincss-tokens.yml'), `name: Entanglement Fix
on:
  push:
    paths: ['tokens/**']
  workflow_dispatch:
jobs:
  fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci || npm install
      - run: npx chaincss entanglement --input tokens/global.json --fix --output tokens/global.json
      - run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "chaincss-bot"
            git config user.email "bot@chaincss.dev"
            git add tokens/global.json
            git commit -m "chore(tokens): auto-fix entanglement [skip ci]"
            git push
          fi
`)

  console.log(chalk.green(`\n✓ Created ${name}/`))
  console.log(chalk.gray(`  ├─ vite.config.ts (with figmaSync + chaincss)`))
  console.log(chalk.gray(`  ├─ chaincss.config.ts (entanglement relationships)`))
  console.log(chalk.gray(`  ├─ tokens/global.json (entangled tokens)`))
  console.log(chalk.gray(`  ├─ src/App.chain.ts (example)`))
  console.log(chalk.gray(`  └─ .github/workflows/chaincss-tokens.yml`))

  if (opts.install) {
    console.log(chalk.cyan(`\n📦 Installing with ${pm}...`))
    try { execSync(`${pm} install`, { cwd: root, stdio: 'inherit' }) } catch {}
  }

  console.log(chalk.cyan(`\nNext:\n`))
  console.log(chalk.white(`  cd ${name}`))
  if (!opts.install) console.log(chalk.white(`  ${pm} install`))
  console.log(chalk.white(`  ${pm} run dev`))
  console.log(chalk.gray(`  # in another terminal`))
  console.log(chalk.white(`  ${pm} run tokens:watch`))
  console.log(chalk.gray(`\n  Change tokens/global.json colors.primary.500 -> browser updates with contrast fix\n`))
  console.log(chalk.green(`✨ Happy entangling!\n`))
}

export default createCommand

