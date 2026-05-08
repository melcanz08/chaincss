// src/compiler/analyzer.ts
import type { StyleDefinition, StyleDiagnostic, StyleAnalysis, BreakpointInference, DiagnosticSeverity } from '../core/types.js';
import { intent } from './intent-engine.js';
export type { StyleDiagnostic, StyleAnalysis, BreakpointInference, DiagnosticSeverity };

const CONFLICTS: Array<{props: string[]; msg: string; sev: DiagnosticSeverity}> = [
  {props: ['position','z-index','zIndex'], msg: 'z-index only works on positioned elements (not static)', sev: 'warning'},
  {props: ['flex-direction','align-items','justify-content'], msg: 'Flex properties require display: flex', sev: 'warning'},
  {props: ['grid-template-columns','grid-template-rows'], msg: 'Grid properties require display: grid', sev: 'warning'},
  {props: ['overflow','overflow-x','overflow-y'], msg: 'Consider using the overflow shorthand', sev: 'hint'},
];

function detectShorthands(styles: Record<string,any>): StyleDiagnostic[] {
  const d: StyleDiagnostic[] = [];
  const m = ['margin-top','margin-right','margin-bottom','margin-left'].filter(p => p in styles);
  if (m.length >= 3) d.push({property: 'margin', severity: 'hint', message: 'Use "margin" shorthand instead of: ' + m.join(', '), suggestion: 'margin'});
  return d;
}

export class StyleAnalyzer {
  private _diagnostics: StyleDiagnostic[] = [];
  analyzeStyle(selector: string, styles: Record<string,any>, _opts?: any): StyleDiagnostic[] {
    const r: StyleDiagnostic[] = [];
    for (const [p, v] of Object.entries(styles)) {
      if (p === 'selectors' || p.startsWith('_') || typeof v === 'object') continue;
      const val = intent.validate(p, String(v));
      if (!val.valid) r.push({property: p, value: String(v), selector, severity: 'warning', message: `"${v}" unrecognized for "${p}"`, suggestion: val.suggestion});
    }
    r.push(...detectShorthands(styles)); this._diagnostics.push(...r);
    const sp = Object.keys(styles).filter(k => typeof styles[k] !== 'object');
    for (const c of CONFLICTS) {
      const ix = c.props.filter(k => sp.includes(k));
      if (ix.length >= 2) r.push({property: c.props.join(', '), selector, severity: c.sev, message: c.msg});
    }
    return r;
  }

  analyze(sd: StyleDefinition): StyleAnalysis {
    const ad: StyleDiagnostic[] = [];
    const sels = sd.selectors || ['&'];
    for (const s of sels) ad.push(...this.analyzeStyle(s, sd));
    if (sd.hover && typeof sd.hover === 'object') for (const s of sels) ad.push(...this.analyzeStyle(s + ':hover', sd.hover as Record<string,any>));
    return {
      diagnostics: ad, conflicts: [],
      breakpoints: [], unusedSelectors: [], deadStyles: [], duplicationWarnings: [], optimizationSuggestions: [],
      stats: {
        totalProperties: Object.keys(sd).filter(k => !['selectors','atRules','nestedRules','hover','themes'].includes(k) && !k.startsWith('_')).length,
        totalSelectors: sels.length,
        shorthandOpportunities: ad.filter(d => d.message.includes('shorthand')).length,
        animationSuggestions: 0,
        responsiveIssues: 0,
      },
    };
  }

  reset(): void { this._diagnostics = []; }
  getDiagnostics(): StyleDiagnostic[] { return [...this._diagnostics]; }
}

export function analyze(sd: StyleDefinition): StyleAnalysis { return new StyleAnalyzer().analyze(sd); }
export function analyzeStyle(sd: StyleDefinition): StyleAnalysis { return new StyleAnalyzer().analyze(sd); }
export default StyleAnalyzer;
