const {
  ROTATION_ORDER,
  ANCHOR_DATE,
  isoDate,
  toMondayIndex,
  getWeekKey,
  getPreviousWeekKey,
  getNextWeekKey,
  getEffectiveHolidays,
  getStaticHolidays,
  computeSchedule,
  validateImportedData
} = require("../js/app.js");

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

runTest("Test 1: Rotation order preservation", () => {
  const res = computeSchedule("2026-10-31", ROTATION_ORDER, ANCHOR_DATE, {});
  const dates = Object.keys(res.assignments).sort();
  const first7 = dates.slice(0, 7).map(d => res.assignments[d]);
  const first14 = dates.slice(0, 14).map(d => res.assignments[d]);

  const set7 = new Set(first7);
  if (set7.size !== 7) throw new Error("Expected all 7 distinct people in first 7 slots");
  for (let i = 0; i < 7; i++) {
    if (first7[i] !== ROTATION_ORDER[i]) throw new Error(`Mismatch at index ${i}: expected ${ROTATION_ORDER[i]}, got ${first7[i]}`);
  }

  const counts14 = {};
  for (const p of first14) counts14[p] = (counts14[p] || 0) + 1;
  for (const p of ROTATION_ORDER) {
    if (counts14[p] !== 2) throw new Error(`Expected exactly 2 turns for ${p}, got ${counts14[p]}`);
  }
});

runTest("Test 2: Month boundary continuity", () => {
  const res = computeSchedule("2026-10-31", ROTATION_ORDER, ANCHOR_DATE, {});
  const dates = Object.keys(res.assignments).sort();
  const sepDates = dates.filter(d => d.startsWith("2026-09"));
  const octDates = dates.filter(d => d.startsWith("2026-10"));

  const lastSepDate = sepDates[sepDates.length - 1];
  const firstOctDate = octDates[0];

  const lastSepPerson = res.assignments[lastSepDate];
  const firstOctPerson = res.assignments[firstOctDate];

  const lastSepIdx = ROTATION_ORDER.indexOf(lastSepPerson);
  const expectedNextIdx = (lastSepIdx + 1) % ROTATION_ORDER.length;
  if (ROTATION_ORDER[expectedNextIdx] !== firstOctPerson) {
    throw new Error(`Month reset detected: Sep ended with ${lastSepPerson}, Oct started with ${firstOctPerson}`);
  }
});

runTest("Test 3: Year boundary continuity", () => {
  const res = computeSchedule("2027-01-31", ROTATION_ORDER, ANCHOR_DATE, {});
  const dates = Object.keys(res.assignments).sort();
  const decDates = dates.filter(d => d.startsWith("2026-12"));
  const janDates = dates.filter(d => d.startsWith("2027-01"));

  const lastDecDate = decDates[decDates.length - 1];
  const firstJanDate = janDates[0];

  const lastDecPerson = res.assignments[lastDecDate];
  const firstJanPerson = res.assignments[firstJanDate];

  const lastDecIdx = ROTATION_ORDER.indexOf(lastDecPerson);
  const expectedNextIdx = (lastDecIdx + 1) % ROTATION_ORDER.length;
  if (ROTATION_ORDER[expectedNextIdx] !== firstJanPerson) {
    throw new Error(`Year reset detected: Dec ended with ${lastDecPerson}, Jan started with ${firstJanPerson}`);
  }
});

runTest("Test 4: Holiday skipping and turn retention", () => {
  const wedDate = "2026-09-23";
  const thuDate = "2026-09-24";
  const holidays = { [wedDate]: "Test Holiday" };
  const res = computeSchedule("2026-09-30", ROTATION_ORDER, ANCHOR_DATE, holidays);

  if (res.assignments[wedDate]) throw new Error("Person assigned on holiday date");
  if (!res.holidays[wedDate]) throw new Error("Holiday not registered");
  if (res.assignments[thuDate] !== ROTATION_ORDER[1]) {
    throw new Error(`Expected ${ROTATION_ORDER[1]} to work on Thursday after holiday, got ${res.assignments[thuDate]}`);
  }
});

runTest("Test 5: Capacity constraint (max 1 person per day)", () => {
  const res = computeSchedule("2027-09-21", ROTATION_ORDER, ANCHOR_DATE, {});
  for (const [d, p] of Object.entries(res.assignments)) {
    if (typeof p !== "string" || !p.trim().length) throw new Error(`Invalid assignment on ${d}`);
  }
});

runTest("Test 6: Allowed days constraint (Tue/Wed/Thu only)", () => {
  const res = computeSchedule("2027-09-21", ROTATION_ORDER, ANCHOR_DATE, {});
  for (const d of Object.keys(res.assignments)) {
    const [y, m, day] = d.split("-").map(Number);
    const wd = toMondayIndex(new Date(y, m - 1, day).getDay());
    if (wd < 2 || wd > 4) throw new Error(`Assignment on non-remote weekday ${d} (weekday index ${wd})`);
  }
});

runTest("Test 7: Consecutive weeks constraint", () => {
  const res = computeSchedule("2027-09-21", ROTATION_ORDER, ANCHOR_DATE, {});
  const personWeeks = {};
  for (const [d, p] of Object.entries(res.assignments)) {
    const wk = getWeekKey(d);
    if (!personWeeks[p]) personWeeks[p] = [];
    personWeeks[p].push(wk);
  }
  for (const [p, wks] of Object.entries(personWeeks)) {
    const unique = [...new Set(wks)].sort();
    if (unique.length !== wks.length) throw new Error(`${p} assigned multiple times in the same week`);
    for (let i = 0; i < unique.length - 1; i++) {
      if (getNextWeekKey(unique[i]) === unique[i + 1]) {
        throw new Error(`${p} assigned in consecutive weeks ${unique[i]} and ${unique[i + 1]}`);
      }
    }
  }
});

runTest("Test 8: Deterministic generation", () => {
  const res1 = computeSchedule("2027-03-31", ROTATION_ORDER, ANCHOR_DATE, {});
  const res2 = computeSchedule("2027-03-31", ROTATION_ORDER, ANCHOR_DATE, {});
  if (JSON.stringify(res1) !== JSON.stringify(res2)) throw new Error("Repeated generation is not deterministic");

  const clonedOrder = [...ROTATION_ORDER];
  const res3 = computeSchedule("2027-03-31", clonedOrder, ANCHOR_DATE, {});
  if (JSON.stringify(res1) !== JSON.stringify(res3)) throw new Error("Generation with cloned array is not deterministic");
});

runTest("Test 9: API outage and cached holiday fallback", () => {
  const cachedHolidays = [{ date: "2026-11-18", name: "Independence Day" }];
  const effectiveCached = getEffectiveHolidays(cachedHolidays, []);
  const resWithCache = computeSchedule("2026-11-30", ROTATION_ORDER, ANCHOR_DATE, effectiveCached);
  if (!resWithCache.holidays["2026-11-18"]) throw new Error("Cached holiday not recognized");

  const staticFallback = getStaticHolidays(2026);
  if (!Array.isArray(staticFallback) || staticFallback.length === 0) throw new Error("Static fallback empty");
  const fallbackEffective = getEffectiveHolidays(staticFallback, []);
  if (!fallbackEffective["2026-11-18"]) throw new Error("Static fallback does not include Independence Day");
});

runTest("Test 10: Holiday manual overrides", () => {
  const original = computeSchedule("2026-10-15", ROTATION_ORDER, ANCHOR_DATE, {});
  const targetDate = "2026-09-29";
  const originalPerson = original.assignments[targetDate];

  const overrides = [{ date: targetDate, name: "Special Offsite", isHoliday: true }];
  const effective = getEffectiveHolidays([], overrides);
  const updated = computeSchedule("2026-10-15", ROTATION_ORDER, ANCHOR_DATE, effective);

  if (updated.assignments[targetDate]) throw new Error("Override date still assigned to person");
  if (!updated.holidays[targetDate]) throw new Error("Holiday override not recorded in holidays map");

  const nextSlot = "2026-09-30";
  if (updated.assignments[nextSlot] !== originalPerson) {
    throw new Error(`Expected ${originalPerson} on ${nextSlot}, got ${updated.assignments[nextSlot]}`);
  }

  const workdayOverride = [{ date: "2026-11-18", name: "Working Day Override", isHoliday: false }];
  const effectiveWithOverride = getEffectiveHolidays([{ date: "2026-11-18", name: "Independence Day" }], workdayOverride);
  if (effectiveWithOverride["2026-11-18"]) throw new Error("Workday override failed to unmark holiday");
});

console.log(`\nAll ${passedCount} tests passed successfully.`);
