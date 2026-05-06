import React from 'react';
import * as S from './styles.chain';

const features = [
  { icon: '⚡', title: 'Zero Runtime', desc: 'Static styles compile to plain CSS. No JavaScript shipped for styling.' },
  { icon: '🎯', title: 'Auto Detection', desc: 'smartChain() detects static vs dynamic automatically.' },
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

export function App() {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh' }}>
      {/* NAV */}
      <nav className={S.nav.selectors?.[0]}>
        <div className={S.navInner.selectors?.[0]}>
          <span className={S.navLogo.selectors?.[0]}>ChainCSS</span>
          <div className={S.navLinks.selectors?.[0]}>
            {['Features', 'Pricing', 'Docs', 'GitHub'].map(item => (
              <a key={item} href="#" className={S.navLink.selectors?.[0]}>{item}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={S.hero.selectors?.[0]}>
        <h1 className={S.heroTitle.selectors?.[0]}>
          Write Styles Like JavaScript.<br />Ship Zero Runtime.
        </h1>
        <p className={S.heroSubtitle.selectors?.[0]}>
          ChainCSS auto-detects static vs dynamic styles. CSS where possible, JS where needed.
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <button className={S.buttonPrimary.selectors?.[0]}>Get Started →</button>
          <button className={S.buttonSecondary.selectors?.[0]}>View on GitHub</button>
        </div>
      </section>

      {/* FEATURES */}
      <section className={S.section.selectors?.[0]}>
        <div className={S.sectionHeader.selectors?.[0]}>
          <h2 className={S.sectionTitle.selectors?.[0]}>Everything You Need</h2>
          <p className={S.sectionDesc.selectors?.[0]}>550+ features. One JavaScript API. Zero runtime CSS.</p>
        </div>
        <div className={S.featureGrid.selectors?.[0]}>
          {features.map(f => (
            <div key={f.title} className={S.featureCard.selectors?.[0]}>
              <div className={S.featureIcon.selectors?.[0]}>{f.icon}</div>
              <h3 className={S.featureTitle.selectors?.[0]}>{f.title}</h3>
              <p className={S.featureDesc.selectors?.[0]}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className={S.section.selectors?.[0]}>
        <div className={S.sectionHeader.selectors?.[0]}>
          <h2 className={S.sectionTitle.selectors?.[0]}>Simple Pricing</h2>
          <p className={S.sectionDesc.selectors?.[0]}>Start free, scale as you grow.</p>
        </div>
        <div className={S.pricingGrid.selectors?.[0]}>
          {plans.map(p => (
            <div key={p.name} className={(p.featured ? S.pricingCardFeatured : S.pricingCard).selectors?.[0]}>
              {p.featured && <span className={S.pricingBadge.selectors?.[0]}>POPULAR</span>}
              <h3 className={S.pricingPlanName.selectors?.[0]}>{p.name}</h3>
              <div className={S.pricingPrice.selectors?.[0]}>{p.price}</div>
              <div style={{ flex: 1, marginBottom: 24 }}>
                {p.features.map(f => (
                  <div key={f} className={S.pricingFeature.selectors?.[0]}>✓ {f}</div>
                ))}
              </div>
              <button className={(p.featured ? S.buttonPrimary : S.buttonSecondary).selectors?.[0]}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={S.footer.selectors?.[0]}>
        <div className={S.footerGrid.selectors?.[0]}>
          <div>
            <h4 className={S.footerHeading.selectors?.[0]}>ChainCSS</h4>
            <a href="#" className={S.footerLink.selectors?.[0]}>About</a>
            <a href="#" className={S.footerLink.selectors?.[0]}>Blog</a>
          </div>
          <div>
            <h4 className={S.footerHeading.selectors?.[0]}>Product</h4>
            <a href="#" className={S.footerLink.selectors?.[0]}>Features</a>
            <a href="#" className={S.footerLink.selectors?.[0]}>Pricing</a>
          </div>
          <div>
            <h4 className={S.footerHeading.selectors?.[0]}>Resources</h4>
            <a href="#" className={S.footerLink.selectors?.[0]}>Docs</a>
            <a href="#" className={S.footerLink.selectors?.[0]}>Examples</a>
          </div>
          <div>
            <h4 className={S.footerHeading.selectors?.[0]}>Legal</h4>
            <a href="#" className={S.footerLink.selectors?.[0]}>Privacy</a>
            <a href="#" className={S.footerLink.selectors?.[0]}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}