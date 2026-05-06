// chaincss/src/commands/timeline.ts
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Types
interface StyleSnapshot {
  id: string;
  timestamp: number;
  selector: string;
  styles: Record<string, any>;
  source: string;
  hash: string;
}

interface StyleChange {
  id: string;
  timestamp: number;
  selector: string;
  property: string;
  oldValue: any;
  newValue: any;
  type: 'add' | 'remove' | 'modify';
}

interface TimelineData {
  history: StyleSnapshot[];
  changes: StyleChange[];
  exportedAt?: number;
  stats?: {
    totalSnapshots: number;
    totalChanges: number;
    firstRecorded: number;
    lastRecorded: number;
  };
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}min`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

// Load timeline data with validation
function loadTimelineData(timelineFile: string): TimelineData | null {
  if (!fs.existsSync(timelineFile)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(timelineFile, 'utf8');
    const data = JSON.parse(content);
    
    // Validate data structure
    if (!data.history || !Array.isArray(data.history)) {
      throw new Error('Invalid timeline data: missing history array');
    }
    
    return data;
  } catch (error) {
    console.error(chalk.red(`Failed to load timeline data: ${(error as Error).message}`));
    return null;
  }
}

// Display snapshot details
function displaySnapshotDetails(snapshot: StyleSnapshot, index: number): void {
  const date = new Date(snapshot.timestamp).toLocaleString();
  const propCount = Object.keys(snapshot.styles).length;
  
  console.log(`\n${chalk.green(`[${index}]`)} ${chalk.white.bold(snapshot.selector)}`);
  console.log(`    ${chalk.gray(`ID: ${snapshot.id}`)}`);
  console.log(`    ${chalk.gray(`Time: ${date}`)}`);
  console.log(`    ${chalk.gray(`Source: ${snapshot.source}`)}`);
  console.log(`    ${chalk.gray(`Properties: ${propCount}`)}`);
  console.log(`    ${chalk.gray(`Hash: ${snapshot.hash.slice(0, 8)}...`)}`);
  
  // Show first few properties as preview
  const previewProps = Object.entries(snapshot.styles).slice(0, 5);
  if (previewProps.length > 0) {
    console.log(`    ${chalk.dim('Preview:')}`);
    for (const [prop, value] of previewProps) {
      console.log(`      ${chalk.blue(prop)}: ${chalk.yellow(value)}`);
    }
    if (Object.keys(snapshot.styles).length > 5) {
      console.log(`      ${chalk.dim(`... and ${Object.keys(snapshot.styles).length - 5} more`)}`);
    }
  }
}

// Calculate diff between two snapshots
function calculateDiff(snapshot1: StyleSnapshot, snapshot2: StyleSnapshot): {
  added: Record<string, any>;
  removed: Record<string, any>;
  modified: Record<string, { old: any; new: any }>;
} {
  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};
  const modified: Record<string, { old: any; new: any }> = {};
  
  // Find added and modified properties
  for (const [key, value] of Object.entries(snapshot2.styles)) {
    if (!(key in snapshot1.styles)) {
      added[key] = value;
    } else if (JSON.stringify(snapshot1.styles[key]) !== JSON.stringify(value)) {
      modified[key] = {
        old: snapshot1.styles[key],
        new: value
      };
    }
  }
  
  // Find removed properties
  for (const [key, value] of Object.entries(snapshot1.styles)) {
    if (!(key in snapshot2.styles)) {
      removed[key] = value;
    }
  }
  
  return { added, removed, modified };
}

// Display diff with colors
function displayDiff(diff: ReturnType<typeof calculateDiff>, selector1: string, selector2: string): void {
  const { added, removed, modified } = diff;
  
  const totalChanges = Object.keys(added).length + Object.keys(removed).length + Object.keys(modified).length;
  
  if (totalChanges === 0) {
    console.log(chalk.gray('  No changes detected'));
    return;
  }
  
  // Display removed properties
  for (const [prop, value] of Object.entries(removed)) {
    console.log(`${chalk.red('−')} ${chalk.red(prop)}: ${chalk.red(String(value))}`);
  }
  
  // Display added properties
  for (const [prop, value] of Object.entries(added)) {
    console.log(`${chalk.green('+')} ${chalk.green(prop)}: ${chalk.green(String(value))}`);
  }
  
  // Display modified properties
  for (const [prop, { old, new: newVal }] of Object.entries(modified)) {
    console.log(`${chalk.yellow('~')} ${chalk.yellow(prop)}: ${chalk.red(String(old))} → ${chalk.green(String(newVal))}`);
  }
}

export async function timelineCommand(action: string, options: any) {
  const timelineFile = path.join(process.cwd(), '.chaincss-timeline.json');
  const data = loadTimelineData(timelineFile);
  
  if (!data) {
    console.log(chalk.yellow('\n⚠️  No timeline data found.'));
    console.log(chalk.gray('   Run your build with --timeline flag first:'));
    console.log(chalk.cyan('   $ chaincss build --timeline\n'));
    return;
  }
  
  // Calculate stats if not present
  if (!data.stats && data.history.length > 0) {
    data.stats = {
      totalSnapshots: data.history.length,
      totalChanges: data.changes?.length || 0,
      firstRecorded: data.history[0]?.timestamp || 0,
      lastRecorded: data.history[data.history.length - 1]?.timestamp || 0
    };
  }
  
  switch (action) {
    case 'list':
      console.log(chalk.cyan.bold('\n📊 Style Timeline History\n'));
      console.log(chalk.gray(`   Total Snapshots: ${data.stats?.totalSnapshots || data.history.length}`));
      console.log(chalk.gray(`   Total Changes: ${data.stats?.totalChanges || data.changes?.length || 0}`));
      
      if (data.stats?.firstRecorded && data.stats?.lastRecorded) {
        const duration = data.stats.lastRecorded - data.stats.firstRecorded;
        console.log(chalk.gray(`   Duration: ${formatDuration(duration)}`));
      }
      
      console.log(chalk.gray('\n   Snapshots:\n'));
      
      data.history.forEach((snapshot: StyleSnapshot, index: number) => {
        displaySnapshotDetails(snapshot, index);
      });
      
      // Show file size
      try {
        const stats = fs.statSync(timelineFile);
        console.log(chalk.gray(`\n📁 Timeline file size: ${formatBytes(stats.size)}`));
      } catch (e) {}
      
      break;
      
    case 'diff':
      const id1 = options.snapshot1;
      const id2 = options.snapshot2;
      
      if (!id1 || !id2) {
        console.log(chalk.red('\n❌ Both snapshot1 and snapshot2 are required for diff'));
        console.log(chalk.gray('   Usage: chaincss timeline diff --snapshot1 <id> --snapshot2 <id>\n'));
        return;
      }
      
      // Find snapshots by ID or selector
      const snapshot1 = data.history.find((s: StyleSnapshot) => 
        s.id === id1 || s.selector === id1
      );
      const snapshot2 = data.history.find((s: StyleSnapshot) => 
        s.id === id2 || s.selector === id2
      );
      
      if (!snapshot1) {
        console.log(chalk.red(`\n❌ Snapshot not found: ${id1}`));
        console.log(chalk.gray('   Use "chaincss timeline list" to see available snapshots\n'));
        return;
      }
      
      if (!snapshot2) {
        console.log(chalk.red(`\n❌ Snapshot not found: ${id2}`));
        console.log(chalk.gray('   Use "chaincss timeline list" to see available snapshots\n'));
        return;
      }
      
      const diff = calculateDiff(snapshot1, snapshot2);
      const totalChanges = Object.keys(diff.added).length + 
                          Object.keys(diff.removed).length + 
                          Object.keys(diff.modified).length;
      
      console.log(chalk.cyan.bold(`\n🔍 Diff: ${snapshot1.selector} → ${snapshot2.selector}\n`));
      console.log(chalk.gray(`   Changes: ${totalChanges}`));
      console.log(chalk.gray(`   Time between: ${formatDuration(snapshot2.timestamp - snapshot1.timestamp)}\n`));
      
      displayDiff(diff, snapshot1.selector, snapshot2.selector);
      
      if (totalChanges > 0) {
        console.log(chalk.gray(`\n   Legend: ${chalk.red('−')} removed  ${chalk.green('+')} added  ${chalk.yellow('~')} modified\n`));
      }
      break;
      
    case 'changes':
      console.log(chalk.cyan.bold('\n📝 Style Change History\n'));
      
      if (!data.changes || data.changes.length === 0) {
        console.log(chalk.gray('  No changes recorded\n'));
        return;
      }
      
      // Group changes by selector
      const changesBySelector = new Map<string, StyleChange[]>();
      for (const change of data.changes) {
        if (!changesBySelector.has(change.selector)) {
          changesBySelector.set(change.selector, []);
        }
        changesBySelector.get(change.selector)!.push(change);
      }
      
      for (const [selector, changes] of changesBySelector) {
        console.log(chalk.white.bold(`\n  ${selector}`));
        
        for (const change of changes) {
          const date = new Date(change.timestamp).toLocaleTimeString();
          switch (change.type) {
            case 'add':
              console.log(`    ${chalk.green(`+ ${change.property}: ${change.newValue}`)} ${chalk.gray(`[${date}]`)}`);
              break;
            case 'remove':
              console.log(`    ${chalk.red(`- ${change.property}: ${change.oldValue}`)} ${chalk.gray(`[${date}]`)}`);
              break;
            case 'modify':
              console.log(`    ${chalk.yellow(`~ ${change.property}: ${change.oldValue} → ${change.newValue}`)} ${chalk.gray(`[${date}]`)}`);
              break;
          }
        }
      }
      console.log();
      break;
      
    case 'stats':
      console.log(chalk.cyan.bold('\n📈 Timeline Statistics\n'));
      console.log(chalk.gray(`   Total Snapshots: ${data.history.length}`));
      console.log(chalk.gray(`   Total Changes: ${data.changes?.length || 0}`));
      
      if (data.history.length > 0) {
        const firstSnapshot = data.history[0];
        const lastSnapshot = data.history[data.history.length - 1];
        const duration = lastSnapshot.timestamp - firstSnapshot.timestamp;
        
        console.log(chalk.gray(`   First Recorded: ${new Date(firstSnapshot.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`   Last Recorded: ${new Date(lastSnapshot.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`   Duration: ${formatDuration(duration)}`));
        
        // Count changes by type
        const changesByType = { add: 0, remove: 0, modify: 0 };
        for (const change of data.changes || []) {
          changesByType[change.type]++;
        }
        
        console.log(chalk.gray(`\n   Changes by Type:`));
        console.log(chalk.green(`     Added: ${changesByType.add}`));
        console.log(chalk.red(`     Removed: ${changesByType.remove}`));
        console.log(chalk.yellow(`     Modified: ${changesByType.modify}`));
        
        // Most active selectors
        const changesBySelector: Record<string, number> = {};
        for (const change of data.changes || []) {
          changesBySelector[change.selector] = (changesBySelector[change.selector] || 0) + 1;
        }
        
        const topSelectors = Object.entries(changesBySelector)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        if (topSelectors.length > 0) {
          console.log(chalk.gray(`\n   Most Active Selectors:`));
          for (const [selector, count] of topSelectors) {
            console.log(chalk.gray(`     ${selector}: ${count} changes`));
          }
        }
      }
      
      try {
        const stats = fs.statSync(timelineFile);
        console.log(chalk.gray(`\n   File Size: ${formatBytes(stats.size)}`));
      } catch (e) {}
      
      console.log();
      break;
      
    case 'export':
      const exportPath = options.output || `chaincss-timeline-${Date.now()}.json`;
      const fullExportPath = path.isAbsolute(exportPath) 
        ? exportPath 
        : path.join(process.cwd(), exportPath);
      
      // Add export metadata
      const exportData = {
        ...data,
        exportedAt: Date.now(),
        exportedFrom: timelineFile,
        version: '1.0.0'
      };
      
      try {
        fs.writeFileSync(fullExportPath, JSON.stringify(exportData, null, 2));
        const stats = fs.statSync(fullExportPath);
        console.log(chalk.green(`\n✓ Timeline exported to ${fullExportPath}`));
        console.log(chalk.gray(`  Size: ${formatBytes(stats.size)}`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to export: ${(error as Error).message}`));
      }
      break;
      
    case 'clear':
      try {
        // Create backup before clearing
        const backupPath = `${timelineFile}.backup-${Date.now()}`;
        fs.copyFileSync(timelineFile, backupPath);
        fs.unlinkSync(timelineFile);
        console.log(chalk.green(`\n✓ Timeline cleared`));
        console.log(chalk.gray(`  Backup saved to ${backupPath}`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to clear timeline: ${(error as Error).message}`));
      }
      break;
      
    case 'watch':
      console.log(chalk.cyan.bold('\n👁️  Watching timeline changes...\n'));
      console.log(chalk.gray('   Press Ctrl+C to stop\n'));
      
      let lastModified = fs.statSync(timelineFile).mtimeMs;
      
      const watcher = setInterval(() => {
        try {
          const stats = fs.statSync(timelineFile);
          if (stats.mtimeMs > lastModified) {
            lastModified = stats.mtimeMs;
            const newData = loadTimelineData(timelineFile);
            if (newData && newData.history.length !== data.history.length) {
              console.log(chalk.yellow(`\n📝 Timeline updated - ${new Date().toLocaleTimeString()}`));
              console.log(chalk.gray(`   New snapshot count: ${newData.history.length}`));
              
              // Show the latest snapshot
              const latest = newData.history[newData.history.length - 1];
              if (latest) {
                console.log(chalk.green(`   Latest: ${latest.selector}`));
                console.log(chalk.gray(`   Properties: ${Object.keys(latest.styles).length}`));
              }
            }
            // Update data reference
            Object.assign(data, newData);
          }
        } catch (e) {
          // File might be temporarily locked
        }
      }, 1000);
      
      // Handle cleanup on exit
      process.on('SIGINT', () => {
        clearInterval(watcher);
        console.log(chalk.gray('\n\n👋 Stopped watching\n'));
        process.exit(0);
      });
      break;
      
    default:
      console.log(chalk.yellow(`\n❌ Unknown action: ${action}`));
      console.log(chalk.gray('\nAvailable actions:'));
      console.log(chalk.cyan('  list     ') + chalk.gray('- List all timeline snapshots'));
      console.log(chalk.cyan('  diff     ') + chalk.gray('- Compare two snapshots'));
      console.log(chalk.cyan('  changes  ') + chalk.gray('- Show individual style changes'));
      console.log(chalk.cyan('  stats    ') + chalk.gray('- Show timeline statistics'));
      console.log(chalk.cyan('  export   ') + chalk.gray('- Export timeline to JSON'));
      console.log(chalk.cyan('  clear    ') + chalk.gray('- Clear timeline data'));
      console.log(chalk.cyan('  watch    ') + chalk.gray('- Watch for timeline updates\n'));
  }
}