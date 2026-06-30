import { summaryIncomeStatement } from "../models/summary-income-statement.js";
import {
  ensureLayoutSizer,
  measureSplitTextSize,
  setSplitTextContent,
  transitionSplitText,
} from "./split-text.js";

const METRICS = [
  "grossAnnualSales",
  "totalFranchiseExpenses",
  "totalCostOfSales",
  "grossProfit",
];

const SPLIT_TEXT_OPTIONS = {
  duration: 400,
  stagger: 50,
  fromY: 40,
  fromBlur: 6,
  staticChars: ["$"],
};

const METRIC_STAGGER = 150;
const YEAR_AUTO_ADVANCE_MS = 4000;

function formatCurrency(value) {
  return `$ ${value.toLocaleString("en-US")}`;
}

function animateMetric(element, text, metricIndex) {
  transitionSplitText(element, text, {
    ...SPLIT_TEXT_OPTIONS,
    delay: metricIndex * METRIC_STAGGER,
  });
}

function updateTabIndicator(card, tab, { animate = true } = {}) {
  const tabsContainer = card.querySelector(".summary-tabs");
  const indicator = tabsContainer?.querySelector(".summary-tabs__indicator");
  if (!indicator || !tab || !tabsContainer) return;

  if (!animate) {
    indicator.style.transition = "none";
  }

  const containerRect = tabsContainer.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const left = tabRect.left - containerRect.left;
  const width = tabRect.width;

  indicator.style.width = `${width}px`;
  indicator.style.transform = `translateX(${left}px)`;

  if (!animate) {
    indicator.offsetHeight;
    indicator.style.transition = "";
  }
}

function setActiveYear(card, yearIndex, { animate = true } = {}) {
  const year = summaryIncomeStatement[yearIndex];
  if (!year) return;

  card.dataset.activeYear = String(yearIndex);

  let activeTab = null;

  card.querySelectorAll(".summary-tabs__tab").forEach((tab, index) => {
    const isActive = index === yearIndex;
    tab.classList.toggle("summary-tabs__tab--active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    if (isActive) activeTab = tab;
  });

  updateTabIndicator(card, activeTab, { animate });

  METRICS.forEach((metric, metricIndex) => {
    const el = card.querySelector(`[data-metric="${metric}"]`);
    if (!el) return;

    const text = formatCurrency(year[metric]);
    if (animate) {
      animateMetric(el, text, metricIndex);
    } else {
      setSplitTextContent(el, text, SPLIT_TEXT_OPTIONS);
    }
  });
}

function startYearAutoAdvance(card) {
  let timerId = null;

  const schedule = () => {
    clearInterval(timerId);
    timerId = setInterval(() => {
      const current = Number(card.dataset.activeYear);
      const next = (current + 1) % summaryIncomeStatement.length;
      setActiveYear(card, next);
    }, YEAR_AUTO_ADVANCE_MS);
  };

  schedule();
  return { reset: schedule };
}

function updateMetricSizers(card) {
  METRICS.forEach((metric) => {
    const el = card.querySelector(`[data-metric="${metric}"]`);
    if (!el) return;

    let widestText = formatCurrency(summaryIncomeStatement[0][metric]);
    let maxWidth = 0;

    summaryIncomeStatement.forEach((year) => {
      const text = formatCurrency(year[metric]);
      const size = measureSplitTextSize(el, text, SPLIT_TEXT_OPTIONS);
      if (size.width > maxWidth) {
        maxWidth = size.width;
        widestText = text;
      }
    });

    ensureLayoutSizer(el, widestText, SPLIT_TEXT_OPTIONS);
    el.dataset.layoutReserved = "true";
  });
}

function lockCardHeight(card) {
  const height = card.offsetHeight;
  card.style.height = `${height}px`;
  card.style.minHeight = `${height}px`;
  card.dataset.heightLocked = "true";
}

function initSummaryCard(card) {
  if (card.dataset.summaryInit) return;
  card.dataset.summaryInit = "true";

  updateMetricSizers(card);
  setActiveYear(card, 0, { animate: false });
  lockCardHeight(card);
  const autoAdvance = startYearAutoAdvance(card);

  card.querySelectorAll(".summary-tabs__tab").forEach((tab, index) => {
    tab.addEventListener("click", () => {
      if (Number(card.dataset.activeYear) === index) return;
      setActiveYear(card, index);
      autoAdvance.reset();
    });
  });

  window.addEventListener("resize", () => {
    const activeTab = card.querySelector(".summary-tabs__tab--active");
    updateTabIndicator(card, activeTab, { animate: false });
    card.style.height = "";
    card.style.minHeight = "";
    updateMetricSizers(card);
    lockCardHeight(card);
  });
}

document.querySelectorAll(".carousel__slide--summary").forEach(initSummaryCard);

window.addEventListener("carousel:updated", () => {
  document.querySelectorAll(".carousel__slide--summary").forEach(initSummaryCard);
});
