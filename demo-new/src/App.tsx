import React, { useState } from 'react';
import { chain } from 'chaincss';

// Helper: convert chain result to React CSSProperties
function css(c: Record<string, any>): React.CSSProperties {
  const style: Record<string, any> = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === 'selectors' || k.startsWith('_') || k.startsWith('&') || typeof v === 'function') continue;
    style[k] = v;
  }
  return style as React.CSSProperties;
}

// ── STYLES ──
const navStyles = chain()
  .position('fixed').top(0).left(0).right(0).zIndex(1000)
  .backdropFilter('blur(20px)').bg('rgba(15,23,42,0.9)')
  .borderBottom('1px solid rgba(255,255,255,0.08)')
  .$el('nav');

const navInnerStyles = chain()
  .display('flex').alignItems('center').justifyContent('space-between')
  .maxWidth(1200).marginLeft('auto').marginRight('auto').px(24).py(16)
  .$el('nav-inner');

const navLogoStyles = chain()
  .fontSize(22).fontWeight(800)
  .backgroundImage('linear-gradient(90deg, #6366f1, #06b6d4)')
  .WebkitBackgroundClip('text').backgroundClip('text')
  .WebkitTextFillColor('transparent')
  .$el('nav-logo');

const navLinksStyles = chain()
  .display('flex').alignItems('center').gap(32)
  .$el('nav-links');

const navLinkStyles = chain()
  .fontSize(14).fontWeight(500).color('#cbd5e1')
  .transition('color 0.2s ease')
  .hover().color('#ffffff').end()
  .$el('nav-link');

const heroStyles = chain()
  .display('flex').flexDirection('column').alignItems('center').justifyContent('center')
  .minHeight('100vh').pt(80).pb(64).px(24)
  .bg('#0f172a').position('relative').overflow('hidden')
  .$el('hero');

const heroTitleStyles = chain()
  .fontSize('clamp(2.5rem, 6vw, 4.5rem)').fontWeight(800).color('#ffffff')
  .textAlign('center').maxWidth(800).lineHeight(1.1).mb(16)
  .$el('hero-title');

const heroSubtitleStyles = chain()
  .fontSize(18).color('#94a3b8').textAlign('center')
  .maxWidth(600).lineHeight(1.7).mb(32)
  .$el('hero-subtitle');

const btnPrimary = chain()
  .display('inline-flex').alignItems('center').gap(8)
  .px(28).py(14).bg('#6366f1').color('#ffffff')
  .fontSize(16).fontWeight(600).borderRadius(12).border('none').cursor('pointer')
  .transition('all 0.2s ease')
  .hover().bg('#4f46e5').transform('translateY(-2px)').boxShadow('0 10px 25px rgba(99,102,241,0.4)').end()
  .$el('btn-primary');

const btnSecondary = chain()
  .display('inline-flex').alignItems('center').gap(8)
  .px(28).py(14).bg('rgba(255,255,255,0.08)').color('#ffffff')
  .fontSize(16).fontWeight(600).borderRadius(12)
  .border('1px solid rgba(255,255,255,0.15)').cursor('pointer')
  .transition('all 0.2s ease')
  .hover().bg('rgba(255,255,255,0.15)').transform('translateY(-2px)').end()
  .$el('btn-secondary');

const sectionStyles = chain()
  .py(80).px(24).bg('#0f172a')
  .$el('section');

const sectionTitleStyles = chain()
  .fontSize(36).fontWeight(800).color('#ffffff').mb(16)
  .$el('section-title');

const sectionDescStyles = chain()
  .fontSize(18).color('#94a3b8').lineHeight(1.6)
  .$el('section-desc');

const featureGridStyles = chain()
  .display('grid').gridTemplateColumns('repeat(3, 1fr)')
  .gap(24).maxWidth(1200).marginLeft('auto').marginRight('auto')
  .$el('feature-grid');

const featureCardStyles = chain()
  .bg('rgba(255,255,255,0.04)').borderRadius(16).p(32)
  .border('1px solid rgba(255,255,255,0.08)')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-4px)').border('1px solid rgba(99,102,241,0.4)').boxShadow('0 20px 40px rgba(0,0,0,0.3)').end()
  .$el('feature-card');

const featureIconStyles = chain()
  .width(48).height(48).borderRadius('50%').bg('rgba(99,102,241,0.2)')
  .display('flex').alignItems('center').justifyContent('center')
  .fontSize(22).mb(16)
  .$el('feature-icon');

const featureTitleStyles = chain()
  .fontSize(18).fontWeight(600).color('#ffffff').mb(8)
  .$el('feature-title');

const featureDescStyles = chain()
  .fontSize(14).color('#94a3b8').lineHeight(1.6)
  .$el('feature-desc');

const pricingGridStyles = chain()
  .display('grid').gridTemplateColumns('repeat(3, 1fr)')
  .gap(24).maxWidth(1000).marginLeft('auto').marginRight('auto')
  .$el('pricing-grid');

const pricingCardStyles = chain()
  .bg('rgba(255,255,255,0.04)').borderRadius(16).p(32)
  .border('1px solid rgba(255,255,255,0.08)')
  .display('flex').flexDirection('column')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-8px)').border('1px solid rgba(99,102,241,0.4)').end()
  .$el('pricing-card');

const pricingCardFeaturedStyles = chain()
  .bg('rgba(99,102,241,0.1)').borderRadius(16).p(32)
  .border('1px solid rgba(99,102,241,0.4)')
  .display('flex').flexDirection('column').position('relative')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-8px)').end()
  .$el('pricing-card-featured');

const pricingBadgeStyles = chain()
  .display('inline-flex').alignItems('center')
  .px(12).py(4).borderRadius(9999)
  .fontSize(11).fontWeight(700)
  .bg('rgba(99,102,241,0.3)').color('#c7d2fe').mb(16)
  .$el('pricing-badge');

const pricingPlanStyles = chain()
  .fontSize(18).fontWeight(600).color('#ffffff').mb(8)
  .$el('pricing-plan');

const pricingPriceStyles = chain()
  .fontSize(42).fontWeight(800).color('#ffffff').mb(16)
  .$el('pricing-price');

const pricingFeatureStyles = chain()
  .fontSize(14).color('#cbd5e1').py(6)
  .display('flex').alignItems('center').gap(8)
  .$el('pricing-feature');

const footerStyles = chain()
  .bg('#0a0f1a').borderTop('1px solid rgba(255,255,255,0.06)')
  .py(48).px(24)
  .$el('footer');

const footerGridStyles = chain()
  .display('grid').gridTemplateColumns('repeat(4, 1fr)')
  .gap(32).maxWidth(1200).marginLeft('auto').marginRight('auto')
  .$el('footer-grid');

const footerHeadingStyles = chain()
  .fontSize(14).fontWeight(600).color('#ffffff').mb(16)
  .$el('footer-heading');

const footerLinkStyles = chain()
  .fontSize(14).color('#64748b').transition('color 0.2s')
  .display('block').py(4)
  .hover().color('#ffffff').end()
  .$el('footer-link');

// ── DATA ──
const features = [
  { icon: '⚡', title: 'Zero Runtime', desc: 'Static styles compile to plain CSS. No JavaScript shipped for styling.' },
  { icon: '🎯', title: 'Auto Detection', desc: 'Static vs dynamic detected automatically. No manual mode switching.' },
  { icon: '🧩', title: '57 Macros', desc: 'flex(), center(), glass(), pill() — complex CSS as single method calls.' },
  { icon: '🎨', title: 'Design Tokens', desc: 'Themeable with full token resolution system.' },
  { icon: '🔄', title: 'Variant System', desc: 'Type-safe component variants with compound conditions.' },
  { icon: '📱', title: 'Responsive', desc: '20 breakpoints. Mobile-first to feature queries.' },
];

const plans = [
  { name: 'Starter', price: 'Free', features: ['5 components', 'Basic macros', 'Community support'], featured: false },
  { name: 'Pro', price: '$29/mo', features: ['Unlimited components', 'All 57 macros', 'Priority support', 'Atomic CSS', 'Design tokens'], featured: true },
  { name: 'Enterprise', price: '$99/mo', features: ['Everything in Pro', 'Theme contracts', 'SSR support', 'Custom plugins', 'Dedicated support'], featured: false },
];

// ── HOVER CSS INJECTOR ──
// Generates a <style> tag with all :hover rules from chain results
function buildCSS(styles) {
  var css = '';
  for (var _i = 0, _a = Object.values(styles); _i < _a.length; _i++) {
    var obj = _a[_i];
    var sel = obj.selectors ? obj.selectors[0] : null;
    var hover = obj['&:hover'];
    if (sel && hover) {
      var rules = '';
      for (var _b = 0, _c = Object.entries(hover); _b < _c.length; _b++) {
        var _d = _c[_b], k = _d[0], v = _d[1];
        rules += k.replace(/([A-Z])/g, '-$1').toLowerCase() + ': ' + v + ' !important; ';
      }
      css += sel + ':hover { ' + rules + '} ';
    }
  }
  return css;
}

const allStyles = {
  navLink: navLinkStyles,
  btnPrimary, btnSecondary,
  featureCard: featureCardStyles,
  pricingCard: pricingCardStyles,
  pricingCardFeatured: pricingCardFeaturedStyles,
  footerLink: footerLinkStyles,
};

// ── APP ──
console.log("btnPrimary selectors:", btnPrimary.selectors);
console.log("btnPrimary hover:", btnPrimary["&:hover"]);
export function App() {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: (function() { var c = buildCSS(allStyles); console.log("CSS OUTPUT:", c); return c; })() }} />

      {/* NAV */}
      <nav style={css(navStyles)}>
        <div style={css(navInnerStyles)}>
          <span style={css(navLogoStyles)}>ChainCSS</span>
          <div style={css(navLinksStyles)}>
            {['Features', 'Pricing', 'Docs', 'GitHub'].map(item => (
              <a key={item} href="#" style={css(navLinkStyles)}>{item}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={css(heroStyles)}>
        <h1 style={css(heroTitleStyles)}>
          Write Styles Like JavaScript.<br />Ship Zero Runtime.
        </h1>
        <p style={css(heroSubtitleStyles)}>
          ChainCSS auto-detects static vs dynamic styles. CSS where possible, JS where needed.
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button style={css(btnPrimary)}>Get Started →</button>
          <button style={css(btnSecondary)}>View on GitHub</button>
        </div>
      </section>

      {/* FEATURES */}
      <section style={css(sectionStyles)}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
          <h2 style={css(sectionTitleStyles)}>Everything You Need</h2>
          <p style={css(sectionDescStyles)}>550+ features. One JavaScript API. Zero runtime CSS.</p>
        </div>
        <div style={css(featureGridStyles)}>
          {features.map(f => (
            <div key={f.title} style={css(featureCardStyles)}>
              <div style={css(featureIconStyles)}>{f.icon}</div>
              <h3 style={css(featureTitleStyles)}>{f.title}</h3>
              <p style={css(featureDescStyles)}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={css(sectionStyles)}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
          <h2 style={css(sectionTitleStyles)}>Simple Pricing</h2>
          <p style={css(sectionDescStyles)}>Start free, scale as you grow.</p>
        </div>
        <div style={css(pricingGridStyles)}>
          {plans.map(p => (
            <div key={p.name} style={css(p.featured ? pricingCardFeaturedStyles : pricingCardStyles)}>
              {p.featured && <span style={css(pricingBadgeStyles)}>POPULAR</span>}
              <h3 style={css(pricingPlanStyles)}>{p.name}</h3>
              <div style={css(pricingPriceStyles)}>{p.price}</div>
              <div style={{ flex: 1, marginBottom: 24 }}>
                {p.features.map(f => (
                  <div key={f} style={css(pricingFeatureStyles)}>✓ {f}</div>
                ))}
              </div>
              <button style={css(p.featured ? btnPrimary : btnSecondary)}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={css(footerStyles)}>
        <div style={css(footerGridStyles)}>
          <div><h4 style={css(footerHeadingStyles)}>ChainCSS</h4><a href="#" style={css(footerLinkStyles)}>About</a><a href="#" style={css(footerLinkStyles)}>Blog</a></div>
          <div><h4 style={css(footerHeadingStyles)}>Product</h4><a href="#" style={css(footerLinkStyles)}>Features</a><a href="#" style={css(footerLinkStyles)}>Pricing</a></div>
          <div><h4 style={css(footerHeadingStyles)}>Resources</h4><a href="#" style={css(footerLinkStyles)}>Docs</a><a href="#" style={css(footerLinkStyles)}>Examples</a></div>
          <div><h4 style={css(footerHeadingStyles)}>Legal</h4><a href="#" style={css(footerLinkStyles)}>Privacy</a><a href="#" style={css(footerLinkStyles)}>Terms</a></div>
        </div>
      </footer>
    </div>
  );
}
