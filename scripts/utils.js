export const BREAKPOINT_STACKED = 980;

export function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isStackedLayout() {
  return window.matchMedia(`(max-width: ${BREAKPOINT_STACKED}px)`).matches;
}

export function debounce(fn, ms = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function whenAllFinished(animations) {
  if (!animations.length) return Promise.resolve();
  return Promise.all(animations.map((animation) => animation.finished));
}
