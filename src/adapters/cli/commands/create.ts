// ============================================================================
// FILE: src/adapters/cli/commands/create.ts
// ============================================================================

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { execSync } from "child_process";

interface CreateOptions {
  template?: "minimal" | "entangled" | "react";
  pm?: "npm" | "pnpm" | "yarn" | "bun";
  install?: boolean;
  verbose?: boolean;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function write(p: string, content: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function pkgJson(name: string, template: string) {
  const isReact = template === "react";

  const devDeps: Record<string, string> = {
    vite: "^5.4.0",
    chaincss: "^2.13.1", // Uses latest release baseline
    typescript: "^5.5.0",
  };

  const deps: Record<string, string> = {};

  if (isReact) {
    deps["react"] = "^18.3.0";
    deps["react-dom"] = "^18.3.0";
    devDeps["@types/react"] = "^18.3.0";
    devDeps["@types/react-dom"] = "^18.3.0";
    devDeps["@vitejs/plugin-react"] = "^4.3.0";
  }

  return JSON.stringify(
    {
      name,
      type: "module",
      private: true,
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        "tokens:watch":
          "chaincss entanglement --input tokens/global.json --watch --verbose",
        "tokens:fix": "chaincss entanglement --input tokens/global.json --fix",
        audit: "chaincss audit --fix --write",
      },
      dependencies: deps,
      devDependencies: devDeps,
    },
    null,
    2,
  );
}

function viteConfig(template: string) {
  const hasFigma = template === "entangled" || template === "react";
  const isReact = template === "react";

  return `import { defineConfig } from 'vite'
import chaincss from 'chaincss/vite'
${isReact ? "import react from '@vitejs/plugin-react'\n" : ""}${hasFigma ? "import figmaSync from 'chaincss/figma-sync'\n" : "// import figmaSync from 'chaincss/figma-sync'\n"}
export default defineConfig({
  plugins: [
    ${isReact ? "react()," : ""}
    ${
      hasFigma
        ? `figmaSync({
      mode: 'url',
      // Replace with your Tokens Studio GitHub raw URL
      url: 'https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json',
      output: 'tokens/global.json',
      pollMs: 3000,
      autoFix: true,
      verbose: true
    }),`
        : "// figmaSync({ mode: 'url', url: 'https://.../tokens.json' }),"
    }
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
`;
}

function tsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        useDefineForClassFields: true,
        module: "ESNext",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        skipLibCheck: true,

        /* Bundler mode */
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",

        /* Linting */
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
      },
      include: ["src"],
    },
    null,
    2,
  );
}

function chaincssConfig() {
  return `import { defineConfig } from 'chaincss'

export default defineConfig({
  inputs: ['src/**/*.{chain.ts,chain.tsx,ts,tsx}'],
  output: { cssFile: 'dist/styles.css' },
  atomic: { enabled: true },
  prefixer: { enabled: true },
  tokens: {
    relationships: [
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.50', method: 'tint 90%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },
      { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5, autoFix: 'lighten' }
    ]
  },
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' }
})
`;
}

function appChainTs() {
  return `// src/App.chain.ts — Entangled style layers
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
  }
}

export const badge = {
  selectors: ['.badge'],
  intent: 'bgPrimary100 textPrimary700 roundedFull px3 py1 textSm fontMedium'
}
`;
}

function indexHtml(name: string, template: string) {
  const entryScript = template === "react" ? "/src/main.tsx" : "/src/main.ts";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — ChainCSS</title>
</head>
<body>
  ${
    template === "react"
      ? '<div id="root"></div>'
      : `
  <div class="page">
    <div class="card">
      <span class="badge">Entangled</span>
      <h1 style="margin:0;font-size:24px;font-weight:700">ChainCSS + Figma Live</h1>
      <p style="margin:0;opacity:0.7;line-height:1.5">Modify your design token parameters and watch compilation mechanics run in real-time.</p>
      <button class="btn">Primary Action</button>
    </div>
  </div>`
  }
  <script type="module" src="${entryScript}"></script>
</body>
</html>
`;
}

function reactBoilerplate() {
  return `import React from 'react'
import './App.chain.css'

export function App() {
  return (
    <div className="page">
      <div className="card">
        <span className="badge">Entangled React</span>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>ChainCSS + Figma Live</h1>
        <p style={{ margin: 0, opacity: 0.7, lineHeight: 1.5 }}>
          Change colors.primary.500 in tokens. Watch HMR update components automatically.
        </p>
        <button className="btn">Primary Action</button>
      </div>
    </div>
  )
}
`;
}

export async function createCommand(
  appName?: string,
  opts: CreateOptions = {},
) {
  const template = opts.template || "entangled";
  const pm = opts.pm || "npm";
  const name = appName || `my-chaincss-${template}-app`;
  const root = path.join(process.cwd(), name);

  if (fs.existsSync(root)) {
    console.log(chalk.red(`Folder ${name} already exists`));
    process.exit(1);
  }

  console.log(
    chalk.cyan(`\n✨ Creating ChainCSS app: ${name} (${template})\n`),
  );

  ensureDir(path.join(root, "src"));
  ensureDir(path.join(root, "tokens"));
  ensureDir(path.join(root, ".tokensstudio"));
  ensureDir(path.join(root, ".github", "workflows"));

  // Structural Configuration Files
  write(path.join(root, "package.json"), pkgJson(name, template));
  write(path.join(root, "tsconfig.json"), tsConfig());
  write(path.join(root, "vite.config.ts"), viteConfig(template));
  write(path.join(root, "chaincss.config.ts"), chaincssConfig());
  write(path.join(root, "index.html"), indexHtml(name, template));
  write(path.join(root, "src", "App.chain.ts"), appChainTs());

  // BUNDLER WORKAROUND: Generate empty CSS file to prevent immediate cold boot resolution crashes
  write(
    path.join(root, "src", "App.chain.css"),
    "/* Generated fallback baseline for Vite cold starts */\n",
  );

  // Core Application Mount Setup
  if (template === "react") {
    write(path.join(root, "src", "App.tsx"), reactBoilerplate());
    write(
      path.join(root, "src", "main.tsx"),
      `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport { App } from './App.tsx'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n)\n`,
    );
  } else {
    write(
      path.join(root, "src", "main.ts"),
      `import './App.chain.css'\nconsole.log('[ChainCSS] Runtime baseline ready.')\n`,
    );
  }

  // Token Baselines
  write(
    path.join(root, "tokens", "$metadata.json"),
    JSON.stringify({ tokenSetOrder: ["global", "light", "dark"] }, null, 2),
  );
  write(
    path.join(root, "tokens", "$themes.json"),
    JSON.stringify(
      [
        {
          id: "light",
          name: "Light",
          selectedTokenSets: { global: "enabled" },
        },
      ],
      null,
      2,
    ),
  );
  write(
    path.join(root, "tokens", "global.json"),
    JSON.stringify(
      {
        colors: {
          primary: {
            "500": {
              value: "#6366f1",
              type: "color",
              description: "Source token",
            },
            "100": {
              value: "#e0e7ff",
              type: "color",
              description: "Auto-derived",
            },
            "600": {
              value: "#4f46e5",
              type: "color",
              description: "Auto-derived",
            },
          },
          background: { value: "#ffffff", type: "color" },
          surface: { value: "#f8fafc", type: "color" },
          text: {
            onPrimary: { value: "#ffffff", type: "color" },
            onSurface: { value: "#0f172a", type: "color" },
            muted: { value: "#94a3b8", type: "color" },
          },
          border: { value: "#e2e8f0", type: "color" },
        },
      },
      null,
      2,
    ),
  );

  write(
    path.join(root, ".env.example"),
    `FIGMA_TOKEN=figd_xxx\nTOKENS_URL=https://raw.githubusercontent.com/your-org/design-tokens/main/tokens.json\n`,
  );
  write(path.join(root, ".env"), `FIGMA_TOKEN=\nTOKENS_URL=\n`);
  write(
    path.join(root, ".gitignore"),
    `node_modules\ndist\n.chaincss-cache\n*.class.js\n*.chain.css\n.env\n`,
  );

  // Documentation & Automation Actions
  write(
    path.join(root, ".tokensstudio", "README.md"),
    `# Connect Figma Studio Configuration\nRefer to standard deployment docs to set up repository webhooks.\n`,
  );
  write(
    path.join(root, ".github", "workflows", "chaincss-tokens.yml"),
    `name: Entanglement Fix
on:
  push:
    paths: ['tokens/**']
  workflow_dispatch:
jobs:
  fix:
    runs-on: ubuntu-latest
    permissions:
      contents: write
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
`,
  );

  console.log(chalk.green(`\n✓ Created ${name}/`));
  console.log(chalk.gray(`  ├─ tsconfig.json (TypeScript base setup)`));
  console.log(chalk.gray(`  ├─ vite.config.ts (Pre-wired environments)`));
  console.log(chalk.gray(`  ├─ src/App.chain.css (Fallback baseline)`));
  console.log(
    chalk.gray(`  └─ tokens/global.json (Entanglement token configuration)`),
  );

  let installSuccess = false;
  if (opts.install) {
    console.log(chalk.cyan(`\n📦 Installing project elements with ${pm}...`));
    try {
      execSync(`${pm} install`, { cwd: root, stdio: "inherit" });
      installSuccess = true;
    } catch {
      console.log(
        chalk.yellow(
          `\n⚠️ Automatic install failed. Your system may be missing ${pm} globally, or there is a local network issue.`,
        ),
      );
    }
  }

  // Format runner execution feedback to dynamically reflect designated package manager tool
  const runCmd =
    pm === "npm" ? "npm run" : pm === "yarn" ? "yarn" : `${pm} run`;

  console.log(chalk.cyan(`\nNext execution configurations:\n`));
  console.log(chalk.white(`  cd ${name}`));
  if (!installSuccess) {
    console.log(chalk.white(`  ${pm} install`));
  }
  console.log(chalk.white(`  ${runCmd} dev`));
  console.log(
    chalk.gray(
      `  # in a separate terminal process to watch configuration state transformations`,
    ),
  );
  console.log(chalk.white(`  ${runCmd} tokens:watch\n`));
  console.log(chalk.green(`✨ Happy entangling!\n`));
}

export default createCommand;
