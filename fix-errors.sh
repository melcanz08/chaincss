#!/bin/bash

# Fix Chain.ts - remove duplicate container method
sed -i '/private container(maxWidth: string | number = .1200px.): this {/,/^  }/d' src/compiler/Chain.ts

# Fix helpers.ts - add missing toPx and toRem
echo 'export const toPx = (v: number | string) => typeof v === "number" ? `${v}px` : v;' >> src/compiler/helpers.ts
echo 'export const toRem = (v: number | string) => typeof v === "number" ? `${v/16}rem` : v;' >> src/compiler/helpers.ts

# Fix animations.ts - add missing name property
sed -i 's/export const DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig> = {/export const DEFAULT_ANIMATION_CONFIG: Required<AnimationConfig> = {\n  name: "",/' src/compiler/animations.ts

echo "Fixes applied. Run npm run build again."
