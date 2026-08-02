// ============================================================================
// FILE: src/adapters/cli/utils/timeline.ts
// ChainCSS Dev-Time Compilation Styling Watcher & Differential Engine
// ============================================================================

export interface StyleSnapshot {
  id: string;
  timestamp: number;
  selector: string;
  styles: Record<string, unknown>;
  source: string;
  hash: string;
}

export interface StyleChange {
  id: string;
  timestamp: number;
  selector: string;
  property: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'add' | 'remove' | 'modify';
}

export interface TimelineDiff {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
}

export class StyleTimelineTracker {
  private styleHistory: StyleSnapshot[] = [];
  private styleChanges: StyleChange[] = [];
  private lastSnapshotBySelector = new Map<string, StyleSnapshot>();
  private timelineEnabled = false;
  private currentSnapshotId = 0;
  private currentChangeId = 0;
  private readonly maxSnapshots: number;

  constructor(maxSnapshots = 1000) {
    this.maxSnapshots = maxSnapshots;
  }

  public enable(enable = true): void {
    this.timelineEnabled = enable;
    if (!enable) {
      this.clear();
    }
  }

  public isEnabled(): boolean {
    return this.timelineEnabled;
  }

  public clear(): void {
    this.styleHistory = [];
    this.styleChanges = [];
    this.lastSnapshotBySelector.clear();
    this.currentSnapshotId = 0;
    this.currentChangeId = 0;
  }

  public getHistory(): StyleSnapshot[] {
    return [...this.styleHistory];
  }

  public getChanges(): StyleChange[] {
    return [...this.styleChanges];
  }

  /**
   * Recursively sorts objects to enforce a deterministic key-ordering contract.
   * Returns a plain Object instead of a pre-serialized JSON string.
   */
  private sortStyleKeys(styles: Record<string, unknown>): Record<string, unknown> {
    const sortedKeys = Object.keys(styles).sort();
    const sortedObj: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      const val = styles[key];
      if (typeof val === 'function') {
        sortedObj[key] = val.toString();
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        sortedObj[key] = this.sortStyleKeys(val as Record<string, unknown>);
      } else {
        sortedObj[key] = val;
      }
    }
    return sortedObj;
  }

  /**
   * Generates a deterministic hash of styles, ignoring structural property insertion order.
   */
  private generateDeterministicHash(styles: Record<string, unknown>): string {
    const sortedObj = this.sortStyleKeys(styles);
    return JSON.stringify(sortedObj);
  }

  /**
   * Safely clones objects containing structural properties and functions without losing data.
   */
  private deepCloneStyles(styles: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(styles)) {
      if (typeof val === 'function') {
        clone[key] = val; // Keep the actual function reference intact
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        clone[key] = this.deepCloneStyles(val as Record<string, unknown>);
      } else if (Array.isArray(val)) {
        clone[key] = val.map(item => (item && typeof item === 'object') ? this.deepCloneStyles(item as Record<string, unknown>) : item);
      } else {
        clone[key] = val;
      }
    }
    return clone;
  }

  public takeSnapshot(selector: string, styles: Record<string, unknown>, source: string): string {
    if (!this.timelineEnabled) return '';

    const hash = this.generateDeterministicHash(styles);
    const previous = this.lastSnapshotBySelector.get(selector);

    // Skip recording if styling signature is identical to its last tracked iteration
    if (previous && previous.hash === hash) {
      return previous.id;
    }

    const id = `snapshot_${this.currentSnapshotId++}`;
    
    // Insulate history snapshots safely without dropping procedural functions or custom macro configurations
    const stylesClone = this.deepCloneStyles(styles);

    const newSnapshot: StyleSnapshot = {
      id,
      timestamp: Date.now(),
      selector,
      styles: stylesClone,
      source,
      hash
    };

    this.styleHistory.push(newSnapshot);
    this.lastSnapshotBySelector.set(selector, newSnapshot);

    // Enforce ring-buffer capacity limit to prevent memory runaway
    if (this.styleHistory.length > this.maxSnapshots) {
      const evicted = this.styleHistory.shift();
      if (evicted && this.lastSnapshotBySelector.get(evicted.selector)?.id === evicted.id) {
        this.lastSnapshotBySelector.delete(evicted.selector);
      }
    }

    // Evaluate differential mutations against previous revision of the exact same selector
    if (previous) {
      this.computeDiff(previous, newSnapshot);
    }

    return id;
  }

  private computeDiff(prev: StyleSnapshot, curr: StyleSnapshot): void {
    const timestamp = Date.now();
    const selector = curr.selector;

    for (const [key, value] of Object.entries(curr.styles)) {
      const prevValue = prev.styles[key];

      if (!(key in prev.styles)) {
        this.recordChange({
          id: `change_${timestamp}_${this.currentChangeId++}`,
          timestamp,
          selector,
          property: key,
          oldValue: undefined,
          newValue: value,
          type: 'add'
        });
      } else if (JSON.stringify(prevValue) !== JSON.stringify(value)) {
        this.recordChange({
          id: `change_${timestamp}_${this.currentChangeId++}`,
          timestamp,
          selector,
          property: key,
          oldValue: prevValue,
          newValue: value,
          type: 'modify'
        });
      }
    }

    for (const [key, prevValue] of Object.entries(prev.styles)) {
      if (!(key in curr.styles)) {
        this.recordChange({
          id: `change_${timestamp}_${this.currentChangeId++}`,
          timestamp,
          selector,
          property: key,
          oldValue: prevValue,
          newValue: undefined,
          type: 'remove'
        });
      }
    }
  }

  private recordChange(change: StyleChange): void {
    this.styleChanges.push(change);
    // Keep change log proportional to our snapshot ceiling bounds
    if (this.styleChanges.length > this.maxSnapshots * 2) {
      this.styleChanges.shift();
    }
  }

  public getDiff(snapshotId1: string, snapshotId2: string): TimelineDiff | { error: string } {
    const snapshot1 = this.styleHistory.find(s => s.id === snapshotId1);
    const snapshot2 = this.styleHistory.find(s => s.id === snapshotId2);

    if (!snapshot1 || !snapshot2) {
      return { error: 'Snapshot not found' };
    }

    const diff: TimelineDiff = { added: {}, removed: {}, modified: {} };

    for (const [key, value] of Object.entries(snapshot2.styles)) {
      const val1 = snapshot1.styles[key];
      if (!(key in snapshot1.styles)) {
        diff.added[key] = value;
      } else if (JSON.stringify(val1) !== JSON.stringify(value)) {
        diff.modified[key] = { old: val1, new: value };
      }
    }

    for (const [key, value] of Object.entries(snapshot1.styles)) {
      if (!(key in snapshot2.styles)) {
        diff.removed[key] = value;
      }
    }

    return diff;
  }

  public export(): string {
    return JSON.stringify(
      {
        history: this.styleHistory,
        changes: this.styleChanges,
        exportedAt: Date.now()
      },
      (key, value) => (typeof value === 'function' ? value.toString() : value),
      2
    );
  }
}

// ============================================================================
// Backward-Compatible Module Bindings (Global Default Instance)
// ============================================================================

const defaultTracker = new StyleTimelineTracker();

export function enableTimeline(enable = true): void {
  defaultTracker.enable(enable);
}

export function getStyleHistory(): StyleSnapshot[] {
  return defaultTracker.getHistory();
}

export function getStyleChanges(): StyleChange[] {
  return defaultTracker.getChanges();
}

export function getStyleDiff(snapshotId1: string, snapshotId2: string) {
  return defaultTracker.getDiff(snapshotId1, snapshotId2);
}

export function takeSnapshot(selector: string, styles: Record<string, unknown>, source: string): string {
  return defaultTracker.takeSnapshot(selector, styles, source);
}

export function exportTimeline(): string {
  return defaultTracker.export();
}

export function clearTimeline(): void {
  defaultTracker.clear();
}

export function isTimelineEnabled(): boolean {
  return defaultTracker.isEnabled();
}