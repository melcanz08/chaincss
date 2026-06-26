// benchmarks/reporters/markdown-reporter.ts
export class MarkdownReporter {
  generate(results: BenchmarkResult[]): string {
    let report = '# ChainCSS Performance Benchmarks\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `System: ${results[0].systemInfo.node}, ${results[0].systemInfo.cpuCores} cores, ${results[0].systemInfo.memoryGB}GB RAM\n\n`;
    
    // Build Time Comparison
    report += '## Build Time Comparison\n\n';
    report += '| Scenario | ChainCSS | StyleX | Vanilla Extract | Winner |\n';
    report += '|----------|----------|--------|-----------------|--------|\n';
    
    for (const scenario of this.groupByScenario(results)) {
      const chaincss = scenario.find(r => r.compiler === 'chaincss')!;
      const stylex = scenario.find(r => r.compiler === 'stylex');
      const ve = scenario.find(r => r.compiler === 'vanilla-extract');
      
      const times = [chaincss.metrics.compileTime.mean];
      if (stylex) times.push(stylex.metrics.compileTime.mean);
      if (ve) times.push(ve.metrics.compileTime.mean);
      
      const min = Math.min(...times);
      const winner = times[0] === min ? '🏆 ChainCSS' : 
                     times[1] === min ? 'StyleX' : 'Vanilla Extract';
      
      report += `| ${scenario[0].scenario} | ${times[0].toFixed(1)}ms | ${stylex ? times[1].toFixed(1) + 'ms' : '-'} | ${ve ? times[2].toFixed(1) + 'ms' : '-'} | ${winner} |\n`;
    }
    
    // Memory Usage
    report += '\n## Memory Usage (Peak)\n\n';
    report += '| Scenario | ChainCSS | StyleX | Vanilla Extract |\n';
    report += '|----------|----------|--------|-----------------|\n';
    
    // Bundle Size
    report += '\n## Output Size (Gzipped)\n\n';
    report += '| Scenario | ChainCSS CSS | ChainCSS JS | StyleX CSS | StyleX JS | VE CSS | VE JS |\n';
    report += '|----------|-------------|-------------|------------|-----------|--------|-------|\n';
    
    // Pipeline Analysis
    report += '\n## Pipeline Stage Analysis (ChainCSS)\n\n';
    report += '| Stage | Mean Time | % of Total | Features Detected |\n';
    report += '|-------|-----------|------------|-------------------|\n';
    
    const pipelineResults = results.find(r => r.compiler === 'chaincss');
    if (pipelineResults) {
      for (const [pass, stats] of Object.entries(pipelineResults.metrics.passTimings)) {
        const percentage = (stats.mean / pipelineResults.metrics.compileTime.mean * 100).toFixed(1);
        report += `| ${pass} | ${stats.mean.toFixed(2)}ms | ${percentage}% | - |\n`;
      }
    }
    
    // Recommendations
    report += '\n## Performance Recommendations\n\n';
    report += this.generateRecommendations(results);
    
    return report;
  }
  
  private generateRecommendations(results: BenchmarkResult[]): string {
    const chaincss = results.filter(r => r.compiler === 'chaincss');
    const recommendations: string[] = [];
    
    // Find slowest passes
    const slowestPasses = this.findSlowestPasses(chaincss);
    if (slowestPasses.length > 0) {
      recommendations.push(`- Optimize slow passes: ${slowestPasses.join(', ')}`);
    }
    
    // Memory growth
    const memoryGrowth = this.calculateMemoryGrowth(chaincss);
    if (memoryGrowth > 0.5) { // MB per component
      recommendations.push('- Investigate memory optimization opportunities');
    }
    
    return recommendations.join('\n');
  }
}