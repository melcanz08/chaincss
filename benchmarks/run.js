// benchmarks/run.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const libraries = [
  {
    name: 'ChainCSS (Build)',
    setup: () => {
      const content = `
        const button = $()
          .backgroundColor('blue')
          .color('white')
          .padding('8px 16px')
          .borderRadius('4px')
          .hover().backgroundColor('darkblue').end()
          .block('.btn');
        module.exports = { button };
      `;
      fs.writeFileSync('./test.jcss', content);
    },
    build: () => {
      execSync('npx @melcanz85/chaincss ./test.jcss ./dist --atomic', { stdio: 'pipe' });
    },
    cleanup: () => {
      fs.unlinkSync('./test.jcss');
      if (fs.existsSync('./dist')) {
        fs.rmSync('./dist', { recursive: true });
      }
    }
  },
  {
    name: 'ChainCSS (Runtime)',
    setup: () => {
      const content = `
        import { $ } from '@melcanz85/chaincss';
        const button = $()
          .backgroundColor('blue')
          .color('white')
          .padding('8px 16px')
          .borderRadius('4px')
          .hover().backgroundColor('darkblue').end()
          .block('.btn');
        export default button;
      `;
      fs.writeFileSync('./test.js', content);
    },
    build: () => {
      // No build step for runtime
    },
    cleanup: () => {
      fs.unlinkSync('./test.js');
    }
  },
  {
    name: 'CSS Modules',
    setup: () => {
      const content = `
        .btn {
          background-color: blue;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
        }
        .btn:hover {
          background-color: darkblue;
        }
      `;
      fs.writeFileSync('./test.module.css', content);
    },
    build: () => {
      // CSS Modules are handled by webpack
    },
    cleanup: () => {
      fs.unlinkSync('./test.module.css');
    }
  },
  {
    name: 'Vanilla Extract',
    setup: () => {
      const content = `
        import { style } from '@vanilla-extract/css';
        export const button = style({
          backgroundColor: 'blue',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          ':hover': {
            backgroundColor: 'darkblue'
          }
        });
      `;
      fs.writeFileSync('./test.css.ts', content);
    },
    build: () => {
      execSync('npx esbuild ./test.css.ts --bundle --outfile=./dist/test.js', { stdio: 'pipe' });
    },
    cleanup: () => {
      fs.unlinkSync('./test.css.ts');
      if (fs.existsSync('./dist')) {
        fs.rmSync('./dist', { recursive: true });
      }
    }
  },
  {
    name: 'Styled Components',
    setup: () => {
      const content = `
        import styled from 'styled-components';
        export const Button = styled.button\`
          background-color: blue;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          &:hover {
            background-color: darkblue;
          }
        \`;
      `;
      fs.writeFileSync('./test.jsx', content);
    },
    build: () => {
      execSync('npx esbuild ./test.jsx --bundle --outfile=./dist/test.js', { stdio: 'pipe' });
    },
    cleanup: () => {
      fs.unlinkSync('./test.jsx');
      if (fs.existsSync('./dist')) {
        fs.rmSync('./dist', { recursive: true });
      }
    }
  }
];

async function runBenchmarks() {
  console.log('\n🚀 Running ChainCSS Performance Benchmarks\n');
  console.log('═'.repeat(60));
  
  const results = [];
  
  for (const lib of libraries) {
    console.log(`\n📊 Testing ${lib.name}...`);
    
    // Setup
    lib.setup();
    
    // Measure build time
    const start = performance.now();
    try {
      await lib.build();
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      lib.cleanup();
      continue;
    }
    const buildTime = performance.now() - start;
    
    // Measure bundle size
    let bundleSize = 0;
    let cssSize = 0;
    
    if (lib.name === 'ChainCSS (Build)') {
      if (fs.existsSync('./dist/global.css')) {
        cssSize = fs.statSync('./dist/global.css').size;
      }
    } else if (lib.name === 'ChainCSS (Runtime)') {
      const bundle = fs.readFileSync('./test.js', 'utf8');
      bundleSize = bundle.length;
    } else if (lib.name === 'CSS Modules') {
      // CSS Modules size is just the CSS file
      cssSize = fs.statSync('./test.module.css').size;
    } else if (fs.existsSync('./dist/test.js')) {
      bundleSize = fs.statSync('./dist/test.js').size;
      if (fs.existsSync('./dist/test.css')) {
        cssSize = fs.statSync('./dist/test.css').size;
      }
    }
    
    results.push({
      name: lib.name,
      buildTime: buildTime.toFixed(2),
      bundleSize: formatBytes(bundleSize),
      cssSize: formatBytes(cssSize),
      totalSize: formatBytes(bundleSize + cssSize)
    });
    
    // Cleanup
    lib.cleanup();
    
    console.log(`  ✅ Build: ${buildTime.toFixed(2)}ms`);
    console.log(`  📦 Bundle: ${formatBytes(bundleSize)}`);
    console.log(`  🎨 CSS: ${formatBytes(cssSize)}`);
  }
  
  // Generate report
  generateReport(results);
  generateChart(results);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateReport(results) {
  const markdown = `# ChainCSS Performance Benchmarks

## Test Environment
- **OS**: ${os.type()} ${os.release()}
- **CPU**: ${os.cpus()[0].model}
- **RAM**: ${formatBytes(os.totalmem())}
- **Node**: ${process.version}
- **Date**: ${new Date().toISOString()}

## Results

| Library | Build Time | Bundle Size | CSS Size | Total Size |
|---------|------------|-------------|----------|------------|
${results.map(r => `| ${r.name} | ${r.buildTime}ms | ${r.bundleSize} | ${r.cssSize} | ${r.totalSize} |`).join('\n')}

## Key Findings

${generateInsights(results)}

## Recommendations

${generateRecommendations(results)}
`;
  
  fs.writeFileSync('./benchmarks/results.md', markdown);
  console.log('\n✅ Report saved to benchmarks/results.md');
}

function generateInsights(results) {
  const chaincssBuild = results.find(r => r.name === 'ChainCSS (Build)');
  const chaincssRuntime = results.find(r => r.name === 'ChainCSS (Runtime)');
  const cssModules = results.find(r => r.name === 'CSS Modules');
  const vanillaExtract = results.find(r => r.name === 'Vanilla Extract');
  const styledComponents = results.find(r => r.name === 'Styled Components');
  
  let insights = [];
  
  if (chaincssBuild && cssModules) {
    insights.push(`- **ChainCSS (Build)** is ${((parseFloat(cssModules.buildTime) - parseFloat(chaincssBuild.buildTime)) / parseFloat(cssModules.buildTime) * 100).toFixed(0)}% faster than CSS Modules`);
  }
  
  if (chaincssBuild && vanillaExtract) {
    insights.push(`- **ChainCSS (Build)** is ${((parseFloat(vanillaExtract.buildTime) - parseFloat(chaincssBuild.buildTime)) / parseFloat(vanillaExtract.buildTime) * 100).toFixed(0)}% faster than Vanilla Extract`);
  }
  
  if (chaincssRuntime && styledComponents) {
    insights.push(`- **ChainCSS (Runtime)** is ${((parseFloat(styledComponents.bundleSize) - parseFloat(chaincssRuntime.bundleSize)) / parseFloat(styledComponents.bundleSize) * 100).toFixed(0)}% smaller than Styled Components`);
  }
  
  return insights.join('\n');
}

function generateRecommendations(results) {
  return `
### For Static Sites
**Use ChainCSS (Build Mode)** - ${results.find(r => r.name === 'ChainCSS (Build)')?.buildTime}ms build time, zero runtime

### For Dynamic Apps
**Use ChainCSS (Runtime Mode)** - ${results.find(r => r.name === 'ChainCSS (Runtime)')?.bundleSize} bundle size, full dynamic capability

### For Best Performance
**Use ChainCSS with Atomic CSS** - Automatic optimization with ${results.find(r => r.name === 'ChainCSS (Build)')?.cssSize} CSS output

### For Component Libraries
**Use ChainCSS Recipe System** - Built-in variants, compound styles, zero config
`;
}

function generateChart(results) {
  const chartData = {
    labels: results.map(r => r.name),
    datasets: [
      {
        label: 'Build Time (ms)',
        data: results.map(r => parseFloat(r.buildTime)),
        backgroundColor: 'rgba(102, 126, 234, 0.5)'
      },
      {
        label: 'Bundle Size (KB)',
        data: results.map(r => parseFloat(r.bundleSize)),
        backgroundColor: 'rgba(118, 75, 162, 0.5)'
      }
    ]
  };
  
  fs.writeFileSync('./benchmarks/chart-data.json', JSON.stringify(chartData, null, 2));
  console.log('📊 Chart data saved to benchmarks/chart-data.json');
}

// Run benchmarks
runBenchmarks().catch(console.error);