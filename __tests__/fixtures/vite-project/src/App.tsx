import React, { useState, useEffect } from 'react';
// Assuming this is your standard runtime or chain builder import
import { chain } from 'chaincss/react'; 

export default function App() {
  // 1. Low-frequency dynamic state (Theme Orchestration)
  const [accentColor, setAccentColor] = useState('#3b82f6');
  
  // 2. High-frequency dynamic state (60fps / Rapid Updates)
  const [cpuUsage, setCpuUsage] = useState(45);
  const [memoryUsage, setMemoryUsage] = useState(60);

  // Simulate a live hardware monitoring loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.floor(Math.random() * 100));
      setMemoryUsage((prev) => Math.min(100, Math.max(10, prev + (Math.random() * 10 - 5))));
    }, 150); // Fast enough to trigger severe style-tag bloat if the injector leaks
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.appLayout}>
      {/* SIDEBAR: Test Bed for Static Class Extraction */}
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>ChainCSS Lab</h2>
        <div className={styles.controlGroup}>
          <label>Test Theme Color</label>
          <input 
            type="color" 
            value={accentColor} 
            onChange={(e) => setAccentColor(e.target.value)} 
          />
        </div>
      </aside>

      {/* MAIN CONTENT: The Hybrid Zone */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1>Mixed-Mode Engine Validator</h1>
        </header>

        <section className={styles.metricsGrid}>
          {/* Card 1: Static Styles */}
          <div className={styles.metricCard}>
            <h3>Static Metric</h3>
            <p className={styles.metricValue}>100% Extractable</p>
          </div>

          {/* Card 2: Low-Frequency Dynamic Style (Accent Theme) */}
          <div 
            className={styles.metricCard}
            style={chain.dynamic().borderColor(accentColor).toStyle()}
          >
            <h3>Theme Variable Card</h3>
            <button 
              style={chain.dynamic().backgroundColor(accentColor).color('#fff').padding('8px 16px').borderRadius('4px').toStyle()}
            >
              Adaptive Button
            </button>
          </div>

          {/* Card 3: High-Frequency Dynamic Style (Progress Bars) */}
          <div className={styles.metricCard}>
            <h3>Live CPU Load</h3>
            <div className={styles.progressTrack}>
              <div 
                // This forces the injector to calculate hashes or apply variables at speed
                style={chain.dynamic()
                  .width(`${cpuUsage}%`)
                  .backgroundColor(cpuUsage > 80 ? '#ef4444' : accentColor)
                  .transition('width 0.1s linear')
                  .height('100%')
                  .toStyle()
                }
              />
            </div>
            <span>{cpuUsage}%</span>
          </div>
        </section>
      </main>
    </div>
  );
}

// --- STYLES COMPILATION LAYER ---
// These are purely static chains that your build pipeline should fully extract out of the JS bundle.
const styles = {
  appLayout: chain.display('flex').minHeight('100vh').backgroundColor('#f3f4f6').toString(),
  sidebar: chain.width('260px').backgroundColor('#1f2937').color('#fff').padding('24px').display('flex').flexDirection('column').gap('16px').toString(),
  sidebarTitle: chain.fontSize('20px').fontWeight('700').marginBottom('12px').toString(),
  controlGroup: chain.display('flex').flexDirection('column').gap('8px').toString(),
  mainContent: chain.flex('1').padding('40px').toString(),
  header: chain.marginBottom('32px').fontSize('28px').fontWeight('8px').toString(),
  metricsGrid: chain.display('grid').gridTemplateColumns('repeat(3, 1fr)').gap('24px').toString(),
  metricCard: chain.backgroundColor('#fff').padding('24px').borderRadius('8px').boxShadow('0 1px 3px rgba(0,0,0,0.1)').display('flex').flexDirection('column').gap('12px').border('2px solid transparent').toString(),
  metricValue: chain.fontSize('24px').fontWeight('700').color('#10b981').toString(),
  progressTrack: chain.width('100%').height('8px').backgroundColor('#e5e7eb').borderRadius('4px').overflow('hidden').toString()
};