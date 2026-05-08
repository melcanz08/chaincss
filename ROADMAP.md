
## v3.0 Ideas

### 1. Predictive & Self-Healing CSS
- Context-aware typo correction (not just fuzzy matching)
- Intent detection: `display: "flexbox"` → maps to `display: flex` + applies defaults
- Modes: strict (error), dev (auto-fix), smart (fix + log)
- Builds on: suggestions.ts, explain()

### 2. Style Graph Compiler
- Instead of linear compilation, build a dependency graph of styles
- Dead style elimination
- Automatic merging of identical rules
- Predictive pre-compilation
- Order-safe CSS output
- Builds on: compile(), atomic optimizer

### 3. Unit-Aware Math Engine
- Full CSS expression evaluator
- `add("10px", "2rem")` → resolves units → optimized calc()
- `fluidType(14, 20)` → responsive clamp()
- Context-aware scaling
- Builds on: helpers.ts

### 4. IDE Intelligence Layer (VS Code Extension)
- Real-time invalid property detection
- Shorthand translation hints
- Animation suggestion
- Breakpoint inference
- Style conflict detection
- Builds on: suggestions.ts
