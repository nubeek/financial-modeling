(function () {
  const SAMPLE_INPUTS = {
    essentialsNewPerMonth: 0.5,
    essentialsMRR: 1000,
    premiumNewPerMonth: 0.5,
    premiumMRR: 2500,
  };

  const YEAR_COUNT = 9;
  const BASELINE_GROSS_YEAR1 = 160650;

  const DEFAULT_GROSS_ANNUAL_SALES = [
    160650, 412650, 664650, 916650, 1168650, 1420650, 1672650, 1924650, 2176650,
  ];

  const DEFAULT_SUMMARY_INCOME = {
    totalFranchiseExpenses: [
      22121, 52361, 82601, 112841, 143081, 173321, 203561, 233801, 264041,
    ],
    netAnnualSales: [
      138530, 360290, 582050, 803810, 1025570, 1247330, 1469090, 1690850, 1912610,
    ],
    totalCostOfSales: [
      89625, 195795, 314865, 403485, 492105, 731325, 811495, 950865, 1029335,
    ],
    grossProfit: [48905, 164495, 267185, 400325, 533465, 516005, 657595, 739985, 883275],
    adjustedEbitda: [4283, 107471, 198959, 316817, 440675, 400473, 532521, 602429, 731077],
    netIncome: [-9909, 72052, 141039, 229843, 323192, 293545, 393139, 446188, 543359],
  };

  const YEAR_GROWTH_RATES = [
    null,
    1.5686,
    0.6107,
    0.3791,
    0.2749,
    0.2156,
    0.1774,
    0.1507,
    0.1309,
  ];

  function perYearRatios(values, grossSeries) {
    return values.map((value, index) => value / grossSeries[index]);
  }

  const DEFAULT_CASHFLOW_WATERFALL = {
    unleveredFcf: [-3060, 78480, 146944, 235220, 328009, 297629, 396472, 448755, 544957],
    debtFinancing: [-11007, -11007, -11007, -11007, -11007, -11007, -11007, -11007, -11007],
    leveredFcf: [-14067, 67473, 135937, 224213, 317002, 286622, 385465, 437748, 533950],
  };

  const DEFAULT_BASE_NOTE = {
    fcfOperator: [-1, 22150, 104194, 155555, 220110, 200237, 266261, 301215, 304450],
    fcfPreferred: [-7772, 69106, 91353, 137214, 142447, 130112, 171117, 197000, 176105],
    fcfTotal: [-7773, 91256, 195547, 292769, 362557, 330349, 437378, 498214, 533951],
  };

  const DEFAULT_DSCR = {
    dscr: [-0.28, 7.13, 13.35, 21.37, 29.8, 27.04, 36.02, 40.77, 49.51],
    dscrCompliance: [false, true, true, true, true, true, true, true, true],
  };

  const DEFAULT_INDIVIDUAL_INVESTOR = {
    fcfPreferred: [-1956, 17386, 22982, 34578, 35897, 32788, 43121, 49644, 44410],
    preferredEquityYield: [-19.6, 150.9, 189.5, 186.1, 263.1, 237.9, 320.0, 363.3, 443.3],
  };

  const INVESTOR_CONSTANTS = {
    operatorSaleShare: 8.4,
    preferredSaleShare: 91.6,
    dscrThreshold: 1.3,
    individualCheckSize: 10000,
    individualCheckShare: 25.2,
    preferredEquityPool: 39730,
    moic: 22.3,
  };

  const DEFAULT_CASHFLOW_RATIOS = {
    unleveredFcf: perYearRatios(
      DEFAULT_CASHFLOW_WATERFALL.unleveredFcf,
      DEFAULT_GROSS_ANNUAL_SALES
    ),
    debtFinancing: perYearRatios(
      DEFAULT_CASHFLOW_WATERFALL.debtFinancing,
      DEFAULT_GROSS_ANNUAL_SALES
    ),
    leveredFcf: perYearRatios(
      DEFAULT_CASHFLOW_WATERFALL.leveredFcf,
      DEFAULT_GROSS_ANNUAL_SALES
    ),
  };

  const BASE_NOTE_RATIOS = Object.fromEntries(
    Object.entries(DEFAULT_BASE_NOTE).map(([key, values]) => [
      key,
      perYearRatios(values, DEFAULT_GROSS_ANNUAL_SALES),
    ])
  );

  const INDIVIDUAL_INVESTOR_RATIOS = Object.fromEntries(
    Object.entries(DEFAULT_INDIVIDUAL_INVESTOR).map(([key, values]) => [
      key,
      perYearRatios(values, DEFAULT_GROSS_ANNUAL_SALES),
    ])
  );

  const SUMMARY_INCOME_RATIOS = Object.fromEntries(
    Object.entries(DEFAULT_SUMMARY_INCOME).map(([key, values]) => [
      key,
      perYearRatios(values, DEFAULT_GROSS_ANNUAL_SALES),
    ])
  );

  const CALENDAR_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];

  function parseInput(value) {
    if (value === "" || value === null || value === undefined) {
      return 0;
    }

    const parsed = Number(String(value).replace(/[$,\s]/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function computeRawYear1Gross(inputs) {
    const essentialsNew = parseInput(inputs.essentialsNewPerMonth);
    const essentialsMrr = parseInput(inputs.essentialsMRR);
    const premiumNew = parseInput(inputs.premiumNewPerMonth);
    const premiumMrr = parseInput(inputs.premiumMRR);

    let total = 0;

    for (let month = 1; month <= 12; month += 1) {
      const essentialsClients = essentialsNew * month;
      const premiumClients = premiumNew * month;
      total += essentialsClients * essentialsMrr + premiumClients * premiumMrr;
    }

    return total;
  }

  function computeCalibrationFactor() {
    const raw = computeRawYear1Gross(SAMPLE_INPUTS);
    return raw > 0 ? BASELINE_GROSS_YEAR1 / raw : 1;
  }

  const CALIBRATION_FACTOR = computeCalibrationFactor();

  function computeGrossSeries(inputs) {
    const essentialsNew = parseInput(inputs.essentialsNewPerMonth);
    const essentialsMrr = parseInput(inputs.essentialsMRR);
    const premiumNew = parseInput(inputs.premiumNewPerMonth);
    const premiumMrr = parseInput(inputs.premiumMRR);

    const grossByYear = [];

    for (let year = 1; year <= YEAR_COUNT; year += 1) {
      let yearTotal = 0;

      for (let month = 1; month <= 12; month += 1) {
        const totalMonth = (year - 1) * 12 + month;
        const essentialsClients = essentialsNew * totalMonth;
        const premiumClients = premiumNew * totalMonth;
        yearTotal += essentialsClients * essentialsMrr + premiumClients * premiumMrr;
      }

      grossByYear.push(yearTotal * CALIBRATION_FACTOR);
    }

    if (grossByYear[0] > 0) {
      for (let year = 2; year <= YEAR_COUNT; year += 1) {
        grossByYear[year - 1] = grossByYear[year - 2] * (1 + YEAR_GROWTH_RATES[year - 1]);
      }
    } else {
      grossByYear.fill(0);
    }

    return grossByYear;
  }

  function perYearValues(grossSeries, ratios) {
    return grossSeries.map((gross, index) => Math.round(gross * ratios[index]));
  }

  function inputsMatchSample(inputs) {
    return (
      parseInput(inputs.essentialsNewPerMonth) === SAMPLE_INPUTS.essentialsNewPerMonth &&
      parseInput(inputs.essentialsMRR) === SAMPLE_INPUTS.essentialsMRR &&
      parseInput(inputs.premiumNewPerMonth) === SAMPLE_INPUTS.premiumNewPerMonth &&
      parseInput(inputs.premiumMRR) === SAMPLE_INPUTS.premiumMRR
    );
  }

  function percent(numerator, denominator) {
    if (!denominator) {
      return null;
    }

    return (numerator / denominator) * 100;
  }

  function growthRate(current, previous) {
    if (!previous) {
      return null;
    }

    return ((current / previous) - 1) * 100;
  }

  function compute(inputs) {
    const useDefaults = inputsMatchSample(inputs);
    const grossAnnualSales = useDefaults
      ? [...DEFAULT_GROSS_ANNUAL_SALES]
      : computeGrossSeries(inputs);

    const totalFranchiseExpenses = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.totalFranchiseExpenses]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.totalFranchiseExpenses);
    const netAnnualSales = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.netAnnualSales]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.netAnnualSales);
    const totalCostOfSales = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.totalCostOfSales]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.totalCostOfSales);
    const grossProfit = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.grossProfit]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.grossProfit);
    const adjustedEbitda = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.adjustedEbitda]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.adjustedEbitda);
    const netIncome = useDefaults
      ? [...DEFAULT_SUMMARY_INCOME.netIncome]
      : perYearValues(grossAnnualSales, SUMMARY_INCOME_RATIOS.netIncome);

    const growthRates = grossAnnualSales.map((value, index) => {
      if (index === 0) {
        return null;
      }

      return growthRate(value, grossAnnualSales[index - 1]);
    });

    const grossProfitMargin = grossProfit.map((value, index) =>
      percent(value, grossAnnualSales[index])
    );
    const adjustedEbitdaMargin = adjustedEbitda.map((value, index) =>
      percent(value, grossAnnualSales[index])
    );

    const unleveredFcf = useDefaults
      ? [...DEFAULT_CASHFLOW_WATERFALL.unleveredFcf]
      : perYearValues(grossAnnualSales, DEFAULT_CASHFLOW_RATIOS.unleveredFcf);
    const debtFinancing = useDefaults
      ? [...DEFAULT_CASHFLOW_WATERFALL.debtFinancing]
      : perYearValues(grossAnnualSales, DEFAULT_CASHFLOW_RATIOS.debtFinancing).map((value) =>
          -Math.abs(value)
        );
    const leveredFcf = useDefaults
      ? [...DEFAULT_CASHFLOW_WATERFALL.leveredFcf]
      : perYearValues(grossAnnualSales, DEFAULT_CASHFLOW_RATIOS.leveredFcf);

    const fcfOperator = useDefaults
      ? [...DEFAULT_BASE_NOTE.fcfOperator]
      : perYearValues(grossAnnualSales, BASE_NOTE_RATIOS.fcfOperator);
    const fcfPreferred = useDefaults
      ? [...DEFAULT_BASE_NOTE.fcfPreferred]
      : perYearValues(grossAnnualSales, BASE_NOTE_RATIOS.fcfPreferred);
    const fcfTotal = useDefaults
      ? [...DEFAULT_BASE_NOTE.fcfTotal]
      : perYearValues(grossAnnualSales, BASE_NOTE_RATIOS.fcfTotal);

    const totalDistributionsPreferred = [...fcfPreferred];
    const preferredEquityYield = useDefaults
      ? [...DEFAULT_INDIVIDUAL_INVESTOR.preferredEquityYield]
      : totalDistributionsPreferred.map((value) =>
          percent(value, INVESTOR_CONSTANTS.preferredEquityPool)
        );

    const dscr = useDefaults
      ? [...DEFAULT_DSCR.dscr]
      : unleveredFcf.map((value) =>
          value / Math.abs(DEFAULT_CASHFLOW_WATERFALL.debtFinancing[0])
        );
    const dscrCompliance = useDefaults
      ? [...DEFAULT_DSCR.dscrCompliance]
      : dscr.map((value) => value >= INVESTOR_CONSTANTS.dscrThreshold);

    const individualFcfPreferred = useDefaults
      ? [...DEFAULT_INDIVIDUAL_INVESTOR.fcfPreferred]
      : perYearValues(grossAnnualSales, INDIVIDUAL_INVESTOR_RATIOS.fcfPreferred);
    const totalDistributionsIndividual = [...individualFcfPreferred];
    const individualPreferredEquityYield = useDefaults
      ? [...DEFAULT_INDIVIDUAL_INVESTOR.preferredEquityYield]
      : totalDistributionsIndividual.map((value) =>
          percent(value, INVESTOR_CONSTANTS.individualCheckSize)
        );

    return {
      grossAnnualSales,
      growthRates,
      totalFranchiseExpenses,
      netAnnualSales,
      totalCostOfSales,
      grossProfit,
      grossProfitMargin,
      adjustedEbitda,
      adjustedEbitdaMargin,
      netIncome,
      unleveredFcf,
      debtFinancing,
      leveredFcf,
      fcfOperator,
      fcfPreferred,
      fcfTotal,
      totalDistributionsPreferred,
      preferredEquityYield,
      dscr,
      dscrCompliance,
      individualFcfPreferred,
      totalDistributionsIndividual,
      individualPreferredEquityYield,
      calendarYears: CALENDAR_YEARS,
    };
  }

  window.FinancialModel = {
    SAMPLE_INPUTS,
    INVESTOR_CONSTANTS,
    parseInput,
    compute,
  };
})();
