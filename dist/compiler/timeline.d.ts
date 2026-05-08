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
export declare function enableTimeline(enable?: boolean): void;
export declare function getStyleHistory(): StyleSnapshot[];
export declare function getStyleChanges(): StyleChange[];
export declare function getStyleDiff(snapshotId1: string, snapshotId2: string): Record<string, any>;
export declare function takeSnapshot(selector: string, styles: Record<string, any>, source: string): string;
export declare function exportTimeline(): string;
export declare function clearTimeline(): void;
export declare function isTimelineEnabled(): boolean;
