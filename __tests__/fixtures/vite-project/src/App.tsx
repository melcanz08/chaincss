import React from 'react';
import { createChain } from 'chaincss';
import { styles } from './styles.chain';

export function App() {
  const headingStyle = createChain()
    .fontSize(32)
    .fontWeight(800)
    .color('#1e293b')
    .marginBottom(16)
    .$el('app-heading');

  const containerStyle = createChain()
    .display('flex')
    .flexDirection('column')
    .gap(24)
    .padding(32)
    .maxWidth(800)
    .margin('0 auto')
    .$el('app-container');

  return (
    <div className={containerStyle.selectors?.[0]}>
      <h1 className={headingStyle.selectors?.[0]}>
        ChainCSS Test App
      </h1>
      <div className={styles.card?.selectors?.[0]}>
        <h2 className={styles.heading?.selectors?.[0]}>
          Welcome
        </h2>
        <p className={styles.text?.selectors?.[0]}>
          This is a test application using ChainCSS.
        </p>
      </div>
    </div>
  );
}