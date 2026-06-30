(function () {
  const model = window.FinancialModel;
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbed = searchParams.get("embed") === "1";

  const inputFields = {
    essentialsNewPerMonth: document.getElementById("essentialsNewPerMonth"),
    essentialsMRR: document.getElementById("essentialsMRR"),
    premiumNewPerMonth: document.getElementById("premiumNewPerMonth"),
    premiumMRR: document.getElementById("premiumMRR"),
  };

  const applyButton = document.getElementById("applyInputs");
  const clearButton = document.getElementById("clearAllInputs");
  const loadSampleButton = document.getElementById("loadSampleValues");
  const tabButtons = document.querySelectorAll("[data-table-tab]");
  const tablePanels = document.querySelectorAll("[data-table-panel]");
  const tableSearchInput = document.getElementById("tableSearchInput");
  const tableSearchClear = document.getElementById("tableSearchClear");
  const pageLayout = document.querySelector(".page-layout");
  const inputPanel = document.getElementById("inputPanel");
  const inputScroll = inputPanel?.querySelector(".input-scroll");
  const SCROLL_DURATION_MS = 1000;
  const INTERACTIVE_DEMO_START_DELAY_MS = 650;
  const INTERACTIVE_DEMO_STEP_DELAY_MS = 240;
  const INTERACTIVE_DEMO_INPUT_DURATION_MS = 700;
  const INTERACTIVE_DEMO_APPLY_DELAY_MS = 360;
  const INTERACTIVE_DEMO_TYPING_PAUSE_MS = 120;
  const INTERACTIVE_DEMO_INPUT_CAMERA_ZOOM = 1.8;
  const INTERACTIVE_DEMO_ACTION_SCROLL_MS = 1100;
  const TABLE_CHANGE_ANIMATION_MS = 1500;
  const TABLE_ROW_STAGGER_MS = 100;
  const INTERACTIVE_DEMO_SEQUENCE = [
    {
      key: "essentialsNewPerMonth",
      to: 2.0,
      digits: 1,
    },
    {
      key: "essentialsMRR",
      to: 1500,
      digits: 0,
    },
  ];
  const INTERACTIVE_DEMO_APPLY_PRESS_MS = 360;
  let scrollAnimationFrame = null;
  let inputScrollAnimationFrame = null;
  let interactiveDemoRunId = 0;
  let featureTransitionRunId = 0;
  let scrollAnimationRunId = 0;
  let lastResults = null;
  const interactiveDemoTimers = new Set();
  const interactiveInputFrames = new Map();
  const cellAnimationFrames = new Map();

  const currencyRows = {
    grossAnnualSales: document.querySelectorAll('[data-row="grossAnnualSales"]'),
    totalFranchiseExpenses: document.querySelectorAll('[data-row="totalFranchiseExpenses"]'),
    netAnnualSales: document.querySelectorAll('[data-row="netAnnualSales"]'),
    totalCostOfSales: document.querySelectorAll('[data-row="totalCostOfSales"]'),
    grossProfit: document.querySelectorAll('[data-row="grossProfit"]'),
    adjustedEbitda: document.querySelectorAll('[data-row="adjustedEbitda"]'),
    netIncome: document.querySelectorAll('[data-row="netIncome"]'),
    unleveredFcf: document.querySelectorAll('[data-row="unleveredFcf"]'),
    debtFinancing: document.querySelectorAll('[data-row="debtFinancing"]'),
    leveredFcf: document.querySelectorAll('[data-row="leveredFcf"]'),
    fcfOperator: document.querySelectorAll('[data-row="fcfOperator"]'),
    fcfPreferred: document.querySelectorAll('[data-row="fcfPreferred"]'),
    fcfTotal: document.querySelectorAll('[data-row="fcfTotal"]'),
    totalDistributionsPreferred: document.querySelectorAll('[data-row="totalDistributionsPreferred"]'),
    individualFcfPreferred: document.querySelectorAll('[data-row="individualFcfPreferred"]'),
    totalDistributionsIndividual: document.querySelectorAll('[data-row="totalDistributionsIndividual"]'),
  };

  const percentRows = {
    growthRates: document.querySelectorAll('[data-row="growthRates"]'),
    grossProfitMargin: document.querySelectorAll('[data-row="grossProfitMargin"]'),
    adjustedEbitdaMargin: document.querySelectorAll('[data-row="adjustedEbitdaMargin"]'),
    preferredEquityYield: document.querySelectorAll('[data-row="preferredEquityYield"]'),
    individualPreferredEquityYield: document.querySelectorAll('[data-row="individualPreferredEquityYield"]'),
  };

  const multipleRows = {
    dscr: document.querySelectorAll('[data-row="dscr"]'),
  };

  const complianceRows = {
    dscrCompliance: document.querySelectorAll('[data-row="dscrCompliance"]'),
  };

  function formatCurrency(value) {
    const rounded = Math.round(value);
    const absolute = Math.abs(rounded).toLocaleString("en-US");
    return rounded < 0 ? `(${absolute})` : absolute;
  }

  function formatPercent(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "";
    }

    return `${value.toFixed(digits)}%`;
  }

  function formatMultiple(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "";
    }

    return `${value.toFixed(digits)}x`;
  }

  function formatCompliance(isCompliant) {
    return isCompliant ? "yes" : "no";
  }

  function cancelAnimationFor(map, key) {
    const frameId = map.get(key);
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
      map.delete(key);
    }
  }

  function cancelAllAnimations(map) {
    map.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    map.clear();
  }

  function queueInteractiveTimer(callback, delay) {
    const timerId = window.setTimeout(() => {
      interactiveDemoTimers.delete(timerId);
      callback();
    }, delay);
    interactiveDemoTimers.add(timerId);
    return timerId;
  }

  function clearInteractiveTimers() {
    interactiveDemoTimers.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    interactiveDemoTimers.clear();
  }

  function setNumericCellValue(cell, value, formatter) {
    cell.textContent = formatter(value);
    cell.classList.toggle("negative", typeof value === "number" && value < 0);
  }

  function animateNumericCell(cell, from, to, formatter, startDelay = 0) {
    cancelAnimationFor(cellAnimationFrames, cell);

    const startTime = performance.now() + startDelay;

    function step(now) {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        cellAnimationFrames.set(cell, requestAnimationFrame(step));
        return;
      }

      const progress = Math.min(elapsed / TABLE_CHANGE_ANIMATION_MS, 1);
      const currentValue = from + (to - from) * easeOutQuart(progress);
      setNumericCellValue(cell, currentValue, formatter);

      if (progress < 1) {
        cellAnimationFrames.set(cell, requestAnimationFrame(step));
      } else {
        cellAnimationFrames.delete(cell);
        setNumericCellValue(cell, to, formatter);
      }
    }

    cellAnimationFrames.set(cell, requestAnimationFrame(step));
  }

  function setRowValues(cells, values, formatter, previousValues = null, animateChanges = false, rowStaggerDelays = null) {
    cells.forEach((cell, index) => {
      const value = values[index];
      const previousValue = previousValues?.[index];
      const canAnimate =
        animateChanges &&
        typeof value === "number" &&
        typeof previousValue === "number" &&
        !Number.isNaN(value) &&
        !Number.isNaN(previousValue) &&
        previousValue !== value;

      if (!canAnimate) {
        cancelAnimationFor(cellAnimationFrames, cell);
        setNumericCellValue(cell, value, formatter);
        return;
      }

      if (rowStaggerDelays) {
        const row = cell.closest("tr");
        const rowDelay =
          row && rowStaggerDelays.has(row) ? rowStaggerDelays.get(row) : null;
        if (rowDelay === null) {
          cancelAnimationFor(cellAnimationFrames, cell);
          setNumericCellValue(cell, value, formatter);
          return;
        }
        animateNumericCell(cell, previousValue, value, formatter, rowDelay);
        return;
      }

      animateNumericCell(cell, previousValue, value, formatter);
    });
  }

  function setComplianceValues(cells, values) {
    cells.forEach((cell, index) => {
      const isCompliant = values[index];
      cell.textContent = formatCompliance(isCompliant);
      cell.classList.toggle("positive", isCompliant);
      cell.classList.toggle("negative", !isCompliant);
    });
  }

  function readInputs() {
    return {
      essentialsNewPerMonth: inputFields.essentialsNewPerMonth.value,
      essentialsMRR: inputFields.essentialsMRR.value,
      premiumNewPerMonth: inputFields.premiumNewPerMonth.value,
      premiumMRR: inputFields.premiumMRR.value,
    };
  }

  function setInputs(values) {
    inputFields.essentialsNewPerMonth.value = values.essentialsNewPerMonth ?? "";
    inputFields.essentialsMRR.value = values.essentialsMRR ?? "";
    inputFields.premiumNewPerMonth.value = values.premiumNewPerMonth ?? "";
    inputFields.premiumMRR.value = values.premiumMRR ?? "";
  }

  function setLabelTitles() {
    document
      .querySelectorAll(
        ".summary td.label, .summary th.col-label, .summary tbody td:first-child:not([colspan])"
      )
      .forEach((cell) => {
      const text = cell.textContent.trim();
      cell.title = cell.scrollWidth > cell.clientWidth ? text : "";
    });
  }

  function renderModel(results, { animateChanges = false, staggerRowAnimation = false } = {}) {
    const rowStagger =
      animateChanges && staggerRowAnimation && lastResults ? getSummaryRowStaggerDelays() : null;
    const rowStaggerDelays = rowStagger?.delays ?? null;

    Object.entries(currencyRows).forEach(([key, cells]) => {
      setRowValues(cells, results[key], formatCurrency, lastResults?.[key], animateChanges, rowStaggerDelays);
    });

    Object.entries(percentRows).forEach(([key, cells]) => {
      const digits = key === "growthRates" ? 2 : 1;
      setRowValues(
        cells,
        results[key],
        (value) => formatPercent(value, digits),
        lastResults?.[key],
        animateChanges,
        rowStaggerDelays
      );
    });

    Object.entries(multipleRows).forEach(([key, cells]) => {
      setRowValues(cells, results[key], formatMultiple, lastResults?.[key], animateChanges, rowStaggerDelays);
    });

    Object.entries(complianceRows).forEach(([key, cells]) => {
      setComplianceValues(cells, results[key]);
    });

    setLabelTitles();
    lastResults = results;

    return rowStagger ? getTableStaggerAnimationDuration(rowStagger.rowCount) : null;
  }

  function applyModel(options = {}) {
    return renderModel(model.compute(readInputs()), options);
  }

  function clearInputs() {
    setInputs({
      essentialsNewPerMonth: "",
      essentialsMRR: "",
      premiumNewPerMonth: "",
      premiumMRR: "",
    });
  }

  function loadSampleValues(options = {}) {
    setInputs(model.SAMPLE_INPUTS);
    applyModel(options);
  }

  function getRowLabel(row) {
    const cell = row.querySelector("td.label") || row.querySelector("td");
    return cell?.textContent.trim().toLocaleLowerCase() ?? "";
  }

  function applyTableSearch(query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    tablePanels.forEach((panel) => {
      panel.querySelectorAll("tbody tr").forEach((row) => {
        row.hidden = Boolean(normalizedQuery) && !getRowLabel(row).includes(normalizedQuery);
      });
    });
  }

  function activateTab(tabName) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tableTab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    tablePanels.forEach((panel) => {
      panel.hidden = panel.dataset.tablePanel !== tabName;
    });
  }

  function resetSearch() {
    if (!tableSearchInput) return;
    tableSearchInput.value = "";
    tableSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function getSummaryRowStaggerDelays() {
    const panel = document.querySelector('[data-table-panel="summary"]');
    const delays = new WeakMap();
    let rowCount = 0;

    panel?.querySelectorAll("tbody tr").forEach((row) => {
      if (!row.querySelector(".value[data-row]")) return;
      delays.set(row, rowCount * TABLE_ROW_STAGGER_MS);
      rowCount += 1;
    });

    return { delays, rowCount };
  }

  function getTableStaggerAnimationDuration(rowCount) {
    if (rowCount <= 0) return TABLE_CHANGE_ANIMATION_MS;
    return (rowCount - 1) * TABLE_ROW_STAGGER_MS + TABLE_CHANGE_ANIMATION_MS;
  }

  function formatDemoInputValue(value, digits) {
    if (digits > 0) {
      return value.toFixed(digits);
    }

    return String(Math.round(value));
  }

  function getTypewriterFrames(value) {
    if (!value.includes(".")) {
      return Array.from({ length: value.length }, (_, index) => value.slice(0, index + 1));
    }

    const [wholePart] = value.split(".");
    return [wholePart, value];
  }

  function waitForDemoStep(delay) {
    return new Promise((resolve) => {
      queueInteractiveTimer(resolve, delay);
    });
  }

  function getDemoCameraRect(target) {
    if (!target) return null;

    const rect = target.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function requestDemoCamera(stage, target, options = {}) {
    if (!isEmbed) return;

    window.parent.postMessage(
      {
        type: "solution-embed-demo-camera",
        camera: {
          stage,
          rect: getDemoCameraRect(target),
          zoom: options.zoom,
          focusX: options.focusX,
          focusY: options.focusY,
        },
      },
      window.location.origin
    );
  }

  function setDemoFocus(focus) {
    if (!isEmbed) return;

    if (focus) {
      document.body.dataset.demoFocus = focus;
    } else {
      document.body.removeAttribute("data-demo-focus");
    }
  }

  function notifyFeatureAnimationsComplete(runId) {
    if (!isEmbed || runId !== featureTransitionRunId) return;

    window.parent.postMessage(
      { type: "solution-embed-animations-complete" },
      window.location.origin
    );
  }

  async function completeFeaturePresentation(featureName, runId) {
    await syncEmbedScroll(featureName);
    if (runId !== featureTransitionRunId) return;
    notifyFeatureAnimationsComplete(runId);
  }

  function animateInputPanelScroll(targetTop, runId) {
    return new Promise((resolve) => {
      if (!inputScroll) {
        resolve();
        return;
      }

      if (inputScrollAnimationFrame !== null) {
        cancelAnimationFrame(inputScrollAnimationFrame);
        inputScrollAnimationFrame = null;
      }

      const startTop = inputScroll.scrollTop;
      const delta = targetTop - startTop;
      if (
        Math.abs(delta) < 1 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        inputScroll.scrollTop = targetTop;
        resolve();
        return;
      }

      const startTime = performance.now();

      function step(now) {
        if (runId !== interactiveDemoRunId) {
          inputScrollAnimationFrame = null;
          resolve();
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / INTERACTIVE_DEMO_ACTION_SCROLL_MS, 1);
        const eased = easeOutCubic(progress);
        inputScroll.scrollTop = startTop + delta * eased;

        if (progress < 1) {
          inputScrollAnimationFrame = requestAnimationFrame(step);
        } else {
          inputScroll.scrollTop = targetTop;
          inputScrollAnimationFrame = null;
          resolve();
        }
      }

      inputScrollAnimationFrame = requestAnimationFrame(step);
    });
  }

  function clearInteractiveDemoState({ resetCamera = true } = {}) {
    document.querySelectorAll(".input-field.is-demo-active, .input-field.is-demo-changed").forEach((field) => {
      field.classList.remove("is-demo-active", "is-demo-changed");
    });
    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur();
    }
    applyButton?.classList.remove("is-demo-press");
    setDemoFocus(null);
    if (resetCamera) {
      requestDemoCamera("default");
    }
    if (inputScroll) inputScroll.scrollTop = 0;
  }

  function animateApplyPress(runId) {
    return new Promise((resolve) => {
      if (!applyButton) {
        resolve();
        return;
      }

      applyButton.classList.remove("is-demo-press");
      void applyButton.offsetWidth;
      applyButton.classList.add("is-demo-press");
      queueInteractiveTimer(() => {
        if (runId !== interactiveDemoRunId) {
          resolve();
          return;
        }
        applyButton.classList.remove("is-demo-press");
        resolve();
      }, INTERACTIVE_DEMO_APPLY_PRESS_MS);
    });
  }

  function stopInteractiveDemo({ resetToSample = false } = {}) {
    interactiveDemoRunId += 1;
    clearInteractiveTimers();
    cancelAllAnimations(interactiveInputFrames);
    cancelAllAnimations(cellAnimationFrames);
    if (inputScrollAnimationFrame !== null) {
      cancelAnimationFrame(inputScrollAnimationFrame);
      inputScrollAnimationFrame = null;
    }
    clearInteractiveDemoState();

    if (resetToSample) {
      loadSampleValues();
    }
  }

  function animateDemoInput(input, to, digits, runId, { blurOnComplete = false } = {}) {
    return new Promise((resolve) => {
      cancelAnimationFor(interactiveInputFrames, input);
      const field = input.closest(".input-field");
      field?.classList.add("is-demo-active");
      const targetValue = formatDemoInputValue(to, digits);
      const typewriterFrames = getTypewriterFrames(targetValue);
      const typingDuration = Math.max(
        INTERACTIVE_DEMO_INPUT_DURATION_MS - INTERACTIVE_DEMO_TYPING_PAUSE_MS,
        typewriterFrames.length * 140
      );
      let hasClearedValue = false;

      input.focus({ preventScroll: true });

      function finish() {
        input.value = targetValue;
        field?.classList.remove("is-demo-active");
        field?.classList.add("is-demo-changed");
        if (blurOnComplete) {
          input.blur();
        }
        resolve();
      }

      const startTime = performance.now();
      function step(now) {
        if (runId !== interactiveDemoRunId) {
          field?.classList.remove("is-demo-active");
          cancelAnimationFor(interactiveInputFrames, input);
          resolve();
          return;
        }

        const elapsed = now - startTime;

        if (!hasClearedValue) {
          input.value = "";
          hasClearedValue = true;
        }

        const typingElapsed = Math.max(elapsed - INTERACTIVE_DEMO_TYPING_PAUSE_MS, 0);
        const progress = Math.min(typingElapsed / typingDuration, 1);
        const visibleFrameCount = Math.floor(progress * typewriterFrames.length);
        input.value = typewriterFrames[Math.max(visibleFrameCount - 1, 0)] ?? "";

        if (progress < 1) {
          interactiveInputFrames.set(input, requestAnimationFrame(step));
        } else {
          interactiveInputFrames.delete(input);
          finish();
        }
      }

      interactiveInputFrames.set(input, requestAnimationFrame(step));
    });
  }

  async function runInteractiveDemo(runId, featureRunId) {
    await waitForDemoStep(INTERACTIVE_DEMO_START_DELAY_MS);
    if (runId !== interactiveDemoRunId) return;

    for (const [index, step] of INTERACTIVE_DEMO_SEQUENCE.entries()) {
      const isLastInput = index === INTERACTIVE_DEMO_SEQUENCE.length - 1;
      await animateDemoInput(inputFields[step.key], step.to, step.digits, runId, {
        blurOnComplete: isLastInput,
      });
      if (runId !== interactiveDemoRunId) return;
      await waitForDemoStep(INTERACTIVE_DEMO_STEP_DELAY_MS);
      if (runId !== interactiveDemoRunId) return;
    }

    requestDemoCamera("input-actions", inputPanel, {
      zoom: INTERACTIVE_DEMO_INPUT_CAMERA_ZOOM,
      focusY: 0.78,
    });
    const actionScrollTop = inputScroll ? inputScroll.scrollHeight - inputScroll.clientHeight : 0;
    await animateInputPanelScroll(actionScrollTop, runId);
    if (runId !== interactiveDemoRunId) return;

    await animateApplyPress(runId);
    if (runId !== interactiveDemoRunId) return;
    await waitForDemoStep(INTERACTIVE_DEMO_APPLY_DELAY_MS);
    if (runId !== interactiveDemoRunId) return;

    setDemoFocus(null);
    requestDemoCamera("default");
    const tableAnimationMs =
      applyModel({ animateChanges: true, staggerRowAnimation: true }) ?? TABLE_CHANGE_ANIMATION_MS;
    await waitForDemoStep(tableAnimationMs);
    if (runId !== interactiveDemoRunId) return;

    notifyFeatureAnimationsComplete(featureRunId);
  }

  function startInteractiveDemo(featureRunId) {
    interactiveDemoRunId += 1;
    const runId = interactiveDemoRunId;
    clearInteractiveTimers();
    cancelAllAnimations(interactiveInputFrames);
    cancelAllAnimations(cellAnimationFrames);
    if (inputScrollAnimationFrame !== null) {
      cancelAnimationFrame(inputScrollAnimationFrame);
      inputScrollAnimationFrame = null;
    }
    clearInteractiveDemoState({ resetCamera: false });
    loadSampleValues();
    setDemoFocus("inputs");
    requestDemoCamera("inputs", inputPanel, {
      zoom: INTERACTIVE_DEMO_INPUT_CAMERA_ZOOM,
      focusY: 0.27,
    });
    void runInteractiveDemo(runId, featureRunId);
  }

  function animateEmbedScroll(targetTop) {
    return new Promise((resolve) => {
      if (!pageLayout) {
        resolve();
        return;
      }

      const runId = ++scrollAnimationRunId;

      if (scrollAnimationFrame !== null) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
      }

      const startTop = pageLayout.scrollTop;
      const delta = targetTop - startTop;
      if (
        Math.abs(delta) < 1 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        pageLayout.scrollTop = targetTop;
        resolve();
        return;
      }

      const startTime = performance.now();

      function step(now) {
        if (runId !== scrollAnimationRunId) {
          scrollAnimationFrame = null;
          resolve();
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1);
        const eased = easeOutCubic(progress);
        pageLayout.scrollTop = startTop + delta * eased;

        if (progress < 1) {
          scrollAnimationFrame = requestAnimationFrame(step);
        } else {
          pageLayout.scrollTop = targetTop;
          scrollAnimationFrame = null;
          resolve();
        }
      }

      scrollAnimationFrame = requestAnimationFrame(step);
    });
  }

  async function syncEmbedScroll(featureName) {
    if (!isEmbed || !pageLayout) return;

    const isCompliant = featureName === "compliant";
    const targetTop = isCompliant ? pageLayout.scrollHeight - pageLayout.clientHeight : 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await animateEmbedScroll(targetTop);
  }

  function setEmbedFeature(featureName) {
    if (!isEmbed) return;

    const nextFeature = featureName || "comprehensive";
    const runId = ++featureTransitionRunId;
    document.body.dataset.solutionFeature = nextFeature;
    activateTab(
      nextFeature === "interactive" || nextFeature === "compliant" ? "summary" : "investments"
    );
    resetSearch();

    if (nextFeature === "interactive") {
      void syncEmbedScroll(nextFeature);
      startInteractiveDemo(runId);
      return;
    }

    stopInteractiveDemo({ resetToSample: true });
    void completeFeaturePresentation(nextFeature, runId);
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tableTab);
    });
  });

  applyButton.addEventListener("click", applyModel);
  clearButton.addEventListener("click", clearInputs);
  loadSampleButton.addEventListener("click", loadSampleValues);

  if (tableSearchInput) {
    const searchField = tableSearchInput.closest(".table-search-btn");

    tableSearchInput.addEventListener("input", () => {
      const query = tableSearchInput.value;
      searchField?.classList.toggle("is-active-search", Boolean(query.trim()));
      if (tableSearchClear) {
        tableSearchClear.hidden = !query;
      }
      applyTableSearch(query);
    });

    if (tableSearchClear) {
      tableSearchClear.addEventListener("click", () => {
        tableSearchInput.value = "";
        tableSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
        tableSearchInput.focus();
      });
    }
  }

  loadSampleValues();
  setLabelTitles();

  if (isEmbed) {
    document.documentElement.dataset.embed = "true";
    document.body.classList.add("is-embed");
    setEmbedFeature(searchParams.get("feature"));

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "solution-embed-feature") return;
      setEmbedFeature(event.data.feature);
    });

    window.solutionEmbed = {
      setFeature: setEmbedFeature,
    };
  }
})();
