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

// The heading block at the top of each app page, with an optional picture on
// the right on wide screens.
export function PageIntro({
  title,
  children,
  actions,
  visual,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="overflow-hidden border-b border-navy/10 bg-[radial-gradient(ellipse_at_top_right,#dfe8f3,#ffffff_55%)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-12 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">{title}</h1>
          <div className="mt-4 text-base leading-relaxed text-navy-950/60 sm:text-lg">{children}</div>
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {visual && (
          <div aria-hidden="true" className="hidden shrink-0 lg:block">
            {visual}
          </div>
        )}
      </div>
    </div>
  );
}
