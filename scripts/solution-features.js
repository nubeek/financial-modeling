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
  const FEATURE_GAP = 28;
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

  function measureFeatureHeights() {
    return features.map((feature) => {
      const title = feature.querySelector(".solution__feature-title");
      const body = feature.querySelector(".solution__feature-body");
      const wasActive = feature.classList.contains("is-active");

      feature.classList.remove("is-active");
      if (body) {
        body.removeAttribute("hidden");
        body.setAttribute("aria-hidden", "true");
      }
      const collapsed = title.offsetHeight;

      feature.classList.add("is-active");
      if (body) {
        body.removeAttribute("hidden");
        body.setAttribute("aria-hidden", "false");
      }
      feature.style.height = "auto";
      const expanded = feature.offsetHeight;

      feature.classList.toggle("is-active", wasActive);
      feature.style.height = "";
      if (body) {
        body.removeAttribute("hidden");
        body.setAttribute("aria-hidden", String(!wasActive));
      }

      return { collapsed, expanded };
    });
  }

  function getIndicatorTarget(activeIndex, heights) {
    let top = 0;
    for (let i = 0; i < activeIndex; i++) {
      top += heights[i].collapsed + FEATURE_GAP;
    }
    return { top, height: heights[activeIndex].expanded };
  }

  let featureHeights = measureFeatureHeights();

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

  function applyFeatureHeights(activeIndex, { animate = true } = {}) {
    if (!animate) list?.classList.add("is-instant");

    features.forEach((feature, i) => {
      const body = feature.querySelector(".solution__feature-body");
      const active = i === activeIndex;
      const height = active ? featureHeights[i].expanded : featureHeights[i].collapsed;

      feature.style.height = `${height}px`;
      if (body) {
        body.removeAttribute("hidden");
        body.setAttribute("aria-hidden", String(!active));
      }
    });

    if (!animate) {
      requestAnimationFrame(() => list?.classList.remove("is-instant"));
    }
  }

  function syncIndicatorTrack() {
    if (!frameShell || !track || !indicator) return;

    const isStacked = window.matchMedia("(max-width: 980px)").matches;

    if (isStacked) {
      track.style.height = "";
      track.style.top = "";
      return;
    }

    const stackRect = frameShell.getBoundingClientRect();
    const indicatorRect = indicator.getBoundingClientRect();

    track.style.height = `${stackRect.height}px`;
    track.style.top = `${stackRect.top - indicatorRect.top}px`;
  }

  function applyIndicator(activeIndex) {
    if (!thumb || activeIndex < 0) return;

    const target = getIndicatorTarget(activeIndex, featureHeights);
    thumb.style.top = `${target.top}px`;
    thumb.style.height = `${target.height}px`;
    syncIndicatorTrack();
  }

  function setActive(index, { animate = true, fromAutoPlay = false } = {}) {
    embedAnimationsPendingComplete = false;
    stepAnimationsComplete = false;

    if (!fromAutoPlay) {
      cancelAutoAdvance();
    }

    activeIndex = index;

    features.forEach((feature, i) => {
      const active = i === index;

      feature.classList.toggle("is-active", active);
      feature.setAttribute("aria-selected", String(active));
      feature.setAttribute("aria-expanded", String(active));
    });

    applyFeatureHeights(index, { animate });
    setVisual(features[index].dataset.visual);
    applyIndicator(index);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      featureHeights = measureFeatureHeights();
      const activeIndex = features.findIndex((feature) => feature.classList.contains("is-active"));
      applyFeatureHeights(activeIndex, { animate: false });
      applyIndicator(activeIndex);
    }, 100);
  });

  if (typeof ResizeObserver !== "undefined") {
    const shellObserver = new ResizeObserver(() => {
      syncFrameScale();
    });
    const listObserver = new ResizeObserver(() => {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSolutionFeatures, { once: true });
} else {
  initSolutionFeatures();
}
