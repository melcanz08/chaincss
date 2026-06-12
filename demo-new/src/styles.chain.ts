import { chain } from 'chaincss';

// ── NAVIGATION ──
export const nav = chain()
  .fixed({ top: 0, left: 0, right: 0 })
  .zIndex(1000)
  .backdropFilter('blur(20px)')
  .bg('rgba(15,23,42,0.9)')
  .borderBottom('1px solid rgba(255,255,255,0.08)')
  .$el('nav');

export const navInner = chain()
  .display('flex').items('center').justify('space-between')
  .maxW(1200).mx('auto').px(24).py(16)
  .$el('nav-inner');

export const navLogo = chain()
  .fs(22).fw(800)
  .textGradient(['#6366f1', '#06b6d4'])
  .$el('nav-logo');

export const navLinks = chain()
  .display('flex').items('center').gap(32)
  .$el('nav-links');

export const navLink = chain()
  .fs(14).fw(500).color('#cbd5e1')
  .transition('color 0.2s ease')
  .hover().color('#ffffff').end()
  .$el('nav-link');

// ── HERO ──
export const hero = chain()
  .display('flex').flexDir('column').items('center').justify('center')
  .minH('100vh').pt(80).pb(64).px(24)
  .bg('#0f172a').pos('relative').ov('hidden')
  .$el('hero');

export const heroTitle = chain()
  .fs('clamp(2.5rem, 6vw, 4.5rem)').fw(800).color('#ffffff')
  .align('center').maxW(800).lh(1.1).mb(16)
  .$el('hero-title');

export const heroSubtitle = chain()
  .fs(18).color('#94a3b8').align('center')
  .maxW(600).lh(1.7).mb(32)
  .$el('hero-subtitle');

// ── BUTTONS ──
export const buttonPrimary = chain()
  .display('inline-flex').items('center').gap(8)
  .px(28).py(14).bg('#6366f1').color('#ffffff')
  .fs(16).fw(600).rounded(12).border('none').cursor('pointer')
  .transition('all 0.2s ease')
  .hover().bg('#4f46e5').transform('translateY(-2px)').shadow('0 10px 25px rgba(99,102,241,0.4)').end()
  .$el('btn-primary');

export const buttonSecondary = chain()
  .display('inline-flex').items('center').gap(8)
  .px(28).py(14).bg('rgba(255,255,255,0.08)').color('#ffffff')
  .fs(16).fw(600).rounded(12)
  .border('1px solid rgba(255,255,255,0.15)').cursor('pointer')
  .transition('all 0.2s ease')
  .hover().bg('rgba(255,255,255,0.15)').transform('translateY(-2px)').end()
  .$el('btn-secondary');

// ── FEATURES SECTION ──
export const section = chain()
  .py(80).px(24).bg('#0f172a')
  .$el('section');

export const sectionHeader = chain()
  .align('center').maxW(600).mx('auto').mb(48)
  .$el('section-header');

export const sectionTitle = chain()
  .fs(36).fw(800).color('#ffffff').mb(16)
  .$el('section-title');

export const sectionDesc = chain()
  .fs(18).color('#94a3b8').lh(1.6)
  .$el('section-desc');

export const featureGrid = chain()
  .display('grid').gridTemplateColumns('repeat(3, 1fr)')
  .gap(24).maxW(1200).mx('auto')
  .$el('feature-grid');

export const featureCard = chain()
  .bg('rgba(255,255,255,0.04)').rounded(16).p(32)
  .border('1px solid rgba(255,255,255,0.08)')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-4px)').border('1px solid rgba(99,102,241,0.4)').shadow('0 20px 40px rgba(0,0,0,0.3)').end()
  .$el('feature-card');

export const featureIcon = chain()
  .circle(48).bg('rgba(99,102,241,0.2)')
  .display('flex').items('center').justify('center')
  .fs(22).mb(16)
  .$el('feature-icon');

export const featureTitle = chain()
  .fs(18).fw(600).color('#ffffff').mb(8)
  .$el('feature-title');

export const featureDesc = chain()
  .fs(14).color('#94a3b8').lh(1.6)
  .$el('feature-desc');

// ── PRICING ──
export const pricingGrid = chain()
  .display('grid').gridTemplateColumns('repeat(3, 1fr)')
  .gap(24).maxW(1000).mx('auto')
  .$el('pricing-grid');

export const pricingCard = chain()
  .bg('rgba(255,255,255,0.04)').rounded(16).p(32)
  .border('1px solid rgba(255,255,255,0.08)')
  .display('flex').flexDir('column')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-8px)').border('1px solid rgba(99,102,241,0.4)').end()
  .$el('pricing-card');

export const pricingCardFeatured = chain()
  .bg('rgba(99,102,241,0.1)').rounded(16).p(32)
  .border('1px solid rgba(99,102,241,0.4)')
  .display('flex').flexDir('column').pos('relative')
  .transition('all 0.3s ease')
  .hover().transform('translateY(-8px)').end()
  .$el('pricing-card-featured');

export const pricingBadge = chain()
  .pill().fs(11).fw(700)
  .bg('rgba(99,102,241,0.3)').color('#c7d2fe').mb(16)
  .$el('pricing-badge');

export const pricingPlanName = chain()
  .fs(18).fw(600).color('#ffffff').mb(8)
  .$el('pricing-plan-name');

export const pricingPrice = chain()
  .fs(42).fw(800).color('#ffffff').mb(16)
  .$el('pricing-price');

export const pricingFeature = chain()
  .fs(14).color('#cbd5e1').py(6)
  .display('flex').items('center').gap(8)
  .$el('pricing-feature');

// ── FOOTER ──
export const footer = chain()
  .bg('#0a0f1a').borderT('1px solid rgba(255,255,255,0.06)')
  .py(48).px(24)
  .$el('footer');

export const footerGrid = chain()
  .display('grid').gridTemplateColumns('repeat(4, 1fr)')
  .gap(32).maxW(1200).mx('auto')
  .$el('footer-grid');

export const footerHeading = chain()
  .fs(14).fw(600).color('#ffffff').mb(16)
  .$el('footer-heading');

export const footerLink = chain()
  .fs(14).color('#64748b').transition('color 0.2s')
  .display('block').py(4)
  .hover().color('#ffffff').end()
  .$el('footer-link');
