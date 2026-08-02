// ============================================================================
// FILE: chaincss/src/adapters/cli/commands/cache.ts
// ============================================================================

import chalk from 'chalk';
import { formatBytes, formatDuration } from "../utils/format.js";
import fs from 'fs';
import path from 'path';
import { PersistentCache } from '@compiler/cache/content-addressable-cache.js';

// Display cache entry details
function displayCacheEntry(key: string, entry: any, index: number): void {
  const created = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown';
  const lastAccessed = entry.lastAccessed ? new Date(entry.lastAccessed).toLocaleString() : 'Never';
  
  console.log(`\n${chalk.green(`[${index}]`)} ${chalk.white.bold(key)}`);
  console.log(`    ${chalk.gray(`Created: ${created}`)}`);
  console.log(`    ${chalk.gray(`Last Accessed: ${lastAccessed}`)}`);
  console.log(`    ${chalk.gray(`Usage Count: ${entry.accessCount || 0}`)}`);
  
  if (entry.size) {
    console.log(`    ${chalk.gray(`Size: ${formatBytes(entry.size)}`)}`);
  }
}

// Throttled Promise Pool helper to prevent EMFILE system crashes
async function poolPromises<T, R>(
  items: T[], 
  fn: (item: T) => Promise<R>, 
  concurrencyLimit = 50
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p as any); // Track placeholder reference

    const e: Promise<void> = p.then(() => { executing.delete(e); });
    executing.add(e);

    if (executing.size >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

export async function cacheCommand(action: string, options: any) {
  const cacheDir = path.resolve(process.cwd(), options.cacheDir || './.chaincss-cache');
  const persistentCacheDir = path.resolve(process.cwd(), options.persistentCacheDir || './.chaincss/persistent-cache');
  
  // Create cache instances
  const persistentCache = new PersistentCache({
    cacheDir: persistentCacheDir,
    maxAgeDays: options.maxAge || 30,
    maxSizeMB: options.maxSize || 500,
    verbose: options.verbose,
    enabled: true
  });
  
  switch (action) {
    case 'clear':
      console.log(chalk.yellow('\n⚠️  This will delete all cached data'));
      if (!options.force) {
        console.log(chalk.gray('    Use --force to confirm\n'));
        return;
      }
      
      try {
        // Clear persistent cache
        await persistentCache.clear();
        
        // Clear regular cache directory if it exists
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
        
        console.log(chalk.green('\n✓ All cache cleared'));
        console.log(chalk.gray(`    Removed: ${path.relative(process.cwd(), cacheDir)}`));
        console.log(chalk.gray(`    Removed: ${path.relative(process.cwd(), persistentCacheDir)}\n`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to clear cache: ${(error as Error).message}\n`));
      }
      break;
      
    case 'stats':
      try {
        const stats = await persistentCache.getStats();
        const regularCacheExists = fs.existsSync(cacheDir);
        const persistentCacheExists = fs.existsSync(persistentCacheDir);
        
        console.log(chalk.cyan.bold('\n📊 Cache Statistics\n'));
        
        // Persistent Cache Stats
        console.log(chalk.white.bold('Persistent Cache:'));
        console.log(`  Status: ${persistentCacheExists ? chalk.green('Active') : chalk.gray('Empty')}`);
        if (persistentCacheExists) {
          console.log(`  Entry count: ${chalk.white(stats.entryCount || 0)}`);
          console.log(`  Total size: ${chalk.white((stats.totalSizeMB || 0).toFixed(2))} MB`);
          console.log(`  Total size (bytes): ${chalk.white(formatBytes(stats.totalSizeBytes || 0))}`);
          
          if (stats.oldestEntry) {
            const age = Date.now() - new Date(stats.oldestEntry).getTime();
            console.log(`  Oldest entry: ${chalk.white(new Date(stats.oldestEntry).toLocaleDateString())} (${formatDuration(age)} ago)`);
          }
          if (stats.newestEntry) {
            const age = Date.now() - new Date(stats.newestEntry).getTime();
            console.log(`  Newest entry: ${chalk.white(new Date(stats.newestEntry).toLocaleDateString())} (${formatDuration(age)} ago)`);
          }
          
          if (stats.hitRate !== undefined) {
            const hitRateColor = stats.hitRate > 0.8 ? chalk.green : stats.hitRate > 0.5 ? chalk.yellow : chalk.red;
            console.log(`  Cache hit rate: ${hitRateColor(`${(stats.hitRate * 100).toFixed(1)}%`)}`);
          }
        }
        
        // Regular Cache Stats
        console.log(chalk.white.bold('\nRegular Cache:'));
        console.log(`  Status: ${regularCacheExists ? chalk.green('Active') : chalk.gray('Empty')}`);
        
        if (regularCacheExists) {
          let totalSize = 0;
          let fileCount = 0;
          
          // Made synchronous, defensively wrapped for file deletion races
          const calculateSize = (dir: string) => {
            try {
              const files = fs.readdirSync(dir);
              for (const file of files) {
                const filePath = path.join(dir, file);
                try {
                  const stat = fs.statSync(filePath);
                  if (stat.isDirectory()) {
                    calculateSize(filePath);
                  } else {
                    totalSize += stat.size;
                    fileCount++;
                  }
                } catch {
                  // Guarded file access: Ignore files deleted midway
                }
              }
            } catch {
              // Guarded directory access
            }
          };
          
          calculateSize(cacheDir);
          console.log(`  File count: ${chalk.white(fileCount)}`);
          console.log(`  Total size: ${chalk.white(formatBytes(totalSize))}`);
        }
        
        // Settings
        console.log(chalk.white.bold('\nSettings:'));
        console.log(`  Max age: ${chalk.white(options.maxAge || 30)} days`);
        console.log(`  Max size: ${chalk.white(options.maxSize || 500)} MB`);
        console.log(`  Cache directory: ${chalk.gray(path.relative(process.cwd(), persistentCacheDir))}`);
        
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to get cache stats: ${(error as Error).message}\n`));
      }
      break;
      
    case 'prune':
      try {
        const beforeStats = await persistentCache.getStats();
        const beforeCount = beforeStats.entryCount || 0;
        const beforeSize = beforeStats.totalSizeMB || 0;
        
        console.log(chalk.yellow(`\n🧹 Pruning cache...`));
        console.log(chalk.gray(`    Before: ${beforeCount} entries, ${beforeSize.toFixed(2)} MB`));
        
        await persistentCache.prune();
        await persistentCache.enforceSizeLimit();
        
        const afterStats = await persistentCache.getStats();
        const afterCount = afterStats.entryCount || 0;
        const afterSize = afterStats.totalSizeMB || 0;
        
        const removedCount = beforeCount - afterCount;
        const removedSize = beforeSize - afterSize;
        
        if (removedCount > 0) {
          console.log(chalk.green(`✓ Cache pruned successfully`));
          console.log(chalk.gray(`    Removed: ${removedCount} entries, ${removedSize.toFixed(2)} MB`));
          console.log(chalk.gray(`    Remaining: ${afterCount} entries, ${afterSize.toFixed(2)} MB`));
        } else {
          console.log(chalk.gray(`    No entries to prune`));
        }
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to prune cache: ${(error as Error).message}\n`));
      }
      break;
      
    case 'list':
      try {
        const entries = await persistentCache.listEntries();
        
        if (!entries || entries.length === 0) {
          console.log(chalk.yellow('\n📭 No cache entries found\n'));
          return;
        }
        
        console.log(chalk.cyan.bold(`\n📦 Cache Entries (${entries.length})\n`));
        
        entries.forEach((entry: any, index: number) => {
          displayCacheEntry(entry.key, entry, index);
        });
        
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to list cache entries: ${(error as Error).message}\n`));
      }
      break;
      
    case 'inspect':
      const key = options.key;
      if (!key) {
        console.log(chalk.red('\n❌ Please provide a cache key to inspect'));
        console.log(chalk.gray('    Usage: chaincss cache inspect --key <key>\n'));
        return;
      }
      
      try {
        const entry = await persistentCache.get(key);
        
        if (!entry) {
          console.log(chalk.yellow(`\n❌ Cache entry not found: ${key}\n`));
          return;
        }
        
        console.log(chalk.cyan.bold(`\n🔍 Cache Entry: ${key}\n`));
        console.log(chalk.white('Metadata:'));
        console.log(`  Created: ${chalk.gray(entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown')}`);
        console.log(`  Last accessed: ${chalk.gray(entry.lastAccessed ? new Date(entry.lastAccessed).toLocaleString() : 'Never')}`);
        console.log(`  Access count: ${chalk.gray(entry.accessCount || 0)}`);
        
        if (entry.size) {
          console.log(`  Size: ${chalk.gray(formatBytes(entry.size))}`);
        }
        
        if (entry.value) {
          console.log(chalk.white.bold('\nContent Preview:'));
          const valueStr = JSON.stringify(entry.value, null, 2);
          const preview = valueStr.length > 500 ? valueStr.slice(0, 500) + '...' : valueStr;
          console.log(chalk.gray(preview));
        }
        
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to inspect cache entry: ${(error as Error).message}\n`));
      }
      break;
      
    case 'delete':
      const deleteKey = options.key;
      if (!deleteKey) {
        console.log(chalk.red('\n❌ Please provide a cache key to delete'));
        console.log(chalk.gray('    Usage: chaincss cache delete --key <key>\n'));
        return;
      }
      
      if (!options.force) {
        console.log(chalk.yellow(`\n⚠️  This will delete cache entry: ${deleteKey}`));
        console.log(chalk.gray('    Use --force to confirm\n'));
        return;
      }
      
      try {
        const deleted = await persistentCache.delete(deleteKey);
        
        if (deleted) {
          console.log(chalk.green(`\n✓ Deleted cache entry: ${deleteKey}\n`));
        } else {
          console.log(chalk.yellow(`\n❌ Cache entry not found: ${deleteKey}\n`));
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to delete cache entry: ${(error as Error).message}\n`));
      }
      break;
      
    case 'validate':
      try {
        console.log(chalk.cyan.bold('\n🔍 Validating Cache Integrity\n'));
        
        const entries = await persistentCache.listEntries();
        let validCount = 0;
        let invalidCount = 0;
        let totalSize = 0;
        
        // CONCURRENCY-SAFE RESOLVER: Throttles to 50 concurrent lookups to protect file system EMFILE limit
        const validationResults = await poolPromises(entries, async (entry: any) => {
          const isValid = await persistentCache.validate(entry.key);
          return { entry, isValid };
        }, 50);
        
        for (const { entry, isValid } of validationResults) {
          if (isValid) {
            validCount++;
            totalSize += entry.size || 0;
          } else {
            invalidCount++;
            console.log(chalk.yellow(`  ✗ Invalid entry: ${entry.key}`));
          }
        }
        
        console.log(chalk.white(`\nResults:`));
        console.log(`  Valid entries: ${chalk.green(validCount)}`);
        console.log(`  Invalid entries: ${invalidCount > 0 ? chalk.red(invalidCount) : chalk.green(invalidCount)}`);
        console.log(`  Total size: ${chalk.gray(formatBytes(totalSize))}`);
        
        if (invalidCount > 0) {
          console.log(chalk.yellow(`\n⚠️  Found ${invalidCount} invalid entries. Run 'chaincss cache prune' to clean them.\n`));
        } else {
          console.log(chalk.green(`\n✓ All cache entries are valid\n`));
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to validate cache: ${(error as Error).message}\n`));
      }
      break;
      
    case 'backup':
      const rawBackupPath = options.output || `./.chaincss-cache-backup-${Date.now()}`;
      const resolvedBackupPath = path.resolve(process.cwd(), rawBackupPath);
      
      try {
        console.log(chalk.cyan.bold('\n💾 Creating Cache Backup\n'));
        
        // LOOP PREVENTION GUARD: Check if backup destination is inside either of the cache paths
        const isNestedInCache = resolvedBackupPath.startsWith(cacheDir + path.sep) || resolvedBackupPath === cacheDir;
        const isNestedInPersistent = resolvedBackupPath.startsWith(persistentCacheDir + path.sep) || resolvedBackupPath === persistentCacheDir;
        
        if (isNestedInCache || isNestedInPersistent) {
          throw new Error("Target backup directory cannot be nested within the cache folders being backed up.");
        }

        const backupDir = path.dirname(resolvedBackupPath);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupCacheDir = resolvedBackupPath.replace(/\.tar\.gz$/, '');
        
        if (fs.existsSync(cacheDir)) {
          fs.cpSync(cacheDir, backupCacheDir, { recursive: true, force: true });
        }
        
        if (fs.existsSync(persistentCacheDir)) {
          fs.cpSync(persistentCacheDir, path.join(backupCacheDir, 'persistent'), { recursive: true, force: true });
        }
        
        console.log(chalk.green(`✓ Cache backed up to ${path.relative(process.cwd(), backupCacheDir)}`));
        console.log(chalk.gray(`    To restore, copy the contents back to the cache directory\n`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to backup cache: ${(error as Error).message}\n`));
      }
      break;
      
    default:
      console.log(chalk.yellow(`\n❌ Unknown action: ${action}`));
      console.log(chalk.gray('\nAvailable actions:'));
      console.log(chalk.cyan('  clear     ') + chalk.gray('- Clear all cache data'));
      console.log(chalk.cyan('  stats     ') + chalk.gray('- Show cache statistics'));
      console.log(chalk.cyan('  prune     ') + chalk.gray('- Remove expired entries'));
      console.log(chalk.cyan('  list      ') + chalk.gray('- List all cache entries'));
      console.log(chalk.cyan('  inspect   ') + chalk.gray('- Inspect a specific cache entry'));
      console.log(chalk.cyan('  delete    ') + chalk.gray('- Delete a specific cache entry'));
      console.log(chalk.cyan('  validate  ') + chalk.gray('- Validate cache integrity'));
      console.log(chalk.cyan('  backup    ') + chalk.gray('- Backup cache to file'));
  }
}