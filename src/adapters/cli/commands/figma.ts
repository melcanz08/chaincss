// ============================================================================
// FILE: src/adapters/cli/commands/figma.ts
// ============================================================================

import fs from "fs";
import path from "path";
import chalk from "chalk";
import readline from "readline";

interface FigmaInitOptions {
  repo?: string;
  fileId?: string;
  branch?: string;
  path?: string;
  yes?: boolean;
  verbose?: boolean;
}

function ask(q: string, def?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const prompt = def ? `${q} ${chalk.gray(`(${def})`)}: ` : `${q}: `;
  return new Promise((res) => {
    rl.question(prompt, (ans) => {
      rl.close();
      res(ans.trim() || def || "");
    });
  });
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

// Simple validation to ensure repo conforms to standard "owner/name" structure
function isValidGitHubRepo(repo: string): boolean {
  return /^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(repo);
}

export async function figmaInitCommand(opts: FigmaInitOptions = {}) {
  const root = process.cwd();
  console.log(chalk.cyan("\n🎨 ChainCSS Figma Sync Init\n"));
  console.log(
    chalk.gray(
      "This will wire Figma Tokens Studio <-> GitHub <-> ChainCSS entanglement\n",
    ),
  );

  // Resolve config variables checking the non-interactive --yes flag first
  let repo =
    opts.repo ||
    (opts.yes
      ? "your-org/your-repo"
      : await ask("GitHub repo (org/repo) for token sync", ""));

  if (!opts.yes && repo) {
    while (repo && !isValidGitHubRepo(repo)) {
      console.log(
        chalk.red(
          '⚠ Invalid format. Please provide the repository in the format "owner/repo"',
        ),
      );
      repo = await ask("GitHub repo (org/repo) for token sync", "");
    }
  }

  const branch =
    opts.branch || (opts.yes ? "main" : await ask("Branch", "main"));
  const tokensPath =
    opts.path ||
    (opts.yes
      ? "tokens.json"
      : await ask("Tokens path in repo", "tokens.json"));
  const fileId =
    opts.fileId ||
    (opts.yes
      ? ""
      : await ask("Figma File ID (optional, for Variables API mode)", ""));
  const useFigmaApi = !!fileId;

  const tokensDir = path.join(root, "tokens");
  const studioDir = path.join(root, ".tokensstudio");
  const githubDir = path.join(root, ".github", "workflows");

  // Detect project settings
  const isTypeScriptProject = fs.existsSync(path.join(root, "tsconfig.json"));

  let isESM = false;
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      isESM = pkg.type === "module";
    } catch {
      // Fallback if package.json is unparseable
    }
  }

  // 1. tokens/$metadata.json
  ensureDir(tokensDir);
  const metadataPath = path.join(tokensDir, "$metadata.json");
  if (!fs.existsSync(metadataPath)) {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          tokenSetOrder: ["global", "light", "dark"],
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(chalk.green(`✓ Created ${path.relative(root, metadataPath)}`));
  }

  // 2. tokens/global.json starter
  const globalPath = path.join(tokensDir, "global.json");
  if (!fs.existsSync(globalPath)) {
    fs.writeFileSync(
      globalPath,
      JSON.stringify(
        {
          colors: {
            primary: {
              "500": {
                value: "#6366f1",
                type: "color",
                description: "Source, entangled to 100,600,50",
              },
            },
            background: { value: "#ffffff", type: "color" },
            text: {
              onPrimary: {
                value: "#ffffff",
                type: "color",
                $extensions: {
                  "chaincss.entanglement": { contrast: "colors.primary.500" },
                },
              },
              muted: { value: "#9ca3af", type: "color" },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(chalk.green(`✓ Created ${path.relative(root, globalPath)}`));
  }

  // 3. .tokensstudio/config.json for GitHub sync (Tokens Studio format)
  ensureDir(studioDir);
  const studioConfigPath = path.join(root, "tokens", "$themes.json");
  if (!fs.existsSync(studioConfigPath)) {
    fs.writeFileSync(
      studioConfigPath,
      JSON.stringify(
        [
          {
            id: "light",
            name: "Light",
            selectedTokenSets: { global: "enabled" },
          },
          {
            id: "dark",
            name: "Dark",
            selectedTokenSets: { global: "enabled" },
          },
        ],
        null,
        2,
      ),
      "utf8",
    );
    console.log(
      chalk.green(`✓ Created ${path.relative(root, studioConfigPath)}`),
    );
  }

  // 4. .tokensstudio sync provider hint (for Tokens Studio UI)
  const syncHintPath = path.join(studioDir, "README.md");
  if (!fs.existsSync(syncHintPath)) {
    fs.writeFileSync(
      syncHintPath,
      `# Tokens Studio Sync Setup

1. Open Figma -> Tokens Studio -> Settings -> Sync -> Add new -> GitHub
2. Repo: ${repo || "your-org/your-repo"}
3. Branch: ${branch}
4. File: ${tokensPath}
5. Personal Access Token: create at https://github.com/settings/tokens (repo scope)
6. Enable "Commit changes" and "Push on change"

ChainCSS will then poll:
https://raw.githubusercontent.com/${repo || "your-org/your-repo"}/${branch}/${tokensPath}

Or use Figma Variables API mode:
- Figma File ID: ${fileId || "your-file-id"}
- FIGMA_TOKEN env var
`,
      "utf8",
    );
    console.log(chalk.green(`✓ Created ${path.relative(root, syncHintPath)}`));
  }

  // 5. Setup .env.example and populate a template local .env if it doesn't exist
  const envFiles = [
    { file: ".env.example", optionalPlaceholder: true },
    { file: ".env", optionalPlaceholder: false },
  ];

  for (const envObj of envFiles) {
    const filePath = path.join(root, envObj.file);
    let envContent = "";

    // Don't overwrite active .env configurations, but append safely
    if (fs.existsSync(filePath)) {
      envContent = fs.readFileSync(filePath, "utf8");
    }

    if (!envContent.includes("FIGMA_TOKEN")) {
      const separator = envContent && !envContent.endsWith("\n") ? "\n" : "";
      const figmaVal = envObj.optionalPlaceholder
        ? "figd_xxxxxxxxxxxxxxxx"
        : "";
      const ghVal = envObj.optionalPlaceholder ? "ghp_xxxxxxxxxxxxxxxx" : "";

      fs.writeFileSync(
        filePath,
        envContent +
          `${separator}# Figma Tokens Studio / Figma Variables API\nFIGMA_TOKEN=${figmaVal}\n# Optional: GitHub PAT for push back integrations\nGITHUB_TOKEN=${ghVal}\n`,
        "utf8",
      );
      console.log(chalk.green(`✓ Updated ${path.relative(root, filePath)}`));
    }
  }

  // 6. GitHub Action to auto-fix entanglement on push with safely quoted shell variables
  ensureDir(githubDir);
  const workflowPath = path.join(githubDir, "chaincss-tokens.yml");
  if (!fs.existsSync(workflowPath)) {
    fs.writeFileSync(
      workflowPath,
      `name: ChainCSS Entanglement

on:
  push:
    paths:
      - '${tokensPath}'
      - 'tokens/**'
  workflow_dispatch:

jobs:
  entanglement:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci || npm install
      # ESCAPED: Added \ before the $ to prevent JavaScript template string interpolation errors
      - run: npx chaincss entanglement --input "\${{ github.workspace }}/${tokensPath}" --fix --output "\${{ github.workspace }}/${tokensPath}"
      - name: Commit fixes
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "chaincss-bot"
            git config user.email "bot@chaincss.dev"
            git add "\${{ github.workspace }}/${tokensPath}"
            git commit -m "chore(tokens): auto-fix entanglement [skip ci]"
            git push
          fi
`,
      "utf8",
    );
    console.log(chalk.green(`✓ Created ${path.relative(root, workflowPath)}`));
  }

  // 7. Generate a language-appropriate config template (ESM, CJS, or TS)
  const configJs = path.join(root, "chaincss.config.js");
  const configTs = path.join(root, "chaincss.config.ts");
  const hasConfig = fs.existsSync(configJs) || fs.existsSync(configTs);

  // Dynamic skeletal config body
  const rawSkeletonConfig = `inputs: ['src/**/*.chain.{ts,tsx}'],
  output: { cssFile: 'dist/styles.css' },
  atomic: { enabled: true },
  tokens: {
    relationships: [
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.600', method: 'shade 20%' },
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto', priority: 10 },
      { type: 'contrast', foreground: 'colors.text.muted', background: 'colors.background', target: 4.5 }
    ]
  }`;

  let configSkeleton = "";
  if (isTypeScriptProject) {
    configSkeleton = `import { defineConfig } from 'chaincss'\n\nexport default defineConfig({\n  ${rawSkeletonConfig}\n})\n`;
  } else if (isESM) {
    configSkeleton = `import { defineConfig } from 'chaincss'\n\nexport default defineConfig({\n  ${rawSkeletonConfig}\n})\n`;
  } else {
    // Standard CommonJS fallback for pure JS projects
    configSkeleton = `const { defineConfig } = require('chaincss')\n\nmodule.exports = defineConfig({\n  ${rawSkeletonConfig}\n})\n`;
  }

  if (!hasConfig) {
    const targetConfigPath = isTypeScriptProject ? configTs : configJs;
    fs.writeFileSync(targetConfigPath, configSkeleton, "utf8");
    console.log(
      chalk.green(
        `✓ Created ${path.basename(targetConfigPath)} with entanglement relationships`,
      ),
    );
  } else {
    console.log(
      chalk.yellow(
        `! chaincss.config.* already exists, add this to your config's tokens object:`,
      ),
    );
    console.log(
      chalk.gray(`
  tokens: {
    relationships: [
      { type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' },
      { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto' }
    ]
  }
`),
    );
  }

  // 8. Integration steps
  console.log(chalk.cyan("\nNext steps:\n"));
  console.log(
    chalk.white(
      `1. Add to your bundler configuration (e.g., vite.config.${isTypeScriptProject ? "ts" : "js"}):`,
    ),
  );
  console.log(
    chalk.gray(`
import chaincss from './src/plugins/vite.ts'
import figmaSync from './src/plugins/figma-sync.ts'

export default {
  plugins: [
    figmaSync({
      mode: '${useFigmaApi ? "figmaVariables" : "url"}',
      ${useFigmaApi ? `fileId: '${fileId}',\n      token: process.env.FIGMA_TOKEN!,` : `url: 'https://raw.githubusercontent.com/${repo || "your-org/your-repo"}/${branch}/${tokensPath}',`}
      output: '${tokensPath}',
      pollMs: 3000
    }),
    chaincss()
  ]
}
`),
  );
  console.log(chalk.white("2. Run your development server:"));
  console.log(
    chalk.gray(
      `  npm run dev\n  # Designer changes color in Figma -> Tokens Studio pushes -> figmaSync polls -> entanglement auto-fixes -> HMR updates browser\n`,
    ),
  );
  console.log(
    chalk.white(
      "3. To run a manual background watch of entanglement relationships:",
    ),
  );
  console.log(
    chalk.gray(
      `  npx chaincss entanglement --input ${tokensPath} --fix --watch --verbose\n`,
    ),
  );
  console.log(chalk.green("✅ Figma sync init complete!\n"));
}

export default figmaInitCommand;
