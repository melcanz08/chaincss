import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export async function timelineCommand(action: string, options: any) {
  const timelineFile = path.join(process.cwd(), '.chaincss-timeline.json');
  
  if (!fs.existsSync(timelineFile)) {
    console.log(chalk.yellow('No timeline data found. Run build with --timeline first.'));
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
  
  switch (action) {
    case 'list':
      console.log(chalk.cyan('\n📊 Style Timeline History\n'));
      data.history.forEach((snapshot: any, index: number) => {
        const date = new Date(snapshot.timestamp).toLocaleString();
        console.log(`${chalk.green(`[${index}]`)} ${chalk.white(snapshot.selector)} - ${chalk.gray(date)}`);
        console.log(`    ${chalk.dim(Object.keys(snapshot.styles).length)} properties`);
      });
      break;
      
    case 'diff':
      const id1 = options.snapshot1;
      const id2 = options.snapshot2;
      
      // Find snapshots
      const snapshot1 = data.history.find((s: any) => s.id === id1 || s.selector === id1);
      const snapshot2 = data.history.find((s: any) => s.id === id2 || s.selector === id2);
      
      if (!snapshot1 || !snapshot2) {
        console.log(chalk.red('Snapshot not found'));
        return;
      }
      
      console.log(chalk.cyan(`\n🔍 Diff: ${snapshot1.selector} → ${snapshot2.selector}\n`));
      
      // Calculate diff
      const allProps = new Set([...Object.keys(snapshot1.styles), ...Object.keys(snapshot2.styles)]);
      
      for (const prop of allProps) {
        const oldVal = snapshot1.styles[prop];
        const newVal = snapshot2.styles[prop];
        
        if (oldVal && !newVal) {
          console.log(`${chalk.red('−')} ${prop}: ${oldVal}`);
        } else if (!oldVal && newVal) {
          console.log(`${chalk.green('+')} ${prop}: ${newVal}`);
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          console.log(`${chalk.yellow('~')} ${prop}: ${oldVal} → ${newVal}`);
        }
      }
      break;
      
    case 'export':
      const exportPath = options.output || 'chaincss-timeline.json';
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      console.log(chalk.green(`✓ Timeline exported to ${exportPath}`));
      break;
      
    case 'clear':
      fs.unlinkSync(timelineFile);
      console.log(chalk.green('✓ Timeline cleared'));
      break;
      
    default:
      console.log(chalk.yellow('Unknown action. Available: list, diff, export, clear'));
  }
}