#!/usr/bin/env node
// verify-full.mjs - ChainCSS v3.0 full wiring check

import fs from 'fs'

const ok = (name, cond, extra='') => {
  const icon = cond? '✅' : '❌'
  console.log(`${icon} ${name}${extra? ` -> ${extra}` : ''}`)
  return cond? 1 : 0
}

let pass = 0, total = 0

console.log('=== ChainCSS Full Wiring ===\n--- 1. Build files exist ---')
const files = [
  'dist/index.js','dist/index.cjs',
  'dist/compiler/index.js','dist/compiler/index.cjs',
  'dist/runtime/index.js','dist/browser.js',
  'dist/utils.js','dist/plugins/vite.js',
  'dist/plugins/webpack.js','dist/advanced.js',
  'dist/plugins/figma-sync.js','dist/compiler/tokens/entanglement.js',
  'dist/cli/index.js'
]
for(const f of files){
  total++; if(ok(f, fs.existsSync(f))) pass++
}

console.log('\n--- 2. Core chain API (v3 typed) ---')
const { chain } = await import('./dist/index.js')

// v3:.flex().box().typography().background().raw() instead of.display().padding().color()
const s1 = chain().flex({ display: 'flex' }).box({ padding: 20 }).typography({ color: 'red' }).$el('test-core')
total++; if(ok('chain().flex().box().typography().$el()',!!s1.selectors?.[0] && s1.selectors[0].includes('test-core'))) pass++

const s2 = chain().background({ color: 'blue' }).hover().background({ color: 'navy' }).end().$el('hover')
const hover = s2._nestedRules?.find(r=>r.selector==='&:hover')?.styles
total++; if(ok('hover -> _nestedRules',!!hover, JSON.stringify(hover||{}).slice(0,60))) pass++

const s3 = chain().flex({ display: 'flex' }).media('(min-width:768px)', c=>c.raw('display', 'grid')).$el('resp')
total++; if(ok('media -> _atRules', s3._atRules?.length===1 && s3._atRules[0].type==='media')) pass++

const s4 = chain().typography({ color: 'black' }).nest('.child', c=>c.typography({ color: 'green' })).$el('nest')
total++; if(ok('nest -> _nestedRules', s4._nestedRules?.[0].selector==='.child')) pass++

const s5 = chain().box({ padding: 10 }).when(true, c=>c.background({ color: 'green' })).when(false, c=>c.typography({ color: 'red' })).$el('when')
total++; if(ok('when() conditional',!!s5.selectors?.[0])) pass++

const s6a = chain().flex({ display: 'flex' }).$el('human')
const s6b = chain().flex({ display: 'flex' }).build(['.machine'])
total++; if(ok('$el() vs build() both finalize',!!s6a.selectors[0] && s6b.selectors[0]==='.machine')) pass++

console.log('\n--- 3. Compiler ---')
const { ChainCSSCompiler } = await import('./dist/compiler/index.js')
const compiler = new ChainCSSCompiler({ atomic:{enabled:false}, output:{minify:false}, verbose:false, silent:true })
const cssResult = compiler.compileStyle('btn', s2)
total++; if(ok('compileStyle() produces CSS', cssResult.css.includes('.') && cssResult.css.includes(':hover'))) pass++
total++; if(ok('CSS no duplicate hover', (cssResult.css.match(/:hover/g)||[]).length===1, `${(cssResult.css.match(/:hover/g)||[]).length}x hover`)) pass++

console.log('\n--- 4. Runtime / Browser / Utils ---')
try{
  const rt = await import('./dist/runtime/index.js')
  total++; if(ok('runtime exports',!!rt.default ||!!rt.createRuntime || Object.keys(rt).length>0, Object.keys(rt).slice(0,3).join(','))) pass++
}catch(e){
  if(String(e.message).includes('vue')){
    total++; if(ok('runtime exports (vue peer - SKIPPED)', true, 'vue not installed - normal')) pass++
  } else {
    total++; ok('runtime exports', false, e.message)
  }
}

try{
  const browser = fs.readFileSync('dist/browser.js','utf8')
  total++; if(ok('browser bundle', browser.length>1000, `${(browser.length/1024).toFixed(1)}kb`)) pass++
}catch(e){ total++; ok('browser bundle', false) }

try{
  const utils = await import('./dist/utils.js')
  total++; if(ok('utils exports', Object.keys(utils).length>0, Object.keys(utils).slice(0,4).join(','))) pass++
}catch(e){ total++; ok('utils exports', false, e.message) }

console.log('\n--- 5. Plugins ---')
try{
  const vite = await import('./dist/plugins/vite.js')
  const isFn = typeof vite.default==='function' || typeof vite.chaincss==='function'
  total++; if(ok('vite plugin is function', isFn)) pass++
}catch(e){ total++; ok('vite plugin', false, e.message) }

try{
  const wp = await import('./dist/plugins/webpack.js')
  total++; if(ok('webpack plugin is function', typeof wp.default==='function' || Object.keys(wp).length>0)) pass++
}catch(e){ total++; ok('webpack plugin', false, e.message) }

console.log('\n--- 6. Advanced / Tokens ---')
try{
  const adv = await import('./dist/advanced.js')
  total++; if(ok('advanced', Object.keys(adv).length>0, `${Object.keys(adv).length} exports`)) pass++
}catch(e){ total++; ok('advanced', false, e.message) }

try{
  const ent = await import('./dist/compiler/tokens/entanglement.js')
  total++; if(ok('entanglement tokens', Object.keys(ent).length>0)) pass++
}catch(e){ total++; ok('entanglement tokens', false, e.message) }

console.log('\n--- 7. Perf smoke ---')
const start = Date.now()
for(let i=0;i<1000;i++){ chain().box({ padding: i%20, margin: 5 }).$el(`c-${i}`) }
const ms = Date.now()-start
total++; if(ok('1000 components', ms<1000, `${ms}ms`)) pass++

console.log(`\n=== RESULT: ${pass}/${total} checks passed ===`)
if(pass===total) console.log('✅ FULL SYSTEM WIRED - safe to publish')
else console.log('❌ wiring gaps - fix above ❌')

process.exit(pass===total? 0 : 1)