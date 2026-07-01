/** Split-text animations inspired by React Bits Split Text. */
import { whenAllFinished } from "./utils.js";

const DEFAULTS = {
  duration: 400,
  stagger: 50,
  delay: 0,
  fromY: 40,
  fromBlur: 6,
  easing: "cubic-bezier(0.33, 1, 0.68, 1)",
};

const REACT_BITS_DEFAULTS = {
  duration: 1000,
  stagger: 150,
  delay: 0,
  fromY: 40,
  fromBlur: 8,
  easing: "cubic-bezier(0.33, 1, 0.68, 1)",
};

function buildKeyframes(config) {
  return [
    {
      opacity: 0,
      transform: `translateY(${config.fromY}px)`,
      filter: `blur(${config.fromBlur}px)`,
    },
    {
      opacity: 1,
      transform: "translateY(0px)",
      filter: "blur(0px)",
    },
  ];
}

function animateItem(element, index, config, bucket) {
  const animation = element.animate(buildKeyframes(config), {
    duration: config.duration,
    delay: config.delay + index * config.stagger,
    easing: config.easing,
    fill: "both",
  });

  bucket.push(animation);
  return animation;
}

function buildOutKeyframes(config) {
  return [
    {
      opacity: 1,
      transform: "translateY(0px)",
      filter: "blur(0px)",
    },
    {
      opacity: 0,
      transform: `translateY(${-config.fromY}px)`,
      filter: `blur(${config.fromBlur}px)`,
    },
  ];
}

function isMetricRoot(element) {
  return (
    Boolean(element.querySelector(":scope > .split-text-sizer")) &&
    !element.classList.contains("split-text-layer")
  );
}

function mountSplitChars(element, text, config, { animate = false, bucket = [], hostClass = "" } = {}) {
  const staticChars = new Set(config.staticChars ?? []);
  const sizer = element.querySelector(":scope > .split-text-sizer");
  const preserved = sizer ? [sizer] : [];
  const useDisplayHost = isMetricRoot(element);

  element.replaceChildren(...preserved);
  element.style.overflow = "hidden";

  const host = useDisplayHost ? document.createElement("span") : element;
  if (useDisplayHost) {
    host.className = hostClass || "split-text-display";
    element.appendChild(host);
  }

  host.style.overflow = "hidden";

  let animIndex = 0;

  [...text].forEach((char) => {
    const span = document.createElement("span");
    span.className = staticChars.has(char)
      ? "split-char split-char--static"
      : "split-char";
    span.textContent = char === " " ? "\u00A0" : char;
    host.appendChild(span);

    if (staticChars.has(char) || !animate) return;

    animateItem(span, animIndex, config, bucket);
    animIndex += 1;
  });

  return host;
}

function getOutgoingChars(element) {
  return [...element.querySelectorAll(".split-char:not(.split-char--static)")].filter(
    (span) => !span.closest(".split-text-sizer")
  );
}

function getVisibleText(element) {
  let text = "";

  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.classList.contains("split-text-sizer")) return;
    text += node.textContent;
  });

  return text.replace(/\u00A0/g, " ").trim();
}

function ensureSplitChars(element, config) {
  let outgoing = getOutgoingChars(element);

  if (outgoing.length) return outgoing;

  const currentText = getVisibleText(element);
  if (!currentText) return outgoing;

  mountSplitChars(element, currentText, config, { animate: false });
  return getOutgoingChars(element);
}

function stabilizeElementBeforeTransition(element) {
  element.querySelector(":scope > .split-text-layer--outgoing")?.remove();

  const incoming = element.querySelector(":scope > .split-text-layer--incoming");
  if (incoming) {
    incoming.className = "split-text-display";
    incoming.removeAttribute("aria-hidden");
  }

  element.querySelectorAll(".split-char").forEach((span) => {
    span.style.opacity = "";
    span.style.transform = "";
    span.style.filter = "";
    span.style.visibility = "";
  });
}

function finalizeTransitionLayers(element) {
  stabilizeElementBeforeTransition(element);
}

function promoteDisplayToOutgoing(element) {
  const display = element.querySelector(":scope > .split-text-display");
  if (!display) {
    return wrapOutgoingLayer(element);
  }

  display.className = "split-text-layer split-text-layer--outgoing";
  display.setAttribute("aria-hidden", "true");
  return display;
}

function wrapOutgoingLayer(element) {
  const layer = document.createElement("span");
  layer.className = "split-text-layer split-text-layer--outgoing";
  layer.setAttribute("aria-hidden", "true");

  let child = element.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains("split-text-sizer")) {
      child = next;
      continue;
    }
    layer.appendChild(child);
    child = next;
  }

  if (layer.childNodes.length) {
    element.appendChild(layer);
  }

  return layer;
}

function animateOutItem(element, index, config, bucket) {
  const animation = element.animate(buildOutKeyframes(config), {
    duration: config.duration,
    delay: config.delay + index * config.stagger,
    easing: config.easing,
    fill: "forwards",
  });

  bucket.push(animation);
  return animation;
}

function measureSplitText(element, text, config) {
  const probe = document.createElement("span");
  probe.style.visibility = "hidden";
  probe.style.position = "static";
  probe.style.display = "inline-block";
  probe.style.pointerEvents = "none";
  probe.style.whiteSpace = "nowrap";
  element.appendChild(probe);
  mountSplitChars(probe, text, config, { animate: false });
  const box = probe.getBoundingClientRect();
  probe.remove();
  return box;
}

export function ensureLayoutSizer(element, text, options = {}) {
  const config = { ...DEFAULTS, ...options };
  let sizer = element.querySelector(":scope > .split-text-sizer");

  if (!sizer) {
    sizer = document.createElement("span");
    sizer.className = "split-text-sizer";
    sizer.setAttribute("aria-hidden", "true");
    element.prepend(sizer);
  }

  mountSplitChars(sizer, text, config, { animate: false });

  [...element.childNodes].forEach((node) => {
    if (node === sizer) return;
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
    }
  });

  return sizer;
}

export function setSplitTextContent(element, text, options = {}) {
  const config = { ...DEFAULTS, ...options };

  element._splitAnimations?.forEach((animation) => animation.cancel());
  element._splitAnimations = [];

  finalizeTransitionLayers(element);
  mountSplitChars(element, text, config, { animate: false });
}

export function measureSplitTextSize(element, text, options = {}) {
  const config = { ...DEFAULTS, ...options };
  return measureSplitText(element, text, config);
}

export function transitionSplitText(element, text, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const generation = (element._transitionGen ?? 0) + 1;
  element._transitionGen = generation;

  element._splitAnimations?.forEach((animation) => animation.cancel());
  element._splitAnimations = [];

  finalizeTransitionLayers(element);

  element.style.overflow = "hidden";

  const currentText = getVisibleText(element);
  if (!currentText || currentText === text) {
    mountSplitChars(element, text, config, { animate: true, bucket: element._splitAnimations });
    return;
  }

  ensureSplitChars(element, config);

  const outgoingLayer = promoteDisplayToOutgoing(element);
  outgoingLayer
    .querySelectorAll(".split-char--static")
    .forEach((span) => {
      span.style.visibility = "hidden";
    });

  const incomingLayer = document.createElement("span");
  incomingLayer.className = "split-text-layer split-text-layer--incoming";
  element.appendChild(incomingLayer);
  mountSplitChars(incomingLayer, text, config, { animate: false });

  const outgoingChars = [
    ...outgoingLayer.querySelectorAll(".split-char:not(.split-char--static)"),
  ];
  const incomingChars = [
    ...incomingLayer.querySelectorAll(".split-char:not(.split-char--static)"),
  ];
  const bucket = element._splitAnimations;

  outgoingChars.forEach((span, index) => {
    animateOutItem(span, index, config, bucket);
  });

  incomingChars.forEach((span, index) => {
    animateItem(span, index, config, bucket);
  });

  whenAllFinished(bucket).then(() => {
    if (element._transitionGen !== generation) return;
    finalizeTransitionLayers(element);
  });
}

function createWordWrapper(text, index, config, bucket) {
  const wordClass = config.wordClass ?? "split-word";
  const wordInnerClass = config.wordInnerClass ?? "split-word-inner";

  if (config.flatWords) {
    const span = document.createElement("span");
    span.className = wordClass;
    span.textContent = text;
    animateItem(span, index, config, bucket);
    return span;
  }

  const outer = document.createElement("span");
  outer.className = wordClass;
  const inner = document.createElement("span");
  inner.className = wordInnerClass;
  inner.textContent = text;
  outer.appendChild(inner);
  animateItem(inner, index, config, bucket);
  return outer;
}

function wrapWordsInNode(node, config, bucket, state) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parts = node.textContent.split(/(\s+)/);
    const fragment = document.createDocumentFragment();

    parts.forEach((part) => {
      if (!part) return;

      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }

      fragment.appendChild(createWordWrapper(part, state.index, config, bucket));
      state.index += 1;
    });

    node.replaceWith(fragment);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  [...node.childNodes].forEach((child) => wrapWordsInNode(child, config, bucket, state));
}

export function animateSplitWords(element, options = {}) {
  const config = { ...REACT_BITS_DEFAULTS, ...options };

  element._splitAnimations?.forEach((animation) => animation.cancel());
  element._splitAnimations = [];

  const state = { index: 0 };
  [...element.childNodes].forEach((node) =>
    wrapWordsInNode(node, config, element._splitAnimations, state)
  );

  return {
    wordCount: state.index,
    finished: whenAllFinished(element._splitAnimations),
  };
}

export function animateSplitLines(element, options = {}) {
  const config = { ...REACT_BITS_DEFAULTS, ...options };
  const lineClass = config.lineClass ?? "split-line";
  const lineInnerClass = config.lineInnerClass ?? "split-line-inner";
  const mergeBreak = config.mergeBreak ?? (() => false);

  element._splitAnimations?.forEach((animation) => animation.cancel());
  element._splitAnimations = [];

  const segments = [];
  let current = [];

  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
      if (mergeBreak(node)) {
        current.push(document.createTextNode(" "));
        return;
      }

      if (current.length) segments.push(current);
      current = [];
      return;
    }

    current.push(node);
  });

  if (current.length) segments.push(current);

  element.replaceChildren();

  segments.forEach((nodes, lineIndex) => {
    const line = document.createElement("span");
    line.className = lineClass;
    const inner = document.createElement("span");
    inner.className = lineInnerClass;
    nodes.forEach((node) => inner.appendChild(node));
    line.appendChild(inner);
    element.appendChild(line);

    animateItem(inner, lineIndex, config, element._splitAnimations);
  });

  return {
    lineCount: segments.length,
    finished: whenAllFinished(element._splitAnimations),
  };
}
