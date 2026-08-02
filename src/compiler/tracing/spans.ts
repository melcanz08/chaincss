// src/compiler/tracing/spans.ts
// Span management for distributed tracing

export interface Span {
  id: string;
  name: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
  status: "ok" | "error" | "unknown";
}

export interface TracerOptions {
  enabled?: boolean;
  sampleRate?: number;
}

export class Tracer {
  private spans: Map<string, Span> = new Map();
  private rootSpans: string[] = [];
  private enabled: boolean = true;
  private sampleRate: number = 1.0;

  constructor(options: TracerOptions = {}) {
    this.enabled = options.enabled !== false;
    this.sampleRate = options.sampleRate || 1.0;
  }

  startSpan(name: string, parentId?: string): Span {
    if (!this.enabled) {
      return this.createDisabledSpan(name);
    }

    const id = this.generateId();
    const span: Span = {
      id,
      name,
      parentId,
      startTime: performance.now(),
      attributes: {},
      events: [],
      status: "unknown",
    };

    this.spans.set(id, span);
    if (!parentId) {
      this.rootSpans.push(id);
    }

    return span;
  }

  endSpan(spanId: string, status: "ok" | "error" = "ok"): Span | null {
    const span = this.spans.get(spanId);
    if (!span || span.endTime) {
      return null;
    }

    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    return span;
  }

  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, any>,
  ): boolean {
    const span = this.spans.get(spanId);
    if (!span) return false;

    span.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });

    return true;
  }

  setAttribute(spanId: string, key: string, value: any): boolean {
    const span = this.spans.get(spanId);
    if (!span) return false;

    span.attributes[key] = value;
    return true;
  }

  getSpan(spanId: string): Span | null {
    return this.spans.get(spanId) || null;
  }

  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  getRootSpans(): Span[] {
    return this.rootSpans
      .map((id) => this.spans.get(id))
      .filter((s): s is Span => s !== undefined);
  }

  getTraceTree(): any {
    const tree: any[] = [];
    const visited = new Set<string>();

    const buildTree = (spanId: string): any => {
      if (visited.has(spanId)) return null;
      visited.add(spanId);

      const span = this.spans.get(spanId);
      if (!span) return null;

      const node: any = {
        name: span.name,
        duration: span.duration,
        attributes: span.attributes,
        events: span.events,
        status: span.status,
        children: [],
      };

      for (const [childId, childSpan] of this.spans) {
        if (childSpan.parentId === spanId && !visited.has(childId)) {
          const childNode = buildTree(childId);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      }

      return node;
    };

    for (const rootId of this.rootSpans) {
      const tree = buildTree(rootId);
      if (tree) {
        tree.push(tree);
      }
    }

    return tree;
  }

  clear(): void {
    this.spans.clear();
    this.rootSpans = [];
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10)
    );
  }

  private createDisabledSpan(name: string): Span {
    return {
      id: "disabled",
      name,
      startTime: 0,
      attributes: {},
      events: [],
      status: "unknown",
    };
  }
}

export const defaultTracer = new Tracer({
  enabled: process.env.NODE_ENV !== "production",
});
