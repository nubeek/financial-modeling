import { animateSplitLines, animateSplitWords } from "./split-text.js";
import { isStackedLayout, onReady, prefersReducedMotion, whenAllFinished } from "./utils.js";

const INTRO_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
const REVEAL_DURATION = 800;
const REVEAL_STAGGER = 100;
const WORD_STAGGER = 80;
const REVEAL_PHASE_OVERLAP_MS = 400;

const REVEAL_FROM = {
  opacity: 0,
  transform: "translateY(48px)",
  filter: "blur(2px)",
};

const REVEAL_TO = {
  opacity: 1,
  transform: "translateY(0)",
  filter: "blur(0px)",
};

const CARD_REVEAL_FROM = {
  opacity: 0,
  transform: "translateY(73px)",
  filter: "blur(2px)",
};

const CAROUSEL_REVEAL_OFFSET = 73;

const HERO_WORD_OPTIONS = {
  duration: REVEAL_DURATION,
  stagger: WORD_STAGGER,
  fromY: 20,
  fromBlur: 2,
  easing: INTRO_EASING,
  flatWords: true,
  wordClass: "hero__title-word",
};

const HERO_LINE_OPTIONS = {
  duration: REVEAL_DURATION,
  stagger: REVEAL_STAGGER,
  fromY: 48,
  fromBlur: 2,
  easing: INTRO_EASING,
  lineClass: "hero__lead-line",
  lineInnerClass: "hero__lead-line-inner",
  mergeBreak: (node) =>
    isStackedLayout() && node.classList.contains("hero__lead-br--desktop"),
};

function getIntroEndTime(wordCount, lineCount, leadStartDelay) {
  const titleEnd = (wordCount - 1) * WORD_STAGGER + REVEAL_DURATION;
  const leadEnd = leadStartDelay + (lineCount - 1) * REVEAL_STAGGER + REVEAL_DURATION;
  return Math.max(titleEnd, leadEnd);
}

function waitForRevealPhaseTrigger({ wordCount, lineCount, leadStartDelay }) {
  const waitMs = Math.max(
    0,
    getIntroEndTime(wordCount, lineCount, leadStartDelay) - REVEAL_PHASE_OVERLAP_MS
  );

  return new Promise((resolve) => setTimeout(resolve, waitMs));
}

function revealElement(element, { delay = 0 } = {}) {
  if (!element) return Promise.resolve();

  return element
    .animate([REVEAL_FROM, REVEAL_TO], {
      duration: REVEAL_DURATION,
      delay,
      easing: INTRO_EASING,
      fill: "forwards",
    })
    .finished;
}

function revealHeader(header) {
  return header
    .animate(
      [
        { opacity: 0, transform: "translateY(-100%)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: REVEAL_DURATION, easing: INTRO_EASING, fill: "forwards" }
    )
    .finished;
}

function commitHeaderAfterIntro(header) {
  header.getAnimations().forEach((animation) => animation.cancel());
  header.style.opacity = "";
  header.style.transform = "";
}

function getCarouselWrapFinalPadding(wrap) {
  const ring = getComputedStyle(wrap).getPropertyValue("--carousel-actionable-ring").trim();
  return ring || "8px";
}

function revealCarouselWrapPadding(wrap, slideCount) {
  const finalPadding = getCarouselWrapFinalPadding(wrap);
  const totalDuration =
    REVEAL_DURATION + Math.max(0, slideCount - 1) * REVEAL_STAGGER;

  return wrap
    .animate(
      [
        { paddingBottom: `${CAROUSEL_REVEAL_OFFSET}px` },
        { paddingBottom: finalPadding },
      ],
      {
        duration: totalDuration,
        easing: INTRO_EASING,
        fill: "forwards",
      }
    )
    .finished;
}

function commitCarouselWrapAfterIntro(wrap) {
  if (!wrap) return;
  wrap.getAnimations().forEach((animation) => animation.cancel());
  wrap.style.paddingBottom = "";
}

function revealCarouselSlides(slides) {
  const animations = slides.map((slide, index) =>
    slide.animate([CARD_REVEAL_FROM, REVEAL_TO], {
      duration: REVEAL_DURATION,
      delay: index * REVEAL_STAGGER,
      easing: INTRO_EASING,
      fill: "forwards",
    })
  );

  return whenAllFinished(animations);
}

function revealAllImmediately() {
  document.documentElement.removeAttribute("data-page-load");

  document.querySelectorAll(".carousel__slide").forEach((slide) => {
    slide.style.opacity = "";
    slide.style.transform = "";
    slide.style.filter = "";
  });

  commitCarouselWrapAfterIntro(document.querySelector(".hero__carousel-wrap"));

  window.dispatchEvent(new CustomEvent("hero:carousel-reveal-start"));
}

async function runIntroSequence() {
  const title = document.querySelector(".hero__title");
  const leadText = document.querySelector(".hero__lead .p2");
  const leadButton = document.querySelector(".hero__lead .btn");
  const header = document.querySelector(".site-header");
  const slides = [
    ...document.querySelectorAll(".carousel__slide:not([data-carousel-clone])"),
  ];
  const carouselWrap = document.querySelector(".hero__carousel-wrap");

  if (!title || !leadText || !header) {
    revealAllImmediately();
    window.dispatchEvent(new CustomEvent("hero:intro-complete"));
    return;
  }

  if (prefersReducedMotion()) {
    revealAllImmediately();
    window.dispatchEvent(new CustomEvent("hero:intro-complete"));
    return;
  }

  document.documentElement.dataset.pageLoad = "pending";

  title.classList.add("is-split");
  leadText.classList.add("is-split");

  const { wordCount, finished: titleFinished } = animateSplitWords(title, HERO_WORD_OPTIONS);
  const leadStartDelay = Math.max(0, (wordCount - 2) * WORD_STAGGER);
  const { lineCount, finished: leadFinished } = animateSplitLines(leadText, {
    ...HERO_LINE_OPTIONS,
    delay: leadStartDelay,
  });

  await waitForRevealPhaseTrigger({ wordCount, lineCount, leadStartDelay });

  window.dispatchEvent(new CustomEvent("hero:carousel-reveal-start"));

  await Promise.all([
    revealHeader(header),
    revealCarouselSlides(slides),
    carouselWrap ? revealCarouselWrapPadding(carouselWrap, slides.length) : Promise.resolve(),
    leadButton ? revealElement(leadButton) : Promise.resolve(),
    titleFinished,
    leadFinished,
  ]);

  document.documentElement.removeAttribute("data-page-load");
  commitHeaderAfterIntro(header);
  commitCarouselWrapAfterIntro(carouselWrap);

  window.dispatchEvent(new CustomEvent("hero:intro-complete"));
}

onReady(runIntroSequence);

function initHeaderScrollState() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let ticking = false;

  function update() {
    header.classList.toggle("is-scrolled", window.scrollY > 0);
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  update();
}

initHeaderScrollState();
