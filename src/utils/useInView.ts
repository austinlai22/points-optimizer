import { useEffect, useRef, useState, type RefObject } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// True once the element has scrolled into view, and from then on. Charts use
// it to start their bars at zero and fill them as you reach them. Where
// IntersectionObserver is missing, or the user prefers reduced motion, it is
// true from the start, so bars simply appear at their full size.
export function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined' || prefersReducedMotion(),
  );

  // No dependency list on purpose: the element may only appear on a later
  // render (a chart shown once a balance is entered), so look again each time
  // until it has been seen.
  useEffect(() => {
    if (inView || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  });

  return [ref, inView];
}

// Whether the element is on screen right now, updating both ways. Used for
// the "see the recommendation" shortcut, which hides while it's visible.
export function useOnScreen<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  });

  return [ref, onScreen];
}
