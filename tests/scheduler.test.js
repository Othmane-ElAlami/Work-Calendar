const {
  getWeekKey,
  getPreviousWeekKey,
  getNextWeekKey,
  getExternalWeekAssignments,
  calculateFairness,
  solveSchedule,
  validateSchedulesGlobal
} = require("../js/app.js");

const defaultPeople = ["Alae", "Othmane", "Omar", "Zakaria", "Zouhair", "Hamza", "Yassine"];

let passedCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✓ ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ ${testName}: ${err.message}`);
    process.exit(1);
  }
}

runTest("Test 1: One person per day", () => {
  const sched = solveSchedule(2026, 8, defaultPeople, 2, {}, {}, {});
  for (const [date, names] of Object.entries(sched)) {
    if (names.length > 1) throw new Error(`Date ${date} has ${names.length} people`);
  }
});

runTest("Test 2: Allowed weekdays (Tue/Wed/Thu only)", () => {
  const sched = solveSchedule(2026, 8, defaultPeople, 2, {}, {}, {});
  for (const [date, names] of Object.entries(sched)) {
    if (names.length > 0) {
      const [y, m, d] = date.split("-").map(Number);
      const jsDay = new Date(y, m - 1, d).getDay();
      const wd = jsDay === 0 ? 7 : jsDay;
      if (wd < 2 || wd > 4) throw new Error(`Date ${date} has weekday ${wd}`);
    }
  }
});

runTest("Test 3: Maximum one per week", () => {
  const sched = solveSchedule(2026, 8, defaultPeople, 2, {}, {}, {});
  const perWeek = {};
  for (const [date, names] of Object.entries(sched)) {
    if (!names.length) continue;
    const p = names[0];
    const wk = getWeekKey(date);
    if (!perWeek[p]) perWeek[p] = new Set();
    if (perWeek[p].has(wk)) throw new Error(`${p} assigned twice in week ${wk}`);
    perWeek[p].add(wk);
  }
});

runTest("Test 4: No consecutive weeks", () => {
  const sched = solveSchedule(2026, 8, defaultPeople, 2, {}, {}, {});
  const perWeek = {};
  for (const [date, names] of Object.entries(sched)) {
    if (!names.length) continue;
    const p = names[0];
    const wk = getWeekKey(date);
    if (!perWeek[p]) perWeek[p] = [];
    perWeek[p].push(wk);
  }
  for (const [p, wks] of Object.entries(perWeek)) {
    const sorted = [...wks].sort();
    for (let i = 0; i < sorted.length - 1; i++) {
      if (getNextWeekKey(sorted[i]) === sorted[i + 1]) {
        throw new Error(`${p} in consecutive weeks ${sorted[i]} and ${sorted[i + 1]}`);
      }
    }
  }
});

runTest("Test 5: Month boundary (Sep 2026 -> Oct 2026)", () => {
  const scheds = {};
  const extSep = getExternalWeekAssignments(scheds, "2026-09");
  const fairSep = calculateFairness(defaultPeople, scheds, "2026-09", 2);
  scheds["2026-09"] = solveSchedule(2026, 8, defaultPeople, 2, extSep, fairSep.cumulativePrior, fairSep.fairnessDebts);

  const extOct = getExternalWeekAssignments(scheds, "2026-10");
  const fairOct = calculateFairness(defaultPeople, scheds, "2026-10", 2);
  scheds["2026-10"] = solveSchedule(2026, 9, defaultPeople, 2, extOct, fairOct.cumulativePrior, fairOct.fairnessDebts);

  const check = validateSchedulesGlobal(scheds, defaultPeople);
  if (!check.valid) throw new Error(check.error);
});

runTest("Test 6: Year boundary (Dec 2026 -> Jan 2027)", () => {
  const scheds = {};
  const extDec = getExternalWeekAssignments(scheds, "2026-12");
  const fairDec = calculateFairness(defaultPeople, scheds, "2026-12", 2);
  scheds["2026-12"] = solveSchedule(2026, 11, defaultPeople, 2, extDec, fairDec.cumulativePrior, fairDec.fairnessDebts);

  const extJan = getExternalWeekAssignments(scheds, "2027-01");
  const fairJan = calculateFairness(defaultPeople, scheds, "2027-01", 2);
  scheds["2027-01"] = solveSchedule(2027, 0, defaultPeople, 2, extJan, fairJan.cumulativePrior, fairJan.fairnessDebts);

  const check = validateSchedulesGlobal(scheds, defaultPeople);
  if (!check.valid) throw new Error(check.error);
});

runTest("Test 7: Generation order independence", () => {
  const schedsA = {};
  schedsA["2026-09"] = solveSchedule(2026, 8, defaultPeople, 2, {}, {}, {});
  const extOctA = getExternalWeekAssignments(schedsA, "2026-10");
  const fairOctA = calculateFairness(defaultPeople, schedsA, "2026-10", 2);
  schedsA["2026-10"] = solveSchedule(2026, 9, defaultPeople, 2, extOctA, fairOctA.cumulativePrior, fairOctA.fairnessDebts);
  const checkA = validateSchedulesGlobal(schedsA, defaultPeople);
  if (!checkA.valid) throw new Error(checkA.error);

  const schedsB = {};
  schedsB["2026-10"] = solveSchedule(2026, 9, defaultPeople, 2, {}, {}, {});
  const extSepB = getExternalWeekAssignments(schedsB, "2026-09");
  const fairSepB = calculateFairness(defaultPeople, schedsB, "2026-09", 2);
  schedsB["2026-09"] = solveSchedule(2026, 8, defaultPeople, 2, extSepB, fairSepB.cumulativePrior, fairSepB.fairnessDebts);
  const checkB = validateSchedulesGlobal(schedsB, defaultPeople);
  if (!checkB.valid) throw new Error(checkB.error);
});

runTest("Test 8: Monthly scarcity handled gracefully", () => {
  const sched = solveSchedule(2026, 1, defaultPeople, 2, {}, {}, {});
  let count = 0;
  for (const names of Object.values(sched)) count += names.length;
  if (count !== 12) throw new Error(`Expected 12 assignments in Feb 2026, got ${count}`);
});

runTest("Test 9: Fairness simulation across multiple months", () => {
  const multiScheds = {};
  for (let m = 0; m < 6; m++) {
    const mKey = `2026-${String(m + 1).padStart(2, "0")}`;
    const ext = getExternalWeekAssignments(multiScheds, mKey);
    const fair = calculateFairness(defaultPeople, multiScheds, mKey, 2);
    multiScheds[mKey] = solveSchedule(2026, m, defaultPeople, 2, ext, fair.cumulativePrior, fair.fairnessDebts);
  }
  const totals = {};
  for (const p of defaultPeople) totals[p] = 0;
  for (const sched of Object.values(multiScheds)) {
    for (const names of Object.values(sched)) {
      for (const n of names) totals[n]++;
    }
  }
  const values = Object.values(totals);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > 2) throw new Error(`Fairness gap too large: ${max - min}`);
});

runTest("Test 10: Regeneration preserves others and stays valid", () => {
  const regScheds = {};
  for (let m = 0; m < 3; m++) {
    const mKey = `2026-${String(m + 1).padStart(2, "0")}`;
    const ext = getExternalWeekAssignments(regScheds, mKey);
    const fair = calculateFairness(defaultPeople, regScheds, mKey, 2);
    regScheds[mKey] = solveSchedule(2026, m, defaultPeople, 2, ext, fair.cumulativePrior, fair.fairnessDebts);
  }
  const origM1 = JSON.stringify(regScheds["2026-01"]);
  const origM3 = JSON.stringify(regScheds["2026-03"]);

  const extReg2 = getExternalWeekAssignments(regScheds, "2026-02");
  const fairReg2 = calculateFairness(defaultPeople, regScheds, "2026-02", 2);
  regScheds["2026-02"] = solveSchedule(2026, 1, defaultPeople, 2, extReg2, fairReg2.cumulativePrior, fairReg2.fairnessDebts);

  if (JSON.stringify(regScheds["2026-01"]) !== origM1) throw new Error("Month 1 changed unexpectedly");
  if (JSON.stringify(regScheds["2026-03"]) !== origM3) throw new Error("Month 3 changed unexpectedly");

  const check = validateSchedulesGlobal(regScheds, defaultPeople);
  if (!check.valid) throw new Error(check.error);
});

runTest("Test 11: Consecutive-month compensation", () => {
  const compScheds = {};
  const normalSched = solveSchedule(2026, 0, defaultPeople, 2, {}, {}, {});
  let alaeRemoved = false;
  for (const [date, names] of Object.entries(normalSched)) {
    if (names.includes("Alae") && !alaeRemoved) {
      normalSched[date] = [];
      alaeRemoved = true;
    }
  }
  compScheds["2026-01"] = normalSched;

  const ext2 = getExternalWeekAssignments(compScheds, "2026-02");
  const fair2 = calculateFairness(defaultPeople, compScheds, "2026-02", 2);
  if (fair2.fairnessDebts["Alae"] !== 1) throw new Error("Alae debt should be 1");

  compScheds["2026-02"] = solveSchedule(2026, 1, defaultPeople, 2, ext2, fair2.cumulativePrior, fair2.fairnessDebts);

  let alaeFebCount = 0;
  for (const names of Object.values(compScheds["2026-02"])) {
    if (names.includes("Alae")) alaeFebCount++;
  }
  if (alaeFebCount !== 2) throw new Error(`Alae should receive 2 days in Month 2, got ${alaeFebCount}`);
});

runTest("Test 12: Old data validation detects invalid schedules", () => {
  const invalidScheds = {
    "2026-09": {
      "2026-09-29": ["Othmane"]
    },
    "2026-10": {
      "2026-10-06": ["Othmane"]
    }
  };
  const result = validateSchedulesGlobal(invalidScheds, defaultPeople);
  if (result.valid) throw new Error("Invalid consecutive weeks were not detected");
});

console.log(`\nAll ${passedCount} tests passed successfully.`);
