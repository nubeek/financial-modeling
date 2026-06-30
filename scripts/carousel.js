const wrap = document.querySelector(".hero__carousel-wrap");
const track = document.querySelector(".carousel");

if (wrap && track) {
  const SPEED = { normal: 0.5, hover: 0.0 };

  function getOriginalSlides() {
    return [...track.querySelectorAll(".carousel__slide:not([data-carousel-clone])")];
  }

  function measure() {
    const slides = getOriginalSlides();
    const style = getComputedStyle(track);
    const gap = parseFloat(style.gap) || 0;
    const slideWidth = slides[0]?.offsetWidth ?? 0;
    const setWidth =
      slides.length * slideWidth + Math.max(0, slides.length - 1) * gap;

    return {
      gap,
      slideWidth,
      setWidth,
      viewportWidth: wrap.clientWidth,
    };
  }

  function canAutoScroll({ setWidth, viewportWidth, slideWidth, gap }) {
    if (!slideWidth || setWidth <= viewportWidth) return false;
    return viewportWidth < setWidth - slideWidth - gap;
  }

  function removeClones() {
    track.querySelectorAll("[data-carousel-clone]").forEach((el) => el.remove());
  }

  function prepareCloneVideos(clone) {
    clone.querySelectorAll("video").forEach((video) => {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play().catch(() => {});
    });
  }

  function appendClones() {
    removeClones();

    for (const slide of getOriginalSlides()) {
      const clone = slide.cloneNode(true);
      clone.dataset.carouselClone = "true";
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      prepareCloneVideos(clone);
      track.appendChild(clone);
    }
  }

  let animating = false;
  let hovered = false;
  let rafId = null;
  let offset = 0;

  function applyTransform() {
    track.style.transform = `translate3d(-${offset}px, 0, 0)`;
  }

  function step() {
    if (!animating) return;

    offset += hovered ? SPEED.hover : SPEED.normal;

    const { setWidth } = measure();
    if (offset >= setWidth) {
      offset -= setWidth;
    }

    applyTransform();
    rafId = requestAnimationFrame(step);
  }

  function stopAnimation() {
    animating = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function applyMode() {
    const metrics = measure();
    const enable = canAutoScroll(metrics);

    if (enable) {
      appendClones();
      const { setWidth } = measure();
      if (offset >= setWidth) {
        offset %= setWidth;
      }
      wrap.classList.add("hero__carousel-wrap--auto");
      track.classList.add("carousel--auto");
      window.dispatchEvent(new CustomEvent("carousel:updated"));

      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(step);
      }
    } else {
      stopAnimation();
      removeClones();
      offset = 0;
      track.style.transform = "";
      wrap.classList.remove("hero__carousel-wrap--auto");
      track.classList.remove("carousel--auto");
    }
  }

  wrap.addEventListener("mouseenter", () => {
    hovered = true;
  });

  wrap.addEventListener("mouseleave", () => {
    hovered = false;
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMode, 100);
  });

  function tryStart() {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyMode();
    }
  }

  if (document.documentElement.dataset.deferCarousel === "true") {
    window.addEventListener("hero:carousel-reveal-start", tryStart, { once: true });
  } else {
    tryStart();
  }
}
