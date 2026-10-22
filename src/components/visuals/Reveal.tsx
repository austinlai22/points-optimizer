import { useEffect, useRef, type ReactNode } from 'react';

// Fades content up as it scrolls into view. Content is visible by default:
// the effect only hides it once JavaScript confirms it can show it again, so
// nothing disappears where IntersectionObserver is missing, and anyone who
// prefers reduced motion gets no animation at all.
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Already on screen: leave it alone rather than flash it out and in.
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    element.classList.add('reveal');
    element.style.transitionDelay = `${delay}ms`;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
