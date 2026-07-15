// src/cli/index.ts —  with create + figma + entanglement
import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';

import { buildCommand } from './commands/build.js';
import { timelineCommand } from './commands/timeline.js';
import { devCommand } from './commands/dev.js';
import { cacheCommand } from './commands/cache.js';
import { checkCommand } from './commands/check.js';
import { auditCommand } from './commands/audit.js';
import { entanglementCommand } from './commands/entanglement.js';
import { figmaInitCommand } from './commands/figma.js';
import { createCommand } from './commands/create.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const findPkg = (s:string)=>{ let c=s; while(c!==path.parse(c).root){ const p=path.join(c,'package.json'); if(existsSync(p)) return p; c=path.dirname(c)} throw new Error('No pkg') }
const pkg = JSON.parse(readFileSync(findPkg(__dirname),'utf8'));
const err = (e:unknown, cmd:string)=>{ console.error(chalk.red(`\n❌ ${cmd}:`), e instanceof Error?e.message:String(e)); if(process.env.DEBUG && e instanceof Error) console.error(e.stack); process.exit(1) }

const program = new Command();
program.name('chaincss').description('ChainCSS - Entangled CSS Framework').version(pkg.version,'-V, --version').helpOption('-h, --help','Help');

// init
program.command('init').description('Init config').option('-f, --force','Overwrite').action(async o=>{ try{ const p='chaincss.config.js'; if(existsSync(p)&&!o.force){ console.log(chalk.yellow('Config file already exists. Use --force to overwrite.')); return } const cfg=`import { defineConfig } from 'chaincss'\nexport default defineConfig({\n  inputs: ['src/**/*.chain.{ts,tsx}'],\n  output: { cssFile: 'dist/styles.css' },\n  atomic: { enabled: true },\n  tokens: { relationships: [{ type: 'derived', source: 'colors.primary.500', target: 'colors.primary.100', method: 'mix-white 80%' }, { type: 'contrast', foreground: 'colors.text.onPrimary', background: 'colors.primary.500', target: 4.5, autoFix: 'auto' }] }\n})\n`; writeFileSync(p,cfg); console.log(chalk.green('✓ Created chaincss.config.js')) }catch(e){err(e,'init')} });

// create — NEW
const create = program.command('create').description('Create new app');
create.command('app [name]').description('Create new ChainCSS app').option('-t, --template <t>','minimal|entangled|react','entangled').option('--pm <pm>','npm|pnpm|yarn|bun','npm').option('--no-install','Skip install').option('-v, --verbose','Verbose').action(async (name,o)=>{ try{ await createCommand(name,{template:o.template,pm:o.pm,install:o.install!==false,verbose:o.verbose}) }catch(e){err(e,'create app')} });

// build etc
program.command('build').option('-c, --config <p>','Glob').option('-v, --verbose','V').option('-w, --watch','Watch').option('--minify','Minify').option('--atomic','Atomic').description('Build').action(async o=>{ try{ await buildCommand(o)}catch(e){err(e,'build')} });
program.command('watch').option('-c, --config <p>','Glob').option('-v, --verbose','V').description('Watch').action(async o=>{ try{ await buildCommand({...o,watch:true}) }catch(e){err(e,'watch')} });
program.command('timeline').argument('<action>','list,diff,export,clear').option('-s, --snapshot1 <id>','s1').option('--snapshot2 <id>','s2').option('-o, --output <p>','out').description('Timeline').action(async (a,o)=>{ await timelineCommand(a,o) });
program.command('dev').option('-c, --config <p>','Config').option('-p, --port <port>','Port','3000').description('Dev').action(async o=>{ try{ await devCommand({config:o.config,port:parseInt(o.port)}) }catch(e){ console.error(chalk.red('Dev failed'),(e as Error).message); process.exit(1)} });
program.command('cache').argument('<action>','clear,stats,prune').option('-v, --verbose','V').description('Cache').action(async (a,o)=>{ await cacheCommand(a,o) });
program.command('check').option('-c, --config <p>','Glob').option('-v, --verbose','V').option('--fix','Fix').description('Check').action(async o=>{ try{ await checkCommand(o)}catch(e){err(e,'check')} });
program.command('audit').option('--theme <p>','Tokens').option('--contract <p>','Contract').option('--fail-on <l>','AA|AAA','AA').option('--target <r>','Ratio','4.5').option('--json <p>','JSON').option('--strict','Strict').option('--fix','Fix').option('--write','Write').option('-v, --verbose','V').description('Audit WCAG').action(async o=>{ try{ await auditCommand({theme:o.theme,contract:o.contract,failOn:o.failOn,target:parseFloat(o.target),json:o.json,strict:o.strict,fix:o.fix,write:o.write,verbose:o.verbose}) }catch(e){err(e,'audit')} });
program.command('entanglement').alias('entangle').option('-i, --input <p>','Input','tokens.json').option('-o, --output <p>','Output').option('-w, --watch','Watch').option('--figma','Figma format').option('--fix','Fix','true').option('--debounce <ms>','Debounce','150').option('-v, --verbose','V').description('Entanglement engine').action(async o=>{ try{ await entanglementCommand({input:o.input,output:o.output,watch:o.watch,figma:o.figma,fix:o.fix!=='false',debounceMs:parseInt(o.debounce),verbose:o.verbose}) }catch(e){err(e,'entanglement')} });

const figma = program.command('figma').description('Figma integration');
figma.command('init').option('--repo <org/repo>','GitHub repo').option('--fileId <id>','Figma File ID').option('--branch <b>','Branch','main').option('--path <p>','Tokens path','tokens.json').option('-y, --yes','Skip prompts').option('-v, --verbose','Verbose').description('Init Figma sync').action(async o=>{ try{ await figmaInitCommand({repo:o.repo,fileId:o.fileId,branch:o.branch,path:o.path,yes:o.yes,verbose:o.verbose}) }catch(e){err(e,'figma init')} });

program.on('--help', () => {
  console.log(''); console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  # Initialize config')); console.log('  $ chaincss init'); console.log('');
  console.log(chalk.gray('  # Build styles')); console.log('  $ chaincss build'); console.log('');
  console.log(chalk.gray('  # Audit contrast')); console.log('  $ chaincss audit'); console.log('');
  console.log(chalk.gray('  # Audit with auto-fix suggestions')); console.log('  $ chaincss audit --fix'); console.log('');
});
if(process.argv.length===2){ program.outputHelp(); process.exit(0) }
program.parse(process.argv);

