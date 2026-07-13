// src/cli/commands/figma.ts — chaincss figma init
// Creates Tokens Studio GitHub sync config + ChainCSS entanglement wiring automatically

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import readline from 'readline'

interface FigmaInitOptions {
  repo?: string
  fileId?: string
  branch?: string
  path?: string
  yes?: boolean
  verbose?: boolean
}

function ask(q: string, def?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const prompt = def ? `${q} ${chalk.gray(`(${def})`)}: ` : `${q}: `
  return new Promise(res => {
    rl.question(prompt, ans => { rl.close(); res(ans.trim() || def || '') })
  })
}

function ensureDir(p: string) { fs.mkdirSync(p, { recursive: true }) }

export async function figmaInitCommand(opts: FigmaInitOptions = {}) {
  const root = process.cwd()
  console.log(chalk.cyan('\n🎨 ChainCSS Figma Sync Init\n'))
  console.log(chalk.gray('This will wire Figma Tokens Studio <-> GitHub <-> ChainCSS entanglement\n'))

  const repo = opts.repo || await ask('GitHub repo (org/repo) for token sync', '')
  const branch = opts.branch || await ask('Branch', 'main')
  const tokensPath = opts.path || await ask('Tokens path in repo', 'tokens.json')
  const fileId = opts.fileId || await ask('Figma File ID (optional, for Variables API mode)', '')
  const useFigmaApi = !!fileId

  const tokensDir = path.join(root, 'tokens')
  const studioDir = path.join(root, '.tokensstudio')
  const githubDir = path.join(root, '.github', 'workflows')

  // 1. tokens/$metadata.json
  ensureDir(tokensDir)
  const metadataPath = path.join(tokensDir, '$metadata.json')
  if (!fs.existsSync(metadataPath)) {
    fs.writeFileSync(metadataPath, JSON.stringify({
      tokenSetOrder: ['global', 'light', 'dark']
    }, null, 2), 'utf8')
    console.log(chalk.green(`✓ Created ${path.relative(root, metadataPath)}`))
  }

  // 2. tokens/global.json starter
  const globalPath = path.join(tokensDir, 'global.json')
  if (!fs.existsSync(globalPath)) {
    fs.writeFileSync(globalPath, JSON.stringify({
      colors: {
        primary: { "500": { value: "#6366f1", type: "color", description: "Source, entangled to 100,600,50" } },
        background: { value: "#ffffff", type: "color" },
        text: {
          onPrimary: { value: "#ffffff", type: "color", $extensions: { "chaincss.entanglement": { contrast: "colors.primary.500" } } },
          muted: { value: "#9ca3af", type: "color" }
        }
      }
    }, null, 2), 'utf8')
    console.log(chalk.green(`✓ Created ${path.relative(root, globalPath)}`))
  }

  // 3. .tokensstudio/config.json for GitHub sync (Tokens Studio format)
  ensureDir(studioDir)
  const studioConfigPath = path.join(root, 'tokens', '$themes.json')
  if (!fs.existsSync(studioConfigPath)) {
    fs.writeFileSync(studioConfigPath, JSON.stringify([
      { id: "light", name: "Light", selectedTokenSets: { global: "enabled" } },
      { id: "dark", name: "Dark", selectedTokenSets: { global: "enabled" } }
    ], null, 2), 'utf8')
    console.log(chalk.green(`✓ Created ${path.relative(root, studioConfigPath)}`))
  }

  // 4. .tokensstudio sync provider hint (for Tokens Studio UI)
  const syncHintPath = path.join(studioDir, 'README.md')
  if (!fs.existsSync(syncHintPath)) {
    const repoUrl = repo ? `https://github.com/${repo}` : 'https://github.com/YOUR_ORG/YOUR_REPO'
    fs.writeFileSync(syncHintPath, `# Tokens Studio Sync Setup

1. Open Figma -> Tokens Studio -> Settings -> Sync -> Add new -> GitHub
2. Repo: ${repo || 'your-org/your-repo'}
3. Branch: ${branch}
4. File: ${tokensPath}
5. Personal Access Token: create at https://github.com/settings/tokens (repo scope)
6. Enable "Commit changes" and "Push on change"

ChainCSS will then poll:
${repo ? `https://raw.githubusercontent.com/${repo}/${branch}/${tokensPath}` : 'https://raw.githubusercontent.com/.../tokens.json'}

Or use Figma Variables API mode:
- Figma File ID: ${fileId || 'your-file-id'}
- FIGMA_TOKEN env var
`, 'utf8')
    console.log(chalk.green(`✓ Created ${path.relative(root, syncHintPath)}`))
  }

  // 5. .env.example
  const envPath = path.join(root, '.env.example')
  let envContent = ''
  if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8')
  if (!envContent.includes('FIGMA_TOKEN')) {
    fs.writeFileSync(envPath, envContent + `\n# Figma Tokens Studio / Figma Variables API\nFIGMA_TOKEN=figd_xxxxxxxxxxxxxxxx\n# Optional: GitHub PAT for push (if you want ChainCSS to push fixes back)\nGITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx\n`, 'utf8')
    console.log(chalk.green(`✓ Updated ${path.relative(root, envPath)}`))
  }

  // 6. GitHub Action to auto-fix entanglement on push
  ensureDir(githubDir)
  const workflowPath = path.join(githubDir, 'chaincss-tokens.yml')
  if (!fs.existsSync(workflowPath)) {
    fs.writeFileSync(workflowPath, `name: ChainCSS Entanglement

on:
  push:
    paths:
      - '${tokensPath}'
      - 'tokens/**'
  workflow_dispatch:

jobs:
  entanglement:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci || npm install
      - run: npx chaincss entanglement --input ${tokensPath} --fix --output ${tokensPath}
      - name: Commit fixes
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "chaincss-bot"
            git config user.email "bot@chaincss.dev"
            git add ${tokensPath}
            git commit -m "chore(tokens): auto-fix entanglement [skip ci]"
            git push
          fi
`, 'utf8')
    console.log(chalk.green(`✓ Created ${path.relative(root, workflowPath)}`))
  }

  // 7. Update chaincss.config.ts if exists, or create snippet
  const configJs = path.join(root, 'chaincss.config.js')
  const configTs = path.join(root, 'chaincss.config.ts')
  const hasConfig = fs.existsSync(configJs) || fs.existsSync(configTs)
  if (!hasConfig) {
    fs.writeFileSync(configJs, `import { defineConfig } from 'chaincss'\nexport default defineConfig({\n  inputs: ['src/**/*.chain.{ts,tsx}'],\n  output: { cssFile: 'dist/styles.css' },\n  atomic: { enabled: true },\n  tokens: {\n    relationships: [\n      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },\n      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },\n      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },\n      { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5 }\n    ]\n  }\n})\n`, 'utf8')
    console.log(chalk.green(`✓ Created chaincss.config.js with entanglement relationships`))
  } else {
    console.log(chalk.yellow(`! chaincss.config.* already exists, add this to your config:`))
    console.log(chalk.gray(`
  tokens: {
    relationships: [
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto' }
    ]
  }
`))
  }

  // 8. Vite snippet
  console.log(chalk.cyan('\nNext steps:\n'))
  console.log(chalk.white('1. Add to vite.config.ts:'))
  console.log(chalk.gray(`
import chaincss from './src/plugins/vite.ts'
import figmaSync from './src/plugins/figma-sync.ts'

export default {
  plugins: [
    figmaSync({
      mode: '${useFigmaApi ? 'figmaVariables' : 'url'}',
      ${useFigmaApi ? `fileId: '${fileId}',\n      token: process.env.FIGMA_TOKEN!,` : `url: 'https://raw.githubusercontent.com/${repo || 'org/repo'}/${branch}/${tokensPath}',`}
      output: '${tokensPath}',
      pollMs: 3000
    }),
    chaincss()
  ]
}
`))
  console.log(chalk.white('2. Run:'))
  console.log(chalk.gray(`  npm run dev\n  # designer changes color in Figma -> Tokens Studio pushes to GitHub -> figmaSync polls -> entanglement fixes -> HMR updates browser\n`))
  console.log(chalk.white('3. Manual fix:'))
  console.log(chalk.gray(`  npx chaincss entanglement --input ${tokensPath} --fix --watch --verbose\n`))
  console.log(chalk.green('✅ Figma sync init complete!\n'))
}

export default figmaInitCommand

