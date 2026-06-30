const INTRO_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
const REVEAL_DURATION = 800;
const REVEAL_STAGGER = 100;
const WORD_STAGGER = 80;

const REVEAL_FROM = {
  opacity: 0,
  transform: "translateY(48px)",
  filter: "blur(2px)",
};

const TITLE_REVEAL_FROM = {
  opacity: 0,
  transform: "translateY(20px)",
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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function whenAllFinished(animations) {
  if (!animations.length) return Promise.resolve();
  return Promise.all(animations.map((animation) => animation.finished));
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

function wrapTitleWords(title) {
  const words = [];

  function processTextNode(node) {
    const parts = node.textContent.split(/(\s+)/);
    const fragment = document.createDocumentFragment();

    parts.forEach((part) => {
      if (!part) return;

      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }

      const span = document.createElement("span");
      span.className = "hero__title-word";
      span.textContent = part;
      words.push(span);
      fragment.appendChild(span);
    });

    node.replaceWith(fragment);
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      [...node.childNodes].forEach(walk);
    }
  }

  [...title.childNodes].forEach(walk);
  return words;
}

function revealWords(words, { stagger = WORD_STAGGER } = {}) {
  const animations = words.map((word, index) =>
    word.animate([TITLE_REVEAL_FROM, REVEAL_TO], {
      duration: REVEAL_DURATION,
      delay: index * stagger,
      easing: INTRO_EASING,
      fill: "forwards",
    })
  );

  return whenAllFinished(animations);
}

function wrapLeadLines(leadText) {
  const segments = [];
  let current = [];

  [...leadText.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
      if (current.length) segments.push(current);
      current = [];
      return;
    }

    current.push(node);
  });

  if (current.length) segments.push(current);

  const lines = [];
  leadText.replaceChildren();

  segments.forEach((nodes) => {
    const line = document.createElement("span");
    line.className = "hero__lead-line";
    const inner = document.createElement("span");
    inner.className = "hero__lead-line-inner";
    nodes.forEach((node) => inner.appendChild(node));
    line.appendChild(inner);
    leadText.appendChild(line);
    lines.push(inner);
  });

  return lines;
}

function revealLines(lines, { stagger = REVEAL_STAGGER, baseDelay = 0 } = {}) {
  const animations = lines.map((line, index) =>
    line.animate([REVEAL_FROM, REVEAL_TO], {
      duration: REVEAL_DURATION,
      delay: baseDelay + index * stagger,
      easing: INTRO_EASING,
      fill: "forwards",
    })
  );

  return whenAllFinished(animations);
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

  const titleWords = wrapTitleWords(title);
  title.classList.add("is-split");
  const leadLines = wrapLeadLines(leadText);
  leadText.classList.add("is-split");

  const leadStartDelay = Math.max(0, (titleWords.length - 2) * WORD_STAGGER);

  await Promise.all([
    revealWords(titleWords),
    revealLines(leadLines, { baseDelay: leadStartDelay }),
  ]);

  window.dispatchEvent(new CustomEvent("hero:carousel-reveal-start"));

  await Promise.all([
    revealHeader(header),
    revealCarouselSlides(slides),
    leadButton ? revealElement(leadButton) : Promise.resolve(),
  ]);

  document.documentElement.removeAttribute("data-page-load");
  commitHeaderAfterIntro(header);

  window.dispatchEvent(new CustomEvent("hero:intro-complete"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runIntroSequence, { once: true });
} else {
  runIntroSequence();
}

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
