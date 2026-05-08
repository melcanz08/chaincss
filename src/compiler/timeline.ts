// src/compiler/timeline.ts
/**
 * Style Timeline & Diff Viewer
 * Tracks every style change, lets you diff versions
 */

export interface StyleSnapshot {
  id: string;
  timestamp: number;
  selector: string;
  styles: Record<string, any>;
  source: string;
  hash: string;
}

export interface StyleChange {
  id: string;
  timestamp: number;
  selector: string;
  property: string;
  oldValue: any;
  newValue: any;
  type: 'add' | 'remove' | 'modify';
}

let styleHistory: StyleSnapshot[] = [];
let styleChanges: StyleChange[] = [];
let timelineEnabled = false;
let currentSnapshotId = 0;

export function enableTimeline(enable: boolean = true): void {
  timelineEnabled = enable;
  if (!enable) {
    styleHistory = [];
    styleChanges = [];
  }
}

export function getStyleHistory(): StyleSnapshot[] {
  return [...styleHistory];
}

export function getStyleChanges(): StyleChange[] {
  return [...styleChanges];
}

export function getStyleDiff(snapshotId1: string, snapshotId2: string): Record<string, any> {
  const snapshot1 = styleHistory.find(s => s.id === snapshotId1);
  const snapshot2 = styleHistory.find(s => s.id === snapshotId2);
  
  if (!snapshot1 || !snapshot2) {
    return { error: 'Snapshot not found' };
  }
  
  const diff: Record<string, any> = { added: {}, removed: {}, modified: {} };
  
  for (const [key, value] of Object.entries(snapshot2.styles)) {
    if (!(key in snapshot1.styles)) {
      diff.added[key] = value;
    } else if (JSON.stringify(snapshot1.styles[key]) !== JSON.stringify(value)) {
      diff.modified[key] = { old: snapshot1.styles[key], new: value };
    }
  }
  
  for (const [key, value] of Object.entries(snapshot1.styles)) {
    if (!(key in snapshot2.styles)) {
      diff.removed[key] = value;
    }
  }
  
  return diff;
}

export function takeSnapshot(selector: string, styles: Record<string, any>, source: string): string {
  if (!timelineEnabled) return '';
  
  const hash = JSON.stringify(styles);
  const existing = styleHistory.find(s => s.selector === selector && s.hash === hash);
  if (existing) return existing.id;
  
  const id = `snapshot_${currentSnapshotId++}`;
  styleHistory.push({ id, timestamp: Date.now(), selector, styles: { ...styles }, source, hash });
  
  // Track changes from previous snapshot
  const previous = styleHistory[styleHistory.length - 2];
  if (previous && previous.selector === selector) {
    for (const [key, value] of Object.entries(styles)) {
      if (!(key in previous.styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(), selector, property: key,
          oldValue: undefined, newValue: value, type: 'add'
        });
      } else if (JSON.stringify(previous.styles[key]) !== JSON.stringify(value)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(), selector, property: key,
          oldValue: previous.styles[key], newValue: value, type: 'modify'
        });
      }
    }
    for (const [key] of Object.entries(previous.styles)) {
      if (!(key in styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(), selector, property: key,
          oldValue: previous.styles[key], newValue: undefined, type: 'remove'
        });
      }
    }
  }
  
  return id;
}

export function exportTimeline(): string {
  return JSON.stringify({ history: styleHistory, changes: styleChanges, exportedAt: Date.now() }, null, 2);
}

export function clearTimeline(): void {
  styleHistory = [];
  styleChanges = [];
  currentSnapshotId = 0;
}

export function isTimelineEnabled(): boolean {
  return timelineEnabled;
}
