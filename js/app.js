const STORAGE_SETTINGS = "remoteCalendarSettingsV1";
const STORAGE_SCHEDULES = "remoteCalendarSchedulesV1";
const BACKUP_VERSION = 1;

const defaultSettings = {
  people: ["Alae", "Othmane", "Omar", "Zakaria", "Zouhair", "Hamza", "Yassine"],
  daysPerPerson: 2
};

const palette = [
  "#a970ff",
  "#ff6fcf",
  "#6bb8ff",
  "#62d9a3",
  "#ffb45f",
  "#ff6b7f",
  "#b9d866",
  "#7f8cff",
  "#eb8dff",
  "#54d5d0",
  "#ffc857",
  "#ff8ea1"
];

let settings = loadSettings();
let schedules = loadSchedules();
let currentDate = new Date();
currentDate.setDate(1);

const monthLabel = typeof document !== "undefined" ? document.getElementById("monthLabel") : null;
const calendarGrid = typeof document !== "undefined" ? document.getElementById("calendarGrid") : null;
const summary = typeof document !== "undefined" ? document.getElementById("summary") : null;
const legend = typeof document !== "undefined" ? document.getElementById("legend") : null;
const settingsModal = typeof document !== "undefined" ? document.getElementById("settingsModal") : null;
const daysPerPersonInput = typeof document !== "undefined" ? document.getElementById("daysPerPersonInput") : null;
const peopleEditor = typeof document !== "undefined" ? document.getElementById("peopleEditor") : null;
const toast = typeof document !== "undefined" ? document.getElementById("toast") : null;
const importFileInput = typeof document !== "undefined" ? document.getElementById("importFileInput") : null;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS));
    if (saved && Array.isArray(saved.people)) {
      return {
        people: saved.people,
        daysPerPerson: Number(saved.daysPerPerson) || 2
      };
    }
  } catch {}
  return structuredClone(defaultSettings);
}

function loadSchedules() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SCHEDULES)) || {};
  } catch {
    return {};
  }
}

function saveSettingsState() {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

function saveSchedulesState() {
  localStorage.setItem(STORAGE_SCHEDULES, JSON.stringify(schedules));
}

function monthKey(date) {
  const y = typeof date === "string" ? date.slice(0, 4) : date.getFullYear();
  const m = typeof date === "string" ? date.slice(5, 7) : String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toMondayIndex(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

function getWeekKey(dateInput) {
  let y, m, d;
  if (typeof dateInput === "string") {
    [y, m, d] = dateInput.split("-").map(Number);
  } else {
    y = dateInput.getFullYear();
    m = dateInput.getMonth() + 1;
    d = dateInput.getDate();
  }
  const date = new Date(y, m - 1, d);
  const weekday = toMondayIndex(date.getDay());
  const monday = new Date(y, m - 1, d - (weekday - 1));
  return isoDate(monday.getFullYear(), monday.getMonth(), monday.getDate());
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function getPreviousWeekKey(wk) {
  return addDays(wk, -7);
}

function getNextWeekKey(wk) {
  return addDays(wk, 7);
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getEligibleDates(year, month) {
  const dates = [];
  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day++) {
    const date = new Date(year, month, day);
    const weekday = toMondayIndex(date.getDay());
    if (weekday >= 2 && weekday <= 4) {
      dates.push(isoDate(year, month, day));
    }
  }
  return dates;
}

function getExternalWeekAssignments(storedSchedules, excludeMonthKey) {
  const externalWeeks = {};
  for (const [mKey, sched] of Object.entries(storedSchedules)) {
    if (mKey === excludeMonthKey) continue;
    if (!sched || typeof sched !== "object") continue;
    for (const [date, names] of Object.entries(sched)) {
      if (!Array.isArray(names) || !names.length) continue;
      const wk = getWeekKey(date);
      if (!externalWeeks[wk]) externalWeeks[wk] = new Set();
      for (const name of names) {
        externalWeeks[wk].add(name);
      }
    }
  }
  return externalWeeks;
}

function calculateFairness(people, storedSchedules, excludeMonthKey, targetPerMonth) {
  const cumulativePrior = {};
  const fairnessDebts = {};
  for (const p of people) {
    cumulativePrior[p] = 0;
  }
  let otherMonthsCount = 0;
  for (const [mKey, sched] of Object.entries(storedSchedules)) {
    if (mKey === excludeMonthKey) continue;
    if (!sched || typeof sched !== "object") continue;
    const hasAssignments = Object.values(sched).some(names => Array.isArray(names) && names.length > 0);
    if (!hasAssignments) continue;
    otherMonthsCount++;
    for (const names of Object.values(sched)) {
      if (Array.isArray(names)) {
        for (const n of names) {
          if (cumulativePrior[n] !== undefined) {
            cumulativePrior[n]++;
          }
        }
      }
    }
  }
  for (const p of people) {
    const target = otherMonthsCount * targetPerMonth;
    fairnessDebts[p] = target - cumulativePrior[p];
  }
  return { cumulativePrior, fairnessDebts, otherMonthsCount };
}

function solveSchedule(year, month, people, daysPerPersonTarget, externalWeeks, cumulativePrior, fairnessDebts) {
  const eligibleDates = getEligibleDates(year, month);
  const weekMap = {};
  for (const d of eligibleDates) {
    const wk = getWeekKey(d);
    if (!weekMap[wk]) weekMap[wk] = [];
    weekMap[wk].push(d);
  }
  const weekKeys = Object.keys(weekMap).sort();
  const W = weekKeys.length;
  const P = people.length;

  const weekCapacities = weekKeys.map(wk => weekMap[wk].length);
  const suffixCapacity = new Array(W + 1).fill(0);
  for (let i = W - 1; i >= 0; i--) {
    suffixCapacity[i] = suffixCapacity[i + 1] + weekCapacities[i];
  }

  const personWeekAllowed = Array.from({ length: W }, () => new Array(P).fill(true));
  for (let i = 0; i < W; i++) {
    const wk = weekKeys[i];
    const prevWk = getPreviousWeekKey(wk);
    const nextWk = getNextWeekKey(wk);
    for (let p = 0; p < P; p++) {
      const person = people[p];
      if (externalWeeks[wk] && externalWeeks[wk].has(person)) {
        personWeekAllowed[i][p] = false;
      }
      if (externalWeeks[prevWk] && externalWeeks[prevWk].has(person)) {
        personWeekAllowed[i][p] = false;
      }
      if (externalWeeks[nextWk] && externalWeeks[nextWk].has(person)) {
        personWeekAllowed[i][p] = false;
      }
    }
  }

  let bestScore = -Infinity;
  let bestTotalAssignments = -1;
  let bestSolution = null;

  const currentSolution = Array.from({ length: W }, () => []);
  const personCounts = new Array(P).fill(0);
  let currentTotalAssignments = 0;

  function evaluateSolution() {
    let targetMetCount = 0;
    let debtBonus = 0;
    let sumSq = 0;
    for (let p = 0; p < P; p++) {
      const c = personCounts[p];
      if (c === daysPerPersonTarget) targetMetCount++;
      const debt = fairnessDebts[people[p]] || 0;
      debtBonus += c * debt * 50;
      const totalCum = (cumulativePrior[people[p]] || 0) + c;
      sumSq += totalCum * totalCum;
    }
    return currentTotalAssignments * 100000 + targetMetCount * 2000 + debtBonus - sumSq * 10;
  }

  function search(weekIdx) {
    const maxPossibleAssignments = currentTotalAssignments + suffixCapacity[weekIdx];
    if (maxPossibleAssignments < bestTotalAssignments) {
      return;
    }

    if (weekIdx === W) {
      const score = evaluateSolution();
      if (currentTotalAssignments > bestTotalAssignments || (currentTotalAssignments === bestTotalAssignments && score > bestScore)) {
        bestScore = score;
        bestTotalAssignments = currentTotalAssignments;
        bestSolution = currentSolution.map(arr => [...arr]);
      }
      return;
    }

    const maxCapacity = weekCapacities[weekIdx];
    const prevAssigned = weekIdx > 0 ? new Set(currentSolution[weekIdx - 1]) : new Set();
    const availablePeople = [];
    for (let p = 0; p < P; p++) {
      if (!personWeekAllowed[weekIdx][p]) continue;
      if (prevAssigned.has(p)) continue;
      if (personCounts[p] >= daysPerPersonTarget) continue;
      availablePeople.push(p);
    }

    availablePeople.sort((a, b) => {
      const debtA = fairnessDebts[people[a]] || 0;
      const debtB = fairnessDebts[people[b]] || 0;
      if (debtB !== debtA) return debtB - debtA;
      const cumA = (cumulativePrior[people[a]] || 0) + personCounts[a];
      const cumB = (cumulativePrior[people[b]] || 0) + personCounts[b];
      if (cumA !== cumB) return cumA - cumB;
      return Math.random() - 0.5;
    });

    const maxK = Math.min(availablePeople.length, maxCapacity);

    function generateSubsets(start, currentSubset, k) {
      if (currentSubset.length === k) {
        currentSolution[weekIdx] = currentSubset;
        for (const p of currentSubset) personCounts[p]++;
        currentTotalAssignments += k;

        search(weekIdx + 1);

        currentTotalAssignments -= k;
        for (const p of currentSubset) personCounts[p]--;
        currentSolution[weekIdx] = [];
        return;
      }
      for (let i = start; i < availablePeople.length; i++) {
        currentSubset.push(availablePeople[i]);
        generateSubsets(i + 1, currentSubset, k);
        currentSubset.pop();
      }
    }

    for (let k = maxK; k >= 0; k--) {
      if (currentTotalAssignments + k + suffixCapacity[weekIdx + 1] < bestTotalAssignments) {
        break;
      }
      generateSubsets(0, [], k);
    }
  }

  search(0);

  const schedule = {};
  for (const d of eligibleDates) schedule[d] = [];
  if (bestSolution) {
    for (let i = 0; i < W; i++) {
      const wk = weekKeys[i];
      const dates = shuffle([...weekMap[wk]]);
      const assignedPersonIndices = shuffle([...bestSolution[i]]);
      for (let j = 0; j < assignedPersonIndices.length; j++) {
        schedule[dates[j]] = [people[assignedPersonIndices[j]]];
      }
    }
  }

  return schedule;
}

function generateSchedule(year, month) {
  const currentMKey = monthKey(new Date(year, month, 1));
  const externalWeeks = getExternalWeekAssignments(schedules, currentMKey);
  const { cumulativePrior, fairnessDebts } = calculateFairness(settings.people, schedules, currentMKey, settings.daysPerPerson);
  return solveSchedule(year, month, settings.people, settings.daysPerPerson, externalWeeks, cumulativePrior, fairnessDebts);
}

function validateSchedulesGlobal(storedSchedules, people) {
  const personSet = new Set(people);
  const personWeeks = {};

  for (const [, sched] of Object.entries(storedSchedules)) {
    if (!sched || typeof sched !== "object") continue;
    for (const [date, names] of Object.entries(sched)) {
      if (!Array.isArray(names) || !names.length) continue;
      if (names.length > 1) {
        return { valid: false, error: `Date ${date} has more than one person assigned (${names.join(", ")}).` };
      }
      const person = names[0];
      if (!personSet.has(person)) {
        return { valid: false, error: `Unknown person ${person} on date ${date}.` };
      }
      const [y, m, d] = date.split("-").map(Number);
      const wd = toMondayIndex(new Date(y, m - 1, d).getDay());
      if (wd < 2 || wd > 4) {
        return { valid: false, error: `Date ${date} is not an allowed weekday (only Tue, Wed, Thu allowed).` };
      }
      const wk = getWeekKey(date);
      if (!personWeeks[person]) personWeeks[person] = [];
      personWeeks[person].push({ date, wk });
    }
  }

  for (const [person, list] of Object.entries(personWeeks)) {
    const datesByWeek = {};
    for (const item of list) {
      if (!datesByWeek[item.wk]) datesByWeek[item.wk] = [];
      datesByWeek[item.wk].push(item.date);
    }
    for (const [wk, dates] of Object.entries(datesByWeek)) {
      if (dates.length > 1) {
        return {
          valid: false,
          error: `${person} is assigned multiple times during the week beginning ${wk} (${dates.join(", ")}).`
        };
      }
    }

    const uniqueWeeks = Object.keys(datesByWeek).sort();
    for (let i = 0; i < uniqueWeeks.length - 1; i++) {
      const w1 = uniqueWeeks[i];
      const w2 = uniqueWeeks[i + 1];
      if (getNextWeekKey(w1) === w2) {
        return {
          valid: false,
          error: `Import conflict: ${person} is assigned during consecutive weeks beginning ${w1} and ${w2}.`
        };
      }
    }
  }

  return { valid: true };
}

function migrateExistingSchedules() {
  const check = validateSchedulesGlobal(schedules, settings.people);
  if (check.valid) return false;

  const sortedMonthKeys = Object.keys(schedules).sort();
  const migrated = {};
  for (const mKey of sortedMonthKeys) {
    const [y, m] = mKey.split("-").map(Number);
    const externalWeeks = getExternalWeekAssignments(migrated, mKey);
    const { cumulativePrior, fairnessDebts } = calculateFairness(settings.people, migrated, mKey, settings.daysPerPerson);
    migrated[mKey] = solveSchedule(y, m - 1, settings.people, settings.daysPerPerson, externalWeeks, cumulativePrior, fairnessDebts);
  }
  schedules = migrated;
  saveSchedulesState();
  return true;
}

function ensureCurrentSchedule() {
  const key = monthKey(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (!schedules[key]) {
    try {
      schedules[key] = generateSchedule(year, month);
      saveSchedulesState();
    } catch (error) {
      showToast(error.message, true);
      schedules[key] = {};
    }
  }
  return schedules[key];
}

function personColor(name) {
  const index = settings.people.indexOf(name);
  return palette[(index >= 0 ? index : 0) % palette.length];
}

function renderLegend(schedule) {
  if (!legend) return;
  legend.innerHTML = "";

  const personCounts = {};
  for (const p of settings.people) personCounts[p] = 0;
  for (const names of Object.values(schedule)) {
    for (const n of names) {
      if (personCounts[n] !== undefined) personCounts[n]++;
    }
  }

  settings.people.forEach(person => {
    const count = personCounts[person] || 0;
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${personColor(person)}"></span><span>${escapeHtml(person)} (${count})</span>`;
    legend.appendChild(item);
  });
}

function renderSummary(schedule) {
  if (!summary) return;
  const totalAssignments = Object.values(schedule).reduce((sum, names) => sum + names.length, 0);
  const activeDays = Object.values(schedule).filter(names => names.length).length;
  const targetAssignments = settings.people.length * settings.daysPerPerson;

  summary.innerHTML = `
    <div class="summary-pill">${settings.people.length} people</div>
    <div class="summary-pill">Target: ${settings.daysPerPerson} / person</div>
    <div class="summary-pill">Scheduled: ${totalAssignments} / ${targetAssignments} target assignments</div>
    <div class="summary-pill">${activeDays} active remote days</div>
  `;
}

function renderCalendar() {
  if (!calendarGrid || !monthLabel) return;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const schedule = ensureCurrentSchedule();

  monthLabel.textContent = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  renderLegend(schedule);
  renderSummary(schedule);
  calendarGrid.innerHTML = "";

  const first = new Date(year, month, 1);
  const leading = toMondayIndex(first.getDay()) - 1;
  const totalDays = daysInMonth(year, month);
  const totalCells = Math.ceil((leading + totalDays) / 7) * 7;
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  for (let cell = 0; cell < totalCells; cell++) {
    const dayNumber = cell - leading + 1;
    const dayEl = document.createElement("div");

    if (dayNumber < 1 || dayNumber > totalDays) {
      dayEl.className = "day empty";
      calendarGrid.appendChild(dayEl);
      continue;
    }

    const date = new Date(year, month, dayNumber);
    const weekday = toMondayIndex(date.getDay());
    const dateIso = isoDate(year, month, dayNumber);
    const allowed = weekday >= 2 && weekday <= 4;
    const names = schedule[dateIso] || [];

    dayEl.className = `day${allowed ? "" : " disabled"}${dateIso === todayIso ? " today" : ""}`;

    const stateText = allowed ? (names.length ? `${names.length} remote` : "Available") : "Office";
    const chips = names.map(name => `
      <div class="remote-chip" title="${escapeHtml(name)}">
        <span class="dot" style="background:${personColor(name)}"></span>
        <span>${escapeHtml(name)}</span>
      </div>
    `).join("");

    dayEl.innerHTML = `
      <div class="day-number">
        <span class="num">${dayNumber}</span>
        <span class="day-state">${stateText}</span>
      </div>
      <div class="remote-list">${chips}</div>
    `;

    calendarGrid.appendChild(dayEl);
  }
}

function regenerateCurrentMonth() {
  const key = monthKey(currentDate);
  try {
    schedules[key] = generateSchedule(currentDate.getFullYear(), currentDate.getMonth());
    saveSchedulesState();
    renderCalendar();
    showToast("Fresh schedule generated.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function openSettings() {
  if (!settingsModal) return;
  daysPerPersonInput.value = settings.daysPerPerson;
  renderPeopleEditor();
  settingsModal.classList.add("open");
}

function closeSettings() {
  if (!settingsModal) return;
  settingsModal.classList.remove("open");
}

function renderPeopleEditor() {
  if (!peopleEditor) return;
  peopleEditor.innerHTML = "";

  settings.people.forEach((person, index) => {
    const row = document.createElement("div");
    row.className = "person-row";
    row.innerHTML = `
      <input class="input person-name" value="${escapeHtml(person)}" data-index="${index}" aria-label="Person name">
      <button class="btn danger remove-person" data-index="${index}">Remove</button>
    `;
    peopleEditor.appendChild(row);
  });

  document.querySelectorAll(".remove-person").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const tempPeople = getPeopleFromEditor();
      tempPeople.splice(index, 1);
      setPeopleEditor(tempPeople);
    });
  });
}

function setPeopleEditor(people) {
  if (!peopleEditor) return;
  peopleEditor.innerHTML = "";

  people.forEach((person, index) => {
    const row = document.createElement("div");
    row.className = "person-row";
    row.innerHTML = `
      <input class="input person-name" value="${escapeHtml(person)}" data-index="${index}" aria-label="Person name">
      <button class="btn danger remove-person" data-index="${index}">Remove</button>
    `;
    peopleEditor.appendChild(row);
  });

  document.querySelectorAll(".remove-person").forEach(button => {
    button.addEventListener("click", () => {
      const list = getPeopleFromEditor();
      list.splice(Number(button.dataset.index), 1);
      setPeopleEditor(list);
    });
  });
}

function getPeopleFromEditor() {
  if (!peopleEditor) return [];
  return [...peopleEditor.querySelectorAll(".person-name")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function saveSettingsFromModal() {
  const people = getPeopleFromEditor();
  const daysPerPerson = Math.max(1, Number(daysPerPersonInput.value) || 2);

  if (!people.length) {
    showToast("Add at least one person.", true);
    return;
  }

  const duplicate = people.find((name, index) => people.findIndex(other => other.toLowerCase() === name.toLowerCase()) !== index);
  if (duplicate) {
    showToast(`Duplicate person: ${duplicate}`, true);
    return;
  }

  settings = {
    people,
    daysPerPerson
  };

  const key = monthKey(currentDate);
  try {
    schedules[key] = generateSchedule(currentDate.getFullYear(), currentDate.getMonth());
  } catch (err) {
    schedules[key] = {};
  }

  saveSettingsState();
  saveSchedulesState();
  closeSettings();
  renderCalendar();
  showToast("Settings saved and schedule updated.");
}

function addPerson() {
  const people = getPeopleFromEditor();
  people.push(`Person ${people.length + 1}`);
  setPeopleEditor(people);

  requestAnimationFrame(() => {
    const inputs = peopleEditor.querySelectorAll(".person-name");
    const last = inputs[inputs.length - 1];
    last.focus();
    last.select();
  });
}

function exportCalendarData() {
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    schedules
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `work-calendar-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Calendar data exported.");
}

function validateImportedData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid backup file.");
  }

  if (!data.settings || typeof data.settings !== "object") {
    throw new Error("The backup does not contain calendar settings.");
  }

  if (!data.schedules || typeof data.schedules !== "object" || Array.isArray(data.schedules)) {
    throw new Error("The backup does not contain valid schedules.");
  }

  const importedSettings = data.settings;

  if (!Array.isArray(importedSettings.people) || !importedSettings.people.length) {
    throw new Error("The backup contains an invalid people list.");
  }

  const people = importedSettings.people
    .map(person => String(person).trim())
    .filter(Boolean);

  const normalizedNames = people.map(person => person.toLowerCase());

  if (people.length !== importedSettings.people.length || new Set(normalizedNames).size !== people.length) {
    throw new Error("The backup contains empty or duplicate names.");
  }

  const daysPerPerson = Number(importedSettings.daysPerPerson);
  if (!Number.isInteger(daysPerPerson) || daysPerPerson < 1) {
    throw new Error("The backup contains an invalid monthly remote-day count.");
  }

  const globalCheck = validateSchedulesGlobal(data.schedules, people);
  if (!globalCheck.valid) {
    throw new Error(globalCheck.error);
  }

  return {
    settings: {
      people,
      daysPerPerson
    },
    schedules: data.schedules
  };
}

async function importCalendarData(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = validateImportedData(parsed);

    const confirmed = window.confirm(
      "Import this calendar backup? This will replace the schedules and settings currently saved in this browser."
    );

    if (!confirmed) return;

    settings = imported.settings;
    schedules = imported.schedules;

    saveSettingsState();
    saveSchedulesState();
    renderCalendar();
    showToast("Calendar data imported.");
  } catch (error) {
    showToast(`Import failed: ${error.message}`, true);
  } finally {
    if (importFileInput) importFileInput.value = "";
  }
}

function showToast(message, error = false) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (typeof document !== "undefined") {
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    const now = new Date();
    currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    renderCalendar();
  });

  document.getElementById("regenerateBtn").addEventListener("click", regenerateCurrentMonth);
  document.getElementById("exportBtn").addEventListener("click", exportCalendarData);
  document.getElementById("importBtn").addEventListener("click", () => importFileInput.click());
  importFileInput.addEventListener("change", event => importCalendarData(event.target.files[0]));
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("cancelSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettingsFromModal);
  document.getElementById("addPersonBtn").addEventListener("click", addPerson);

  settingsModal.addEventListener("click", event => {
    if (event.target === settingsModal) {
      closeSettings();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSettings();
    }
  });

  const migrated = migrateExistingSchedules();
  renderCalendar();
  if (migrated) {
    showToast("Some saved schedules were regenerated to match the updated scheduling rules.");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isoDate,
    toMondayIndex,
    getWeekKey,
    getPreviousWeekKey,
    getNextWeekKey,
    getEligibleDates,
    monthKey,
    getExternalWeekAssignments,
    calculateFairness,
    solveSchedule,
    validateSchedulesGlobal,
    migrateExistingSchedules
  };
}
