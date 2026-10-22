import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader, type PageName } from './SiteHeader';

// The frame every page shares: the banner, the page, the footer.
export function PageShell({ current, children }: { current: PageName; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-slate-50 focus:px-4 focus:py-2 focus:text-navy"
      >
        Skip to content
      </a>
      <SiteHeader current={current} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

// The heading block at the top of each app page.
export function PageIntro({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border-b border-navy/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-medium tracking-tight text-navy-950 sm:text-4xl">{title}</h1>
            <div className="mt-3 text-base leading-relaxed text-navy-950/65">{children}</div>
          </div>
          {actions}
        </div>
      </div>
    </div>
  );
}
