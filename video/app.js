const FRAME_WIDTH = 1440;
const FRAME_HEIGHT = 960;
const SECURE_ZOOM = 1.54;
const DEFAULT_FOCUS = 0.5;
const FEATURE_SEQUENCE = ["comprehensive", "interactive", "secure", "compliant"];
const VALID_FEATURES = new Set(FEATURE_SEQUENCE);
const AUTO_ADVANCE_DELAY_MS = 2000;
const FEATURE_SECTION_DURATIONS_MS = {
  comprehensive: 1200,
  interactive: 9000,
  secure: 4100,
  compliant: 3600,
};
const EMBED_ANIMATIONS_TIMEOUT_MS = 60000;
const FALLBACK_AUDIO_DURATION_MS = 32000;
const TIMELINE_KEYBOARD_STEP_MS = 5000;
const EMBED_EXIT_LEAD_MS = 620;
const OUTRO_START_TIME_MS = 24000;
const OUTRO_TEXT_REVEAL_DELAY_MS = 700;
const OUTRO_STAT_REVEAL_DELAY_MS = 4620;
const OUTRO_SLOT_DURATION_MS = 1800;
const OUTRO_SLOT_TENS_CYCLES = 3;
const OUTRO_SLOT_ONES_CYCLES = 4;
const OUTRO_SLOT_ONES_DELAY_MS = 120;
const TESTIMONIAL_VIDEO_REVEAL_DELAY_MS = 400;
const TESTIMONIAL_FALLBACK_VIDEO_DURATION_MS = 8000;
const TESTIMONIAL_EXIT_DURATION_MS = 1000;
const QUOTE_START_TIME_MS = 43100;
const QUOTE_REVEAL_DELAY_MS = 250;
const QUOTE_EXIT_START_TIME_MS = 53000;
const QUOTE_EXIT_DURATION_MS = 900;
const FINALE_DARK_BG_HOLD_MS = 3000;
const FINALE_BRAND_REVEAL_DELAY_MS = 120;
const INTRO_REVEAL_DELAY_MS = 1200;
const INTRO_WORD_COUNT = 4;
const INTRO_WORD_REVEAL_DURATION_MS = 1200;
const INTRO_WORD_STAGGER_MS = 130;
const INTRO_BATCH1_HOLD_MS = 400;
const INTRO_BATCH2_HOLD_MS = 400;
const INTRO_BATCH2_EXIT_LEAD_MS = 400;
const INTRO_DARK_BG_SLIDE_MS = 1600;
const INTRO_BACKDROP_FADE_MS = 1100;
const INTRO_BATCH3_HOLD_MS = 1000;
const INTRO_BATCH_FADE_MS = 420;

const INTRO_BATCH1_WORD_REVEAL_DURATION_MS = 960;

function getIntroBatch1RevealDurationMs() {
  return (
    INTRO_REVEAL_DELAY_MS +
    (INTRO_WORD_COUNT - 1) * INTRO_WORD_STAGGER_MS +
    INTRO_BATCH1_WORD_REVEAL_DURATION_MS
  );
}

function getIntroBatch2RevealDurationMs() {
  return (
    (INTRO_WORD_COUNT - 1) * INTRO_WORD_STAGGER_MS +
    INTRO_WORD_REVEAL_DURATION_MS
  );
}

function getIntroBatch3RevealDurationMs() {
  return getIntroBatch2RevealDurationMs();
}

const INTRO_BATCH1_END_MS = getIntroBatch1RevealDurationMs() + INTRO_BATCH1_HOLD_MS;
const INTRO_BATCH2_START_MS = INTRO_BATCH1_END_MS + INTRO_BATCH_FADE_MS;
const INTRO_BATCH2_REVEAL_END_MS =
  INTRO_BATCH2_START_MS + getIntroBatch2RevealDurationMs() + INTRO_BATCH2_HOLD_MS;
const INTRO_BATCH3_START_MS = INTRO_BATCH2_REVEAL_END_MS - INTRO_BATCH2_EXIT_LEAD_MS;
const INTRO_SEQUENCE_DURATION_MS =
  INTRO_BATCH3_START_MS + getIntroBatch3RevealDurationMs() + INTRO_BATCH3_HOLD_MS;

function buildVisualCuePoints() {
  let time = INTRO_SEQUENCE_DURATION_MS;
  const points = FEATURE_SEQUENCE.map((feature) => {
    const point = { time, feature };
    time += FEATURE_SECTION_DURATIONS_MS[feature];
    return point;
  });

  return { points, completeTime: time };
}

const { points: VISUAL_CUE_POINTS, completeTime: VISUAL_SEQUENCE_COMPLETE_TIME_MS } =
  buildVisualCuePoints();

function getFeatureSectionStartTime(featureIndex) {
  return VISUAL_CUE_POINTS[featureIndex]?.time ?? INTRO_SEQUENCE_DURATION_MS;
}

function getFeatureSectionEndTime(featureIndex) {
  if (featureIndex >= FEATURE_SEQUENCE.length - 1) {
    return VISUAL_SEQUENCE_COMPLETE_TIME_MS;
  }

  return VISUAL_CUE_POINTS[featureIndex + 1].time;
}

const intro = document.querySelector(".video-intro");
const introBackdrop = document.querySelector(".video-intro-backdrop");
const outro = document.querySelector(".video-outro");
const outroStatTensTrack = document.querySelector(
  '.video-outro__slot[data-slot-column="tens"] .video-outro__slot-track'
);
const outroStatOnesTrack = document.querySelector(
  '.video-outro__slot[data-slot-column="ones"] .video-outro__slot-track'
);
const outroStatValue = document.querySelector(".video-outro__stat-value");
const testimonial = document.querySelector(".video-testimonial");
const testimonialVideo = document.getElementById("testimonialVideo");
const quote = document.querySelector(".video-quote");
const finaleBackdrop = document.querySelector(".video-finale-backdrop");
const finaleBrand = document.querySelector(".video-finale-brand");
const frameShell = document.querySelector(".solution__iframe-shell");
const frameStage = document.querySelector(".solution__iframe-stage");
const frame = document.querySelector(".solution__iframe");
const playbackToggle = document.getElementById("playbackToggle");
const playbackIcon = playbackToggle?.querySelector("img");
const currentTimeDisplay = document.getElementById("currentTime");
const durationDisplay = document.getElementById("duration");
const timeline = document.getElementById("timeline");
const muteToggle = document.getElementById("muteToggle");
const muteIcon = muteToggle?.querySelector("img");
const demoAudio = document.getElementById("demoAudio");
const searchParams = new URLSearchParams(window.location.search);
const requestedFeature = searchParams.get("feature");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const shouldAutoplay = searchParams.get("autoplay") !== "0" && !prefersReducedMotion;

let currentFeature = VALID_FEATURES.has(requestedFeature) ? requestedFeature : "comprehensive";
let demoCamera = null;
let playbackRunId = 0;
let isAutoplaying = false;
let embedCompletionResolver = null;
let embedCompletionTimer = null;
let audioDurationMs = FALLBACK_AUDIO_DURATION_MS;
let testimonialVideoDurationMs = TESTIMONIAL_FALLBACK_VIDEO_DURATION_MS;
let playbackDurationMs =
  QUOTE_EXIT_START_TIME_MS + QUOTE_EXIT_DURATION_MS + FINALE_DARK_BG_HOLD_MS;
let timelineElapsedMs = 0;
let timelineStartedAt = null;
let timelineAnimationFrame = null;
let isMuted = false;
let isSeeking = false;
let resumePlaybackAfterSeek = false;
let activeSeekPointerId = null;
let isEmbedSequenceComplete = false;
let hasEmbedExited = false;
let embedVisibilityAnimationFrame = null;
let hasIntroCompleted = false;
let introVisibilityAnimationFrame = null;
let introBackdropAnimationFrame = null;
let introBackdropFadeTimer = null;
let outroVisibilityAnimationFrame = null;
let hasOutroStarted = false;
let hasOutroTextRevealed = false;
let hasTestimonialStarted = false;
let testimonialPlayPending = false;
let hasQuoteStarted = false;
let hasQuoteRevealed = false;
let hasQuoteExiting = false;
let hasFinaleBackdropStarted = false;
let hasFinaleBrandStarted = false;
let quoteVisibilityAnimationFrame = null;
let finaleBackdropAnimationFrame = null;
let finaleBrandAnimationFrame = null;
let audioUnlockPending = false;
let audioUnlockGestureBound = false;

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function getOutroTextRevealTimeMs() {
  return OUTRO_START_TIME_MS + OUTRO_TEXT_REVEAL_DELAY_MS;
}

function getOutroStatRevealTimeMs() {
  return getOutroTextRevealTimeMs() + OUTRO_STAT_REVEAL_DELAY_MS;
}

function getTestimonialStartTimeMs() {
  return audioDurationMs;
}

function getTestimonialVideoStartTimeMs() {
  return getTestimonialStartTimeMs() + TESTIMONIAL_VIDEO_REVEAL_DELAY_MS;
}

function getQuoteSectionStartTimeMs() {
  return QUOTE_START_TIME_MS + TESTIMONIAL_EXIT_DURATION_MS;
}

function getQuoteRevealTimeMs() {
  return getQuoteSectionStartTimeMs() + QUOTE_REVEAL_DELAY_MS;
}

function getQuoteExitStartTimeMs() {
  return QUOTE_EXIT_START_TIME_MS;
}

function getQuoteExitEndTimeMs() {
  return getQuoteExitStartTimeMs() + QUOTE_EXIT_DURATION_MS;
}

function getFinaleBrandRevealTimeMs() {
  return getQuoteExitEndTimeMs() + FINALE_BRAND_REVEAL_DELAY_MS;
}

function shouldShowEmbedAtTime(elapsed) {
  return elapsed >= INTRO_SEQUENCE_DURATION_MS && elapsed < OUTRO_START_TIME_MS;
}

function updatePlaybackDuration() {
  playbackDurationMs = getQuoteExitEndTimeMs() + FINALE_DARK_BG_HOLD_MS;
}

function buildOutroSlotDigits(targetDigit, spinCycles) {
  const digits = [];

  for (let cycle = 0; cycle <= spinCycles; cycle += 1) {
    const limit = cycle === spinCycles ? targetDigit : 9;
    for (let digit = 0; digit <= limit; digit += 1) {
      digits.push(digit);
    }
  }

  return digits;
}

function populateOutroSlotTrack(track, targetDigit, spinCycles) {
  if (!track) return { targetDigit, maxOffset: 0 };

  track.textContent = "";
  const digits = buildOutroSlotDigits(targetDigit, spinCycles);

  digits.forEach((digit) => {
    const digitElement = document.createElement("span");
    digitElement.className = "video-outro__slot-digit";
    digitElement.textContent = String(digit);
    track.appendChild(digitElement);
  });

  return { targetDigit, maxOffset: digits.length - 1 };
}

const outroSlotColumns = {
  tens: populateOutroSlotTrack(outroStatTensTrack, 8, OUTRO_SLOT_TENS_CYCLES),
  ones: populateOutroSlotTrack(outroStatOnesTrack, 2, OUTRO_SLOT_ONES_CYCLES),
};


function shouldBlurOutroSlotColumn(rawProgress) {
  if (rawProgress <= 0 || rawProgress >= 1) return false;
  return easeOutQuart(rawProgress) < 0.999;
}

function setOutroSlotTrackBlur(track, shouldBlur) {
  if (!track) return;

  if (shouldBlur) {
    track.style.filter = "blur(3px)";
    track.style.willChange = "transform, filter";
    return;
  }

  track.style.removeProperty("filter");
  track.style.willChange = "transform";
}

function setOutroSlotState(state, { tensBlur = false, onesBlur = false } = {}) {
  if (!outroStatValue) return;
  outroStatValue.dataset.slotState = state;

  if (state === "idle" || state === "landed") {
    setOutroSlotTrackBlur(outroStatTensTrack, false);
    setOutroSlotTrackBlur(outroStatOnesTrack, false);
    return;
  }

  setOutroSlotTrackBlur(outroStatTensTrack, tensBlur);
  setOutroSlotTrackBlur(outroStatOnesTrack, onesBlur);
}

function setOutroSlotOffset(track, offset) {
  if (!track) return;
  track.style.transform = `translate3d(0, calc(-1 * ${offset} * var(--outro-slot-digit-step)), 0)`;
}

function getOutroSlotProgress(elapsed, delayMs = 0) {
  const slotStart = getOutroStatRevealTimeMs() + delayMs;
  if (elapsed <= slotStart) return 0;
  return Math.min((elapsed - slotStart) / OUTRO_SLOT_DURATION_MS, 1);
}

function syncOutroStatSlot(elapsed, { instant = false } = {}) {
  if (!outroStatTensTrack || !outroStatOnesTrack) return;

  const statRevealTime = getOutroStatRevealTimeMs();
  const isBeforeStat = elapsed < statRevealTime;

  if (isBeforeStat || outro?.dataset.playbackState === "hidden") {
    setOutroSlotState("idle");
    setOutroSlotOffset(outroStatTensTrack, 0);
    setOutroSlotOffset(outroStatOnesTrack, 0);
    return;
  }

  if (instant || prefersReducedMotion) {
    setOutroSlotState("landed");
    setOutroSlotOffset(outroStatTensTrack, outroSlotColumns.tens.maxOffset);
    setOutroSlotOffset(outroStatOnesTrack, outroSlotColumns.ones.maxOffset);
    return;
  }

  const tensRawProgress = getOutroSlotProgress(elapsed);
  const onesRawProgress = getOutroSlotProgress(elapsed, OUTRO_SLOT_ONES_DELAY_MS);
  const tensProgress = easeOutQuart(tensRawProgress);
  const onesProgress = easeOutQuart(onesRawProgress);
  const hasLanded = tensRawProgress >= 1 && onesRawProgress >= 1;

  setOutroSlotState(hasLanded ? "landed" : "spinning", {
    tensBlur: shouldBlurOutroSlotColumn(tensRawProgress),
    onesBlur: shouldBlurOutroSlotColumn(onesRawProgress),
  });

  setOutroSlotOffset(outroStatTensTrack, tensProgress * outroSlotColumns.tens.maxOffset);
  setOutroSlotOffset(outroStatOnesTrack, onesProgress * outroSlotColumns.ones.maxOffset);
}

function formatTime(milliseconds, roundUp = false) {
  const seconds = roundUp
    ? Math.ceil(milliseconds / 1000)
    : Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function getTimelineElapsed(now = performance.now()) {
  if (
    demoAudio &&
    hasAudioSource() &&
    Number.isFinite(demoAudio.currentTime) &&
    !demoAudio.paused &&
    !demoAudio.ended
  ) {
    return demoAudio.currentTime * 1000;
  }
  if (timelineStartedAt === null) return timelineElapsedMs;
  return timelineElapsedMs + (now - timelineStartedAt);
}

function renderTimeline(now = performance.now()) {
  const elapsed = Math.min(getTimelineElapsed(now), playbackDurationMs);
  const progress = playbackDurationMs > 0 ? elapsed / playbackDurationMs : 0;
  const currentSeconds = Math.floor(elapsed / 1000);
  const totalSeconds = Math.ceil(playbackDurationMs / 1000);
  const currentTimeText = formatTime(elapsed, progress >= 1);
  const durationText = formatTime(playbackDurationMs, true);

  currentTimeDisplay.textContent = currentTimeText;
  durationDisplay.textContent = durationText;
  timeline.style.setProperty("--timeline-progress", progress.toFixed(5));
  timeline.setAttribute("aria-valuenow", String(currentSeconds));
  timeline.setAttribute("aria-valuemax", String(totalSeconds));
  timeline.setAttribute("aria-valuetext", `${currentTimeText} of ${durationText}`);
  if (!isSeeking) {
    syncOutroPlayback(elapsed);
    syncOutroStatSlot(elapsed);
    syncTestimonialPlayback(elapsed);
    syncQuotePlayback(elapsed);
    syncFinaleBackdrop(elapsed);
    syncFinaleBrand(elapsed);
  }
  maybeExitEmbed(elapsed);

  if (isAutoplaying && elapsed >= playbackDurationMs && demoAudio?.paused) {
    stopAutoplay();
    return;
  }

  if (isAutoplaying) {
    timelineAnimationFrame = requestAnimationFrame(renderTimeline);
  } else {
    timelineAnimationFrame = null;
  }
}

function startTimeline({ reset = false } = {}) {
  if (timelineAnimationFrame !== null) {
    cancelAnimationFrame(timelineAnimationFrame);
  }
  if (reset) timelineElapsedMs = 0;
  timelineStartedAt = performance.now();
  renderTimeline();
}

function pauseTimeline({ reset = false } = {}) {
  if (timelineStartedAt !== null) {
    timelineElapsedMs = getTimelineElapsed();
    timelineStartedAt = null;
  }
  if (timelineAnimationFrame !== null) {
    cancelAnimationFrame(timelineAnimationFrame);
    timelineAnimationFrame = null;
  }
  if (reset) timelineElapsedMs = 0;
  renderTimeline();
}

function renderPlaybackControl() {
  if (!playbackToggle || !playbackIcon) return;

  playbackIcon.src = isAutoplaying ? "/video/assets/pause.svg" : "/video/assets/play.svg";
  playbackToggle.setAttribute("aria-label", isAutoplaying ? "Pause animation" : "Play animation");
}

function hasAudioSource() {
  return Boolean(demoAudio?.getAttribute("src"));
}

function hasPlaybackFinished() {
  return timelineElapsedMs >= playbackDurationMs - 32;
}

function syncAudioPlayback({ alignToTimeline = false } = {}) {
  if (!demoAudio || !hasAudioSource()) return;

  if (isAutoplaying) {
    const timelineSeconds = getTimelineElapsed() / 1000;
    const maximumTime = Number.isFinite(demoAudio.duration)
      ? demoAudio.duration
      : timelineSeconds;

    if (Number.isFinite(maximumTime) && timelineSeconds >= maximumTime - 0.02) {
      demoAudio.pause();
      demoAudio.currentTime = maximumTime;
      return;
    }

    if (demoAudio.ended || (alignToTimeline && demoAudio.paused)) {
      demoAudio.currentTime = Math.min(Math.max(timelineSeconds, 0), maximumTime);
    }
    demoAudio.muted = isMuted;
    const playAttempt = demoAudio.play();
    if (playAttempt !== undefined) {
      playAttempt
        .then(() => {
          audioUnlockPending = false;
        })
        .catch((error) => {
          if (error?.name === "NotAllowedError" && !isMuted) {
            stopAutoplay({ resetTimeline: true });
            hasIntroCompleted = prefersReducedMotion;
            isEmbedSequenceComplete = false;
            hasEmbedExited = false;
            setIntroState("hidden");
            setEmbedVisible(false);
            return;
          }
          if (!isMuted) {
            audioUnlockPending = true;
            audioUnlockGestureBound = false;
            bindAudioUnlockGesture();
          }
        });
    }
  } else {
    demoAudio.pause();
  }
}

function tryUnlockAudio() {
  if (!audioUnlockPending || isMuted || !isAutoplaying || !demoAudio) return false;

  audioUnlockPending = false;
  syncAudioPlayback({ alignToTimeline: true });
  return true;
}

function bindAudioUnlockGesture() {
  if (!audioUnlockPending || audioUnlockGestureBound) return;

  audioUnlockGestureBound = true;

  const onGesture = (event) => {
    if (muteToggle?.contains(event.target)) return;
    tryUnlockAudio();
  };

  document.addEventListener("pointerdown", onGesture, { once: true, capture: true });
  document.addEventListener("keydown", onGesture, { once: true, capture: true });
}

function renderMuteControl() {
  if (!muteToggle || !muteIcon) return;

  if (demoAudio) demoAudio.muted = isMuted;
  if (testimonialVideo) testimonialVideo.muted = isMuted;
  muteIcon.src = isMuted ? "/video/assets/unmute.svg" : "/video/assets/mute.svg";
  muteToggle.setAttribute("aria-label", isMuted ? "Unmute audio" : "Mute audio");
  muteToggle.setAttribute("aria-pressed", String(isMuted));
}

function syncAudioDuration() {
  if (!demoAudio || !Number.isFinite(demoAudio.duration) || demoAudio.duration <= 0) return;

  audioDurationMs = demoAudio.duration * 1000;
  updatePlaybackDuration();
  renderTimeline();
}

function syncTestimonialVideoDuration() {
  if (
    !testimonialVideo ||
    !Number.isFinite(testimonialVideo.duration) ||
    testimonialVideo.duration <= 0
  ) {
    return;
  }

  testimonialVideoDurationMs = testimonialVideo.duration * 1000;
  updatePlaybackDuration();
  renderTimeline();
}

function getFeatureAtTime(milliseconds) {
  let feature = VISUAL_CUE_POINTS[0].feature;

  for (const cuePoint of VISUAL_CUE_POINTS) {
    if (cuePoint.time > milliseconds) break;
    feature = cuePoint.feature;
  }

  return feature;
}

function hideIntroBackdrop() {
  if (!introBackdrop) return;

  if (introBackdropAnimationFrame !== null) {
    cancelAnimationFrame(introBackdropAnimationFrame);
    introBackdropAnimationFrame = null;
  }

  if (introBackdropFadeTimer !== null) {
    window.clearTimeout(introBackdropFadeTimer);
    introBackdropFadeTimer = null;
  }

  introBackdrop.dataset.backdropState = "hidden";
  introBackdrop.setAttribute("aria-hidden", "true");
}

function fadeOutIntroBackdrop() {
  if (!introBackdrop) return;

  if (prefersReducedMotion) {
    hideIntroBackdrop();
    return;
  }

  if (introBackdropAnimationFrame !== null) {
    cancelAnimationFrame(introBackdropAnimationFrame);
    introBackdropAnimationFrame = null;
  }

  if (introBackdropFadeTimer !== null) {
    window.clearTimeout(introBackdropFadeTimer);
    introBackdropFadeTimer = null;
  }

  introBackdrop.dataset.backdropState = "exiting";
  introBackdrop.setAttribute("aria-hidden", "false");
  introBackdropFadeTimer = window.setTimeout(() => {
    introBackdropFadeTimer = null;
    hideIntroBackdrop();
  }, INTRO_BACKDROP_FADE_MS);
}

function setIntroBackdrop(isVisible, { replayEntrance = false } = {}) {
  if (!introBackdrop) return;

  if (introBackdropAnimationFrame !== null) {
    cancelAnimationFrame(introBackdropAnimationFrame);
    introBackdropAnimationFrame = null;
  }

  const applyVisibility = () => {
    introBackdrop.dataset.backdropState = isVisible ? "visible" : "hidden";
    introBackdrop.setAttribute("aria-hidden", String(!isVisible));
  };

  if (isVisible && replayEntrance && !prefersReducedMotion) {
    introBackdrop.dataset.backdropState = "hidden";
    introBackdrop.setAttribute("aria-hidden", "true");
    introBackdropAnimationFrame = requestAnimationFrame(() => {
      introBackdropAnimationFrame = requestAnimationFrame(() => {
        introBackdropAnimationFrame = null;
        applyVisibility();
      });
    });
    return;
  }

  applyVisibility();
}

function hideIntro() {
  if (!intro) return;

  if (introVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(introVisibilityAnimationFrame);
    introVisibilityAnimationFrame = null;
  }

  intro.dataset.playbackState = "hidden";
  intro.dataset.introBatch = "1";
  intro.setAttribute("aria-hidden", "true");
  intro.querySelectorAll(".video-intro__batch").forEach((batch) => {
    batch.classList.remove("is-active", "is-exiting");
    batch.setAttribute("aria-hidden", "true");
  });
  hideIntroBackdrop();
}

function setIntroState(batch, state, { replayReveal = false } = {}) {
  if (!intro) return;

  if (introVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(introVisibilityAnimationFrame);
    introVisibilityAnimationFrame = null;
  }

  const applyState = () => {
    intro.dataset.introBatch = String(batch);
    intro.dataset.playbackState = state;
    intro.setAttribute("aria-hidden", String(state === "hidden"));
    const keepPreviousBatchExiting = batch > 1 && state === "revealing";

    intro.querySelectorAll(".video-intro__batch").forEach((batchElement) => {
      const batchNumber = Number(batchElement.dataset.batch);
      const isCurrentBatch = batchNumber === batch;
      const isPreviousBatchExiting =
        keepPreviousBatchExiting && batchNumber === batch - 1;

      batchElement.classList.toggle(
        "is-active",
        isCurrentBatch && state !== "hidden" && state !== "exiting"
      );
      batchElement.classList.toggle(
        "is-exiting",
        (isCurrentBatch && state === "exiting") || isPreviousBatchExiting
      );
      batchElement.setAttribute(
        "aria-hidden",
        String(
          state === "hidden" ||
            (!isCurrentBatch && !isPreviousBatchExiting)
        )
      );
    });
  };

  if (state === "revealing" && replayReveal && !prefersReducedMotion) {
    intro.dataset.playbackState = "hidden";
    intro.dataset.introBatch = String(batch);
    intro.setAttribute("aria-hidden", "true");
    intro.querySelectorAll(".video-intro__batch").forEach((batchElement) => {
      const batchNumber = Number(batchElement.dataset.batch);
      const isPreviousBatch = batchNumber === batch - 1;

      if (isPreviousBatch && batchElement.classList.contains("is-active")) {
        batchElement.classList.remove("is-active");
        batchElement.classList.add("is-exiting");
        return;
      }

      const shouldKeepExiting =
        isPreviousBatch && batchElement.classList.contains("is-exiting");

      batchElement.classList.remove("is-active");
      if (!shouldKeepExiting) {
        batchElement.classList.remove("is-exiting");
      }
    });
    introVisibilityAnimationFrame = requestAnimationFrame(() => {
      introVisibilityAnimationFrame = requestAnimationFrame(() => {
        introVisibilityAnimationFrame = null;
        applyState();
      });
    });
    return;
  }

  applyState();
}

function syncIntroForSeek(targetTime) {
  if (targetTime >= INTRO_SEQUENCE_DURATION_MS) {
    hideIntro();
    return;
  }

  if (targetTime <= INTRO_REVEAL_DELAY_MS) {
    hideIntro();
    return;
  }

  if (targetTime < INTRO_BATCH1_END_MS) {
    setIntroState(1, "visible");
    return;
  }

  if (targetTime < INTRO_BATCH2_START_MS) {
    setIntroState(1, "exiting");
    return;
  }

  if (targetTime < INTRO_BATCH3_START_MS) {
    hideIntroBackdrop();
    setIntroState(2, "visible");
    return;
  }

  setIntroBackdrop(true);
  setIntroState(3, "visible");
}

function setEmbedVisible(isVisible, { replayEntrance = false } = {}) {
  if (!frameStage || !frameShell) return;

  if (embedVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(embedVisibilityAnimationFrame);
    embedVisibilityAnimationFrame = null;
  }

  const applyVisibility = () => {
    frameStage.dataset.playbackState = isVisible ? "visible" : "hidden";
    frameStage.setAttribute("aria-hidden", String(!isVisible));
    frameShell.setAttribute("aria-hidden", String(!isVisible));
  };

  if (isVisible && replayEntrance && !prefersReducedMotion) {
    frameStage.dataset.playbackState = "hidden";
    frameStage.setAttribute("aria-hidden", "true");
    frameShell.setAttribute("aria-hidden", "true");
    embedVisibilityAnimationFrame = requestAnimationFrame(() => {
      embedVisibilityAnimationFrame = requestAnimationFrame(() => {
        embedVisibilityAnimationFrame = null;
        applyVisibility();
        syncFrameScale();
      });
    });
    return;
  }

  applyVisibility();
  if (isVisible) syncFrameScale();
}

function setOutroState(state, { replayReveal = false } = {}) {
  if (!outro) return;

  if (outroVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(outroVisibilityAnimationFrame);
    outroVisibilityAnimationFrame = null;
  }

  const applyState = () => {
    outro.dataset.playbackState = state;
    outro.setAttribute("aria-hidden", String(state === "hidden"));
  };

  if (state === "revealing" && replayReveal && !prefersReducedMotion) {
    outro.dataset.playbackState = "hidden";
    outro.setAttribute("aria-hidden", "true");
    outroVisibilityAnimationFrame = requestAnimationFrame(() => {
      outroVisibilityAnimationFrame = requestAnimationFrame(() => {
        outroVisibilityAnimationFrame = null;
        applyState();
      });
    });
    return;
  }

  applyState();
}

function resetOutroPlayback() {
  hasOutroStarted = false;
  hasOutroTextRevealed = false;
  setOutroState("hidden");
  syncOutroStatSlot(0);
}

function setTestimonialState(state) {
  if (!testimonial) return;
  testimonial.dataset.playbackState = state;
  testimonial.setAttribute("aria-hidden", String(state === "hidden" || state === "exiting"));
}

function resetTestimonialPlayback() {
  hasTestimonialStarted = false;
  testimonialPlayPending = false;
  setTestimonialState("hidden");

  if (!testimonialVideo) return;
  testimonialVideo.pause();
  if (testimonialVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
    testimonialVideo.currentTime = 0;
  }
}

function syncTestimonialPlayback(elapsed, { forSeek = false } = {}) {
  if (!testimonial) return;

  const slideStart = getTestimonialStartTimeMs();
  const videoStart = getTestimonialVideoStartTimeMs();
  const videoEnd = Math.min(videoStart + testimonialVideoDurationMs, QUOTE_START_TIME_MS);

  if (elapsed < slideStart) {
    if (hasTestimonialStarted) resetTestimonialPlayback();
    return;
  }

  if (elapsed >= QUOTE_START_TIME_MS) {
    setTestimonialState(
      hasTestimonialStarted && !forSeek && !prefersReducedMotion ? "exiting" : "hidden"
    );
    testimonialVideo?.pause();
    return;
  }

  if (!hasTestimonialStarted) {
    hasTestimonialStarted = true;
    setTestimonialState(forSeek || prefersReducedMotion ? "visible" : "revealing");
  } else if (forSeek || prefersReducedMotion) {
    setTestimonialState("visible");
  }

  if (!testimonialVideo) return;

  const hasMetadata = testimonialVideo.readyState >= HTMLMediaElement.HAVE_METADATA;
  const targetSeconds = Math.max((elapsed - videoStart) / 1000, 0);

  if (hasMetadata && (forSeek || Math.abs(testimonialVideo.currentTime - targetSeconds) > 0.25)) {
    testimonialVideo.currentTime = Math.min(targetSeconds, testimonialVideo.duration);
  }

  const shouldPlay =
    isAutoplaying && elapsed >= videoStart && elapsed < videoEnd && !testimonialVideo.ended;

  if (!shouldPlay) {
    testimonialVideo.pause();
    return;
  }

  testimonialVideo.muted = isMuted;
  if (!testimonialVideo.paused || testimonialPlayPending) return;

  testimonialPlayPending = true;
  const playAttempt = testimonialVideo.play();
  if (playAttempt === undefined) {
    testimonialPlayPending = false;
    return;
  }

  playAttempt
    .catch(() => {})
    .finally(() => {
      testimonialPlayPending = false;
    });
}

function setQuoteState(state, { replayReveal = false } = {}) {
  if (!quote) return;

  if (quoteVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(quoteVisibilityAnimationFrame);
    quoteVisibilityAnimationFrame = null;
  }

  const applyState = () => {
    quote.dataset.playbackState = state;
    quote.setAttribute("aria-hidden", String(state === "hidden"));
  };

  if (state === "revealing" && replayReveal && !prefersReducedMotion) {
    quote.dataset.playbackState = "entering";
    quote.setAttribute("aria-hidden", "false");
    quoteVisibilityAnimationFrame = requestAnimationFrame(() => {
      quoteVisibilityAnimationFrame = requestAnimationFrame(() => {
        quoteVisibilityAnimationFrame = null;
        applyState();
      });
    });
    return;
  }

  applyState();
}

function resetQuotePlayback() {
  hasQuoteStarted = false;
  hasQuoteRevealed = false;
  hasQuoteExiting = false;
  setQuoteState("hidden");
}

function syncQuotePlayback(elapsed, { forSeek = false } = {}) {
  if (!quote) return;

  if (elapsed < getQuoteSectionStartTimeMs()) {
    if (hasQuoteStarted || hasQuoteRevealed || hasQuoteExiting) resetQuotePlayback();
    return;
  }

  if (elapsed >= getQuoteExitStartTimeMs()) {
    if (elapsed >= getQuoteExitEndTimeMs()) {
      if (hasQuoteStarted || hasQuoteRevealed || hasQuoteExiting) {
        hasQuoteStarted = false;
        hasQuoteRevealed = false;
        hasQuoteExiting = false;
        setQuoteState("hidden");
      }
      return;
    }

    if (!hasQuoteExiting) {
      hasQuoteExiting = true;
      setQuoteState(forSeek || prefersReducedMotion ? "hidden" : "exiting");
    }
    return;
  }

  if (hasQuoteExiting) {
    hasQuoteExiting = false;
  }

  if (!hasQuoteStarted) {
    hasQuoteStarted = true;
    setQuoteState("entering");
  }

  if (elapsed < getQuoteRevealTimeMs()) {
    if (hasQuoteRevealed) {
      hasQuoteRevealed = false;
      setQuoteState("entering");
    }
    return;
  }

  if (hasQuoteRevealed) {
    if (forSeek || prefersReducedMotion) setQuoteState("visible");
    return;
  }

  hasQuoteRevealed = true;
  setQuoteState(forSeek || prefersReducedMotion ? "visible" : "revealing", {
    replayReveal: !forSeek,
  });
}

function setFinaleBackdropState(state, { replayEntrance = false } = {}) {
  if (!finaleBackdrop) return;

  if (finaleBackdropAnimationFrame !== null) {
    cancelAnimationFrame(finaleBackdropAnimationFrame);
    finaleBackdropAnimationFrame = null;
  }

  const applyState = () => {
    finaleBackdrop.dataset.backdropState = state;
    finaleBackdrop.setAttribute("aria-hidden", String(state === "hidden"));
  };

  if (state === "visible" && replayEntrance && !prefersReducedMotion) {
    finaleBackdrop.dataset.backdropState = "hidden";
    finaleBackdrop.setAttribute("aria-hidden", "true");
    finaleBackdropAnimationFrame = requestAnimationFrame(() => {
      finaleBackdropAnimationFrame = requestAnimationFrame(() => {
        finaleBackdropAnimationFrame = null;
        applyState();
      });
    });
    return;
  }

  applyState();
}

function resetFinaleBackdrop() {
  hasFinaleBackdropStarted = false;
  setFinaleBackdropState("hidden");
}

function syncFinaleBackdrop(elapsed, { forSeek = false } = {}) {
  if (!finaleBackdrop) return;

  if (elapsed < getQuoteExitStartTimeMs()) {
    if (hasFinaleBackdropStarted) resetFinaleBackdrop();
    return;
  }

  if (!hasFinaleBackdropStarted) {
    hasFinaleBackdropStarted = true;
    setFinaleBackdropState("visible", {
      replayEntrance: !forSeek && !prefersReducedMotion,
    });
    return;
  }

  if (forSeek || prefersReducedMotion) {
    setFinaleBackdropState("visible");
  }
}

function setFinaleBrandState(state, { replayReveal = false } = {}) {
  if (!finaleBrand) return;

  if (finaleBrandAnimationFrame !== null) {
    cancelAnimationFrame(finaleBrandAnimationFrame);
    finaleBrandAnimationFrame = null;
  }

  const applyState = () => {
    finaleBrand.dataset.playbackState = state;
    finaleBrand.setAttribute("aria-hidden", String(state === "hidden"));
  };

  if (state === "revealing" && replayReveal && !prefersReducedMotion) {
    finaleBrand.dataset.playbackState = "hidden";
    finaleBrand.setAttribute("aria-hidden", "true");
    finaleBrandAnimationFrame = requestAnimationFrame(() => {
      finaleBrandAnimationFrame = requestAnimationFrame(() => {
        finaleBrandAnimationFrame = null;
        applyState();
      });
    });
    return;
  }

  applyState();
}

function resetFinaleBrand() {
  hasFinaleBrandStarted = false;
  setFinaleBrandState("hidden");
}

function syncFinaleBrand(elapsed, { forSeek = false } = {}) {
  if (!finaleBrand) return;

  if (elapsed < getFinaleBrandRevealTimeMs()) {
    if (hasFinaleBrandStarted) resetFinaleBrand();
    return;
  }

  if (!hasFinaleBrandStarted) {
    hasFinaleBrandStarted = true;
    setFinaleBrandState(forSeek || prefersReducedMotion ? "visible" : "revealing", {
      replayReveal: !forSeek && !prefersReducedMotion,
    });
    return;
  }

  if (forSeek || prefersReducedMotion) {
    setFinaleBrandState("visible");
  }
}

function startEmbedOutroExit() {
  if (!frameStage || !frameShell) return;

  if (embedVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(embedVisibilityAnimationFrame);
    embedVisibilityAnimationFrame = null;
  }

  frameStage.dataset.playbackState = "outro-exiting";
  frameStage.setAttribute("aria-hidden", "true");
  frameShell.setAttribute("aria-hidden", "true");
}

function syncOutroPlayback(elapsed, { forSeek = false } = {}) {
  if (elapsed < OUTRO_START_TIME_MS) {
    if (hasOutroStarted || hasOutroTextRevealed) resetOutroPlayback();
    return;
  }

  if (elapsed >= getTestimonialStartTimeMs()) {
    if (hasOutroStarted || hasOutroTextRevealed) resetOutroPlayback();
    return;
  }

  if (!hasOutroStarted || frameStage?.dataset.playbackState !== "outro-exiting") {
    hasOutroStarted = true;
    startEmbedOutroExit();
  }

  const revealAt = OUTRO_START_TIME_MS + OUTRO_TEXT_REVEAL_DELAY_MS;
  if (elapsed < revealAt) {
    if (hasOutroTextRevealed) {
      hasOutroTextRevealed = false;
      setOutroState("hidden");
    }
    return;
  }

  if (hasOutroTextRevealed) return;

  hasOutroTextRevealed = true;
  setOutroState(forSeek || prefersReducedMotion ? "visible" : "revealing", {
    replayReveal: !forSeek,
  });
  syncOutroStatSlot(elapsed, { instant: forSeek || prefersReducedMotion });
}

function maybeExitEmbed(elapsed = getTimelineElapsed()) {
  const exitAt = Math.max(playbackDurationMs - EMBED_EXIT_LEAD_MS, 0);
  if (hasEmbedExited || elapsed < exitAt) return;

  hasEmbedExited = true;
  setEmbedVisible(false);
}

function seekPlayback(milliseconds, { syncVisual = true } = {}) {
  const targetTime = Math.min(Math.max(milliseconds, 0), playbackDurationMs);

  timelineElapsedMs = targetTime;
  timelineStartedAt = isAutoplaying ? performance.now() : null;

  if (demoAudio && hasAudioSource() && Number.isFinite(demoAudio.duration)) {
    demoAudio.currentTime = Math.min(targetTime / 1000, demoAudio.duration);
  }

  if (syncVisual) {
    const isIntroTime = targetTime < INTRO_SEQUENCE_DURATION_MS;
    hasIntroCompleted = !isIntroTime;
    isEmbedSequenceComplete = targetTime >= VISUAL_SEQUENCE_COMPLETE_TIME_MS;
    hasEmbedExited = targetTime >= OUTRO_START_TIME_MS;
    applyFeature(getFeatureAtTime(targetTime));
    syncIntroForSeek(targetTime);
    setEmbedVisible(shouldShowEmbedAtTime(targetTime));
    syncOutroPlayback(targetTime, { forSeek: true });
    syncOutroStatSlot(targetTime, { instant: true });
    syncTestimonialPlayback(targetTime, { forSeek: true });
    syncQuotePlayback(targetTime, { forSeek: true });
    syncFinaleBackdrop(targetTime, { forSeek: true });
    syncFinaleBrand(targetTime, { forSeek: true });
  }

  renderTimeline();
}

function getTimelineTimeFromPointer(event) {
  const rect = timeline.getBoundingClientRect();
  if (rect.width <= 0) return timelineElapsedMs;

  const progress = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  return progress * playbackDurationMs;
}

function updateTimelineSeek(event) {
  if (!isSeeking || event.pointerId !== activeSeekPointerId) return;
  seekPlayback(getTimelineTimeFromPointer(event), { syncVisual: false });
}

function finishTimelineSeek(event, { updatePosition = true } = {}) {
  if (!isSeeking || event.pointerId !== activeSeekPointerId) return;

  if (updatePosition) {
    updateTimelineSeek(event);
  }
  if (timeline.hasPointerCapture(event.pointerId)) {
    timeline.releasePointerCapture(event.pointerId);
  }

  isSeeking = false;
  activeSeekPointerId = null;
  timeline.removeAttribute("data-seeking");
  seekPlayback(timelineElapsedMs);

  const shouldResume = resumePlaybackAfterSeek && timelineElapsedMs < playbackDurationMs;
  resumePlaybackAfterSeek = false;
  if (shouldResume) {
    startAutoplay();
  }
}

function syncFrameScale() {
  if (!frameShell) return;

  const width = frameShell.clientWidth;
  const height = frameShell.clientHeight;
  if (!width || !height) return;

  const baseScale = Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT);
  const zoom = demoCamera?.zoom ?? (currentFeature === "secure" ? SECURE_ZOOM : 1);
  const scale = baseScale * zoom;
  const targetRect = demoCamera?.rect;
  const focusX = demoCamera?.focusX ?? DEFAULT_FOCUS;
  const focusY = demoCamera?.focusY ?? DEFAULT_FOCUS;
  const targetCenterX = targetRect
    ? targetRect.left + targetRect.width * focusX
    : FRAME_WIDTH / 2;
  const targetCenterY = targetRect
    ? targetRect.top + targetRect.height * focusY
    : FRAME_HEIGHT / 2;

  frameShell.style.setProperty("--solution-ui-scale", scale.toFixed(5));
  frameShell.style.setProperty(
    "--solution-ui-left",
    `${(width / 2 - targetCenterX * scale).toFixed(2)}px`
  );
  frameShell.style.setProperty(
    "--solution-ui-top",
    `${(height / 2 - targetCenterY * scale).toFixed(2)}px`
  );
}

function sendFeatureToEmbed() {
  if (!frame?.contentWindow) return;

  const embedApi = frame.contentWindow.solutionEmbed;
  if (embedApi?.setFeature) {
    embedApi.setFeature(currentFeature);
    return;
  }

  frame.contentWindow.postMessage(
    { type: "solution-embed-feature", feature: currentFeature },
    window.location.origin
  );
}

function applyFeature(feature) {
  currentFeature = VALID_FEATURES.has(feature) ? feature : "comprehensive";
  frameShell.dataset.visual = currentFeature;

  if (currentFeature !== "interactive") {
    demoCamera = null;
    frameShell.removeAttribute("data-demo-camera");
  }

  syncFrameScale();
  sendFeatureToEmbed();
}

function resolveEmbedAnimationsComplete() {
  if (!embedCompletionResolver) return;

  window.clearTimeout(embedCompletionTimer);
  embedCompletionTimer = null;
  const resolve = embedCompletionResolver;
  embedCompletionResolver = null;
  resolve(true);
}

function waitForEmbedAnimationsComplete(runId) {
  return new Promise((resolve) => {
    if (runId !== playbackRunId) {
      resolve(false);
      return;
    }

    embedCompletionResolver = resolve;
    embedCompletionTimer = window.setTimeout(() => {
      if (runId !== playbackRunId || embedCompletionResolver !== resolve) return;
      embedCompletionResolver = null;
      embedCompletionTimer = null;
      resolve(true);
    }, EMBED_ANIMATIONS_TIMEOUT_MS);
  });
}

async function waitForFrameAnimations() {
  if (prefersReducedMotion || !frame) return;

  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));

  let animations = [];
  try {
    animations = frame.getAnimations();
  } catch {
    return;
  }

  await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
}

function waitForHold(runId) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(runId === playbackRunId), AUTO_ADVANCE_DELAY_MS);
  });
}

function waitForPlaybackCue(runId, cueTimeMs) {
  return new Promise((resolve) => {
    function checkCue(now) {
      if (runId !== playbackRunId || !isAutoplaying) {
        resolve(false);
        return;
      }

      if (getTimelineElapsed(now) >= cueTimeMs) {
        resolve(true);
        return;
      }

      requestAnimationFrame(checkCue);
    }

    requestAnimationFrame(checkCue);
  });
}

async function runOpeningSequence(runId, { replayReveal = false } = {}) {
  setEmbedVisible(false);

  setIntroState(1, "revealing", { replayReveal });
  if (!(await waitForPlaybackCue(runId, INTRO_BATCH1_END_MS))) return;

  setIntroState(1, "exiting");
  if (!(await waitForPlaybackCue(runId, INTRO_BATCH2_START_MS))) return;

  setIntroState(2, "revealing", { replayReveal: true });
  if (!(await waitForPlaybackCue(runId, INTRO_BATCH3_START_MS))) return;

  setIntroBackdrop(true, { replayEntrance: true });
  setIntroState(3, "revealing", { replayReveal: true });
  if (!(await waitForPlaybackCue(runId, INTRO_SEQUENCE_DURATION_MS))) return;

  hasIntroCompleted = true;
  setIntroState(3, "exiting");
  fadeOutIntroBackdrop();
  setEmbedVisible(true, { replayEntrance: true });
  void runAutoplay(runId, { fromStart: true });
}

async function runAutoplay(runId, { fromStart = false } = {}) {
  if (isEmbedSequenceComplete) return;

  let featureIndex = fromStart ? 0 : Math.max(FEATURE_SEQUENCE.indexOf(currentFeature), 0);

  for (; featureIndex < FEATURE_SEQUENCE.length; featureIndex += 1) {
    if (runId !== playbackRunId || !isAutoplaying) return;

    const sectionStartTime = getFeatureSectionStartTime(featureIndex);
    const sectionEndTime = getFeatureSectionEndTime(featureIndex);

    if (!(await waitForPlaybackCue(runId, sectionStartTime))) return;

    applyFeature(FEATURE_SEQUENCE[featureIndex]);

    if (!(await waitForPlaybackCue(runId, sectionEndTime))) return;
  }

  if (runId === playbackRunId && isAutoplaying) {
    isEmbedSequenceComplete = true;
  }
}

function stopAutoplay({ resetTimeline = false } = {}) {
  isAutoplaying = false;
  playbackRunId += 1;
  window.clearTimeout(embedCompletionTimer);
  embedCompletionTimer = null;
  if (introVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(introVisibilityAnimationFrame);
    introVisibilityAnimationFrame = null;
  }
  if (introBackdropAnimationFrame !== null) {
    cancelAnimationFrame(introBackdropAnimationFrame);
    introBackdropAnimationFrame = null;
  }
  if (introBackdropFadeTimer !== null) {
    window.clearTimeout(introBackdropFadeTimer);
    introBackdropFadeTimer = null;
  }
  if (quoteVisibilityAnimationFrame !== null) {
    cancelAnimationFrame(quoteVisibilityAnimationFrame);
    quoteVisibilityAnimationFrame = null;
  }
  if (finaleBackdropAnimationFrame !== null) {
    cancelAnimationFrame(finaleBackdropAnimationFrame);
    finaleBackdropAnimationFrame = null;
  }
  if (finaleBrandAnimationFrame !== null) {
    cancelAnimationFrame(finaleBrandAnimationFrame);
    finaleBrandAnimationFrame = null;
  }

  if (embedCompletionResolver) {
    const resolve = embedCompletionResolver;
    embedCompletionResolver = null;
    resolve(false);
  }

  pauseTimeline({ reset: resetTimeline });
  if (!resetTimeline) {
    syncOutroStatSlot(getTimelineElapsed());
  }
  syncAudioPlayback();
  renderPlaybackControl();
}

function startAutoplay({ restartCycle = false } = {}) {
  const shouldRestart = restartCycle || hasPlaybackFinished();
  stopAutoplay();
  isAutoplaying = true;

  if (shouldRestart) {
    hasIntroCompleted = prefersReducedMotion;
    isEmbedSequenceComplete = false;
    hasEmbedExited = false;
    resetOutroPlayback();
    resetTestimonialPlayback();
    resetQuotePlayback();
    resetFinaleBackdrop();
    resetFinaleBrand();
    timelineElapsedMs = 0;
    if (demoAudio && hasAudioSource()) {
      demoAudio.currentTime = 0;
    }
    applyFeature(FEATURE_SEQUENCE[0]);
    hideIntro();
    setEmbedVisible(false);
  }

  startTimeline({ reset: false });
  syncAudioPlayback({ alignToTimeline: true });
  renderPlaybackControl();

  const shouldPlayIntro =
    !prefersReducedMotion &&
    !hasIntroCompleted &&
    timelineElapsedMs < INTRO_SEQUENCE_DURATION_MS;
  if (shouldPlayIntro) {
    void runOpeningSequence(playbackRunId, { replayReveal: shouldRestart });
    return;
  }

  hideIntro();
  if (shouldShowEmbedAtTime(timelineElapsedMs)) {
    setEmbedVisible(true, { replayEntrance: shouldRestart });
  } else {
    setEmbedVisible(false);
  }
  void runAutoplay(playbackRunId, { fromStart: shouldRestart });
}

function setFeature(feature) {
  stopAutoplay({ resetTimeline: true });
  hasIntroCompleted = true;
  isEmbedSequenceComplete = false;
  hasEmbedExited = false;
  resetOutroPlayback();
  resetTestimonialPlayback();
  resetQuotePlayback();
  resetFinaleBackdrop();
  resetFinaleBrand();
  hideIntro();
  setEmbedVisible(true);
  applyFeature(feature);
}

function setDemoCamera(camera) {
  if (currentFeature !== "interactive") return;

  if (!camera || camera.stage === "default") {
    demoCamera = null;
    frameShell.removeAttribute("data-demo-camera");
  } else {
    demoCamera = camera;
    frameShell.dataset.demoCamera = camera.stage || "active";
  }

  syncFrameScale();
}

frame?.addEventListener("load", () => {
  syncFrameScale();
  if (shouldAutoplay) {
    startAutoplay({ restartCycle: true });
  } else {
    hideIntro();
    setEmbedVisible(true);
    sendFeatureToEmbed();
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === "solution-embed-demo-camera") {
    setDemoCamera(event.data.camera);
    return;
  }

  if (event.data?.type === "solution-embed-animations-complete") {
    resolveEmbedAnimationsComplete();
    window.dispatchEvent(
      new CustomEvent("video-demo:animations-complete", {
        detail: { feature: currentFeature },
      })
    );
  }
});

window.addEventListener("resize", syncFrameScale);

if (typeof ResizeObserver !== "undefined" && frameShell) {
  new ResizeObserver(syncFrameScale).observe(frameShell);
}

function togglePlayback() {
  if (isAutoplaying) {
    stopAutoplay();
    return;
  }

  startAutoplay();
  tryUnlockAudio();
}

function handlePlaybackKeyboard(event) {
  if (event.key !== " " && event.code !== "Space") return;

  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  ) {
    return;
  }

  event.preventDefault();

  if (isSeeking) return;

  togglePlayback();
}

playbackToggle?.addEventListener("click", togglePlayback);
document.addEventListener("keydown", handlePlaybackKeyboard, { capture: true });

timeline?.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  timeline.focus({ preventScroll: true });
  resumePlaybackAfterSeek = isAutoplaying;
  stopAutoplay();
  isSeeking = true;
  activeSeekPointerId = event.pointerId;
  timeline.dataset.seeking = "true";
  timeline.setPointerCapture(event.pointerId);
  updateTimelineSeek(event);
});

timeline?.addEventListener("pointermove", updateTimelineSeek);
timeline?.addEventListener("pointerup", finishTimelineSeek);
timeline?.addEventListener("pointercancel", (event) => {
  finishTimelineSeek(event, { updatePosition: false });
});

timeline?.addEventListener("keydown", (event) => {
  const currentTime = getTimelineElapsed();
  let targetTime = null;

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    targetTime = currentTime - TIMELINE_KEYBOARD_STEP_MS;
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    targetTime = currentTime + TIMELINE_KEYBOARD_STEP_MS;
  } else if (event.key === "Home") {
    targetTime = 0;
  } else if (event.key === "End") {
    targetTime = playbackDurationMs;
  }

  if (targetTime === null) return;

  event.preventDefault();
  const shouldResume = isAutoplaying;
  stopAutoplay();
  seekPlayback(targetTime);
  if (shouldResume && timelineElapsedMs < playbackDurationMs) {
    startAutoplay();
  }
});

muteToggle?.addEventListener("click", () => {
  if (audioUnlockPending && !isMuted) {
    tryUnlockAudio();
    return;
  }

  isMuted = !isMuted;
  renderMuteControl();
  if (isAutoplaying) {
    syncAudioPlayback({ alignToTimeline: true });
  }
});

demoAudio?.addEventListener("loadedmetadata", syncAudioDuration);
demoAudio?.addEventListener("durationchange", syncAudioDuration);
demoAudio?.addEventListener("ended", () => {
  timelineElapsedMs = audioDurationMs;
  timelineStartedAt = isAutoplaying ? performance.now() : null;
  renderTimeline();
});

testimonialVideo?.addEventListener("loadedmetadata", syncTestimonialVideoDuration);
testimonialVideo?.addEventListener("durationchange", syncTestimonialVideoDuration);

window.videoDemo = {
  getFeature: () => currentFeature,
  isPlaying: () => isAutoplaying,
  pause: stopAutoplay,
  play: () => startAutoplay(),
  setFeature,
};

applyFeature(currentFeature);
updatePlaybackDuration();
renderTimeline();
renderPlaybackControl();
renderMuteControl();
