import { debounce, isStackedLayout, onReady, prefersReducedMotion } from "./utils.js";

function initSolutionFeatures() {
  const showcase = document.querySelector(".solution__showcase");
  if (!showcase) return;

  const frameShell = showcase.querySelector(".solution__iframe-shell");
  const frame = showcase.querySelector(".solution__iframe");
  const features = [...showcase.querySelectorAll(".solution__feature")];
  const thumb = showcase.querySelector(".solution__features-indicator-thumb");
  const track = showcase.querySelector(".solution__features-indicator-track");
  const indicator = showcase.querySelector(".solution__features-indicator");
  const list = showcase.querySelector(".solution__features-list");
  const FRAME_WIDTH = 1440;
  const FRAME_HEIGHT = 960;
  const SECURE_ZOOM = 1.54;
  const DEMO_CAMERA_DEFAULT_FOCUS = 0.5;
  const AUTO_ADVANCE_DELAY_MS = 2000;
  const EMBED_ANIMATIONS_TIMEOUT_MS = 60000;
  let currentVisual = "comprehensive";
  let demoCamera = null;
  let activeIndex = 0;
  let autoAdvanceRunId = 0;
  let autoAdvanceTimer = null;
  let embedWaitTimer = null;
  let embedCompleteWaiter = null;
  let embedAnimationsPendingComplete = false;
  let stepAnimationsComplete = false;
  let isSectionVisible = false;
  let appliedFrameTransform = null;

  function setVisual(type) {
    const previousVisual = currentVisual;
    currentVisual = type || "comprehensive";
    if (frameShell) frameShell.dataset.visual = currentVisual;
    if (currentVisual !== "interactive") {
      demoCamera = null;
      frameShell?.removeAttribute("data-demo-camera");
      syncFrameScale();
    } else if (previousVisual !== "interactive") {
      // Keep the previous framing until the iframe posts the inputs camera,
      // so we don't flash the zoomed-out view between secure and interactive.
    } else {
      syncFrameScale();
    }

    const embedApi = frame?.contentWindow?.solutionEmbed;
    if (embedApi?.setFeature) {
      embedApi.setFeature(currentVisual);
      return;
    }

    frame?.contentWindow?.postMessage(
      { type: "solution-embed-feature", feature: currentVisual },
      window.location.origin
    );
  }

  function syncFrameScale() {
    if (!frameShell) return;

    const { width, height } = frameShell.getBoundingClientRect();
    if (!width || !height) return;

    const baseScale = Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT);
    const zoom = demoCamera?.zoom ?? (currentVisual === "secure" ? SECURE_ZOOM : 1);
    const scale = baseScale * zoom;
    const targetRect = demoCamera?.rect;
    const focusX = demoCamera?.focusX ?? DEMO_CAMERA_DEFAULT_FOCUS;
    const focusY = demoCamera?.focusY ?? DEMO_CAMERA_DEFAULT_FOCUS;
    const targetCenterX = targetRect ? targetRect.left + targetRect.width * focusX : FRAME_WIDTH / 2;
    const targetCenterY = targetRect ? targetRect.top + targetRect.height * focusY : FRAME_HEIGHT / 2;
    const left = width / 2 - targetCenterX * scale;
    const top = height / 2 - targetCenterY * scale;
    const scaleValue = scale.toFixed(5);
    const leftValue = `${left.toFixed(2)}px`;
    const topValue = `${top.toFixed(2)}px`;
    const nextTransform = { scale: scaleValue, left: leftValue, top: topValue };

    if (
      appliedFrameTransform &&
      appliedFrameTransform.scale === nextTransform.scale &&
      appliedFrameTransform.left === nextTransform.left &&
      appliedFrameTransform.top === nextTransform.top
    ) {
      return;
    }

    appliedFrameTransform = nextTransform;
    frameShell.style.setProperty("--solution-ui-scale", scaleValue);
    frameShell.style.setProperty("--solution-ui-left", leftValue);
    frameShell.style.setProperty("--solution-ui-top", topValue);
  }

  function setDemoCamera(camera) {
    if (!frameShell || currentVisual !== "interactive") return;

    if (!camera || camera.stage === "default") {
      demoCamera = null;
      frameShell.removeAttribute("data-demo-camera");
    } else {
      demoCamera = camera;
      frameShell.dataset.demoCamera = camera.stage || "active";
    }

    syncFrameScale();
  }

  function syncIndicatorTrack() {
    if (!frameShell || !track || !indicator) return;

    if (isStackedLayout()) {
      track.style.height = "";
      track.style.top = "";
      return;
    }

    const stackRect = frameShell.getBoundingClientRect();
    const indicatorRect = indicator.getBoundingClientRect();

    track.style.height = `${stackRect.height}px`;
    track.style.top = `${stackRect.top - indicatorRect.top}px`;
  }

  function applyIndicator(index) {
    if (!thumb || !list || index < 0) return;

    const activeFeature = features[index];
    if (!activeFeature) return;

    const listRect = list.getBoundingClientRect();
    const featureRect = activeFeature.getBoundingClientRect();

    thumb.style.top = `${featureRect.top - listRect.top}px`;
    thumb.style.height = `${featureRect.height}px`;
    syncIndicatorTrack();
  }

  function setActive(index, { animate = true, fromAutoPlay = false } = {}) {
    embedAnimationsPendingComplete = false;
    stepAnimationsComplete = false;

    if (!fromAutoPlay) {
      cancelAutoAdvance();
    }

    activeIndex = index;

    if (!animate) {
      list?.classList.add("is-instant");
    }

    features.forEach((feature, i) => {
      const active = i === index;
      const body = feature.querySelector(".solution__feature-body");

      feature.classList.toggle("is-active", active);
      feature.setAttribute("aria-selected", String(active));
      feature.setAttribute("aria-expanded", String(active));
      if (body) {
        body.setAttribute("aria-hidden", String(!active));
      }
    });

    setVisual(features[index].dataset.visual);

    requestAnimationFrame(() => {
      applyIndicator(index);
      if (!animate) {
        requestAnimationFrame(() => list?.classList.remove("is-instant"));
      }
    });
  }

  function cancelAutoAdvance() {
    autoAdvanceRunId += 1;
    clearTimeout(autoAdvanceTimer);
    clearTimeout(embedWaitTimer);
    autoAdvanceTimer = null;
    embedWaitTimer = null;
    embedCompleteWaiter = null;
  }

  function resolveEmbedCompleteWaiter() {
    if (embedCompleteWaiter) {
      clearTimeout(embedWaitTimer);
      embedWaitTimer = null;
      const resolve = embedCompleteWaiter;
      embedCompleteWaiter = null;
      resolve(true);
      return;
    }

    embedAnimationsPendingComplete = true;
  }

  function waitForEmbedAnimationsComplete(runId) {
    return new Promise((resolve) => {
      if (runId !== autoAdvanceRunId) {
        resolve(false);
        return;
      }

      if (embedAnimationsPendingComplete) {
        embedAnimationsPendingComplete = false;
        resolve(true);
        return;
      }

      embedCompleteWaiter = resolve;
      embedWaitTimer = setTimeout(() => {
        if (runId !== autoAdvanceRunId || embedCompleteWaiter !== resolve) return;
        embedCompleteWaiter = null;
        embedWaitTimer = null;
        resolve(true);
      }, EMBED_ANIMATIONS_TIMEOUT_MS);
    });
  }

  async function waitForParentAnimations() {
    if (prefersReducedMotion()) return;

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const elements = [list, thumb, frame, ...features].filter(Boolean);
    const animations = elements.flatMap((element) => {
      try {
        return element.getAnimations({ subtree: element === list });
      } catch {
        return [];
      }
    });

    if (!animations.length) return;

    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  }

  function pauseAutoAdvance() {
    cancelAutoAdvance();
  }

  function canAutoAdvance() {
    return isSectionVisible;
  }

  function resumeAutoAdvance() {
    if (!canAutoAdvance()) return;
    beginAutoAdvanceCycle();
  }

  async function waitAndScheduleNextAdvance() {
    const runId = autoAdvanceRunId;

    if (!canAutoAdvance()) return;

    if (!stepAnimationsComplete) {
      const embedReady = await waitForEmbedAnimationsComplete(runId);
      if (!embedReady || runId !== autoAdvanceRunId || !canAutoAdvance()) return;

      await waitForParentAnimations();
      if (runId !== autoAdvanceRunId || !canAutoAdvance()) return;

      stepAnimationsComplete = true;
    }

    autoAdvanceTimer = setTimeout(() => {
      if (runId !== autoAdvanceRunId || !canAutoAdvance()) return;
      setActive((activeIndex + 1) % features.length, { fromAutoPlay: true });
      void waitAndScheduleNextAdvance();
    }, AUTO_ADVANCE_DELAY_MS);
  }

  function beginAutoAdvanceCycle() {
    if (!canAutoAdvance()) return;

    cancelAutoAdvance();
    void waitAndScheduleNextAdvance();
  }

  function initSectionVisibility() {
    const section = document.getElementById("solution") || showcase.closest(".solution");
    if (!section || typeof IntersectionObserver === "undefined") {
      isSectionVisible = true;
      beginAutoAdvanceCycle();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isSectionVisible = entry.isIntersecting;

        if (isSectionVisible) {
          resumeAutoAdvance();
        } else {
          pauseAutoAdvance();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
  }

  features.forEach((feature, index) => {
    feature.addEventListener("click", () => {
      if (feature.classList.contains("is-active")) return;
      setActive(index);
      beginAutoAdvanceCycle();
    });
  });

  const handleResize = debounce(() => {
    applyIndicator(activeIndex);
  });

  window.addEventListener("resize", handleResize);

  if (typeof ResizeObserver !== "undefined") {
    const shellObserver = new ResizeObserver(() => {
      syncFrameScale();
    });
    const listObserver = new ResizeObserver(() => {
      applyIndicator(activeIndex);
      syncIndicatorTrack();
    });
    if (frameShell) shellObserver.observe(frameShell);
    if (list) listObserver.observe(list);
  }

  frame?.addEventListener("load", () => {
    syncFrameScale();
    setVisual(currentVisual);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;

    if (event.data?.type === "solution-embed-demo-camera") {
      setDemoCamera(event.data.camera);
      return;
    }

    if (event.data?.type === "solution-embed-animations-complete") {
      resolveEmbedCompleteWaiter();
    }
  });

  setActive(0, { animate: false });
  syncFrameScale();
  initSectionVisibility();
}

onReady(initSolutionFeatures);
