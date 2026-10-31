# Known Issues in the v2.15.19 Baseline

These are facts about the current compiler/auditor, discovered while
capturing the baseline. They are not bugs to hide; they are parity
obligations the ALGOL26 port must either reproduce or consciously
diverge from.

## 1. `check` is an audit pass, not a build pass

All four corpus entries currently return `check_exit=1`, even those
whose `build_exit=0`. This is correct behavior -- `check` runs
accessibility, contrast, motion, and CSS value validation, none of
which are part of `build`.

`build` and `check` can disagree: e.g. `003-lenient-passthrough`
compiles cleanly (`display:12345px;unknown-property:nope;`) but
`check` flags `Unknown CSS value "nope"` as an error.

## 2. Stack overflow on `.card` with nested `&:hover`

`001-card/src/card.chain.ts` triggers:

    Maximum call stack size exceeded

inside the audit path, when the rule has a nested `&:hover` block.
Likely a recursive walk in the layout/responsive analyzer.

The audit reports this as a diagnostic rather than crashing, which
is graceful, but it is a real defect: a four-line rule should not
recurse infinitely.

Parity implication for ALGOL26: reproduce the audit output as-is, or
fix it and accept that `001-card`'s audit will diverge from the TS
baseline.

## 3. `001-card` audit output is not clean

Even ignoring the stack overflow, `001-card` produces:

- warning: `.card` has `:hover` but no `:focus-visible` fallback
- info: no `transition` on the `:hover` rule

These are real accessibility findings. The baseline should not be
"silenced" to hide them.

## 4. Emitter normalization policies

Discovered from `003-lenient-passthrough` build output:

- `translateY` is emitted as lowercase `translatey`
- bare numbers in CSS fields become `Npx` (`display: 12345` -> `display:12345px`)
- camelCase field names are unconditionally kebab-cased
  (`unknownProperty` -> `unknown-property`)

The ALGOL26 port must reproduce all three for parity.
