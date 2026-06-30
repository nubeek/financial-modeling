const SPREAD_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
const SPREAD_DURATION = 900;
const SPREAD_STAGGER = 60;

const STACKED = { transform: "translate(0, 0) rotate(0deg)" };

const PAPERS = [
  {
    selector: ".problem__paper--left",
    spread: { transform: "translate(-92px, -28px) rotate(-13deg)" },
    spreadMobile: { transform: "translate(-64px, -18px) rotate(-12deg)" },
  },
  {
    selector: ".problem__paper--right",
    spread: { transform: "translate(88px, 32px) rotate(13deg)" },
    spreadMobile: { transform: "translate(60px, 22px) rotate(12deg)" },
  },
  {
    selector: ".problem__paper--center",
    spread: { transform: "translate(0, 0) rotate(0deg)" },
    spreadMobile: { transform: "translate(0, 0) rotate(0deg)" },
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobileSpread() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function getSpreadTarget(paper) {
  return isMobileSpread() ? paper.spreadMobile : paper.spread;
}

function spreadImmediately(container) {
  container.classList.add("is-spread");
}

function animateSpread(container) {
  if (container.dataset.spreadState === "done") return;

  container.dataset.spreadState = "animating";

  const animations = PAPERS.map((paper, index) => {
    const element = container.querySelector(paper.selector);
    if (!element) return null;

    return element.animate([STACKED, getSpreadTarget(paper)], {
      duration: SPREAD_DURATION,
      delay: index * SPREAD_STAGGER,
      easing: SPREAD_EASING,
      fill: "forwards",
    });
  }).filter(Boolean);

  Promise.all(animations.map((animation) => animation.finished))
    .then(() => {
      container.classList.add("is-spread");
      container.dataset.spreadState = "done";
    })
    .catch(() => {
      spreadImmediately(container);
      container.dataset.spreadState = "done";
    });
}

function initProblemPapers() {
  const container = document.querySelector("[data-problem-papers]");
  if (!container) return;

  if (prefersReducedMotion()) {
    spreadImmediately(container);
    container.dataset.spreadState = "done";
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateSpread(container);
        observer.disconnect();
      });
    },
    {
      threshold: 0.35,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  observer.observe(container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProblemPapers, { once: true });
} else {
  initProblemPapers();
}
