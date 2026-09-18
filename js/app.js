const STORAGE_SETTINGS = "remoteCalendarSettingsV1";
const STORAGE_SCHEDULES = "remoteCalendarSchedulesV1";
const BACKUP_VERSION = 1;
const PREFERRED_WEEKDAYS = [2, 3, 4];

const defaultSettings = {
  people: ["Alae", "Othmane", "Omar", "Zakaria", "Zouhair", "Hamza", "Yassine"],
  daysPerPerson: 3,
  maxPerDay: 2,
  maxPeoplePerWeek: 5,
  allowedWeekdays: [2, 3, 4]
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

const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const summary = document.getElementById("summary");
const legend = document.getElementById("legend");
const settingsModal = document.getElementById("settingsModal");
const daysPerPersonInput = document.getElementById("daysPerPersonInput");
const maxPerDayInput = document.getElementById("maxPerDayInput");
const maxPeoplePerWeekInput = document.getElementById("maxPeoplePerWeekInput");
const weekdayOptions = document.getElementById("weekdayOptions");
const peopleEditor = document.getElementById("peopleEditor");
const toast = document.getElementById("toast");
const importFileInput = document.getElementById("importFileInput");

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS));
    if (saved && Array.isArray(saved.people) && Array.isArray(saved.allowedWeekdays)) {
      return {
        people: saved.people,
        daysPerPerson: Number(saved.daysPerPerson) || 3,
        maxPerDay: Number(saved.maxPerDay) || 2,
        maxPeoplePerWeek: Number(saved.maxPeoplePerWeek) || 5,
        allowedWeekdays: saved.allowedWeekdays
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekKeyFromIso(dateIso) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = toMondayIndex(date.getDay());
  const monday = new Date(year, month - 1, day - (weekday - 1));
  return isoDate(monday.getFullYear(), monday.getMonth(), monday.getDate());
}

function toMondayIndex(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
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
    if (settings.allowedWeekdays.includes(weekday)) {
      dates.push(isoDate(year, month, day));
    }
  }

  return dates;
}

function getExternalWeekConstraints(year, month) {
  const targetKey = monthKey(new Date(year, month, 1));
  const total = daysInMonth(year, month);
  const firstDayKey = weekKeyFromIso(isoDate(year, month, 1));
  const lastDayKey = weekKeyFromIso(isoDate(year, month, total));
  const boundaryWeeks = new Set([firstDayKey, lastDayKey]);
  const constraints = {};

  const neighbors = [
    new Date(year, month - 1, 1),
    new Date(year, month + 1, 1)
  ];

  for (const neighbor of neighbors) {
    const nKey = monthKey(neighbor);
    if (nKey === targetKey) continue;
    const schedule = schedules[nKey];
    if (!schedule) continue;

    for (const [date, names] of Object.entries(schedule)) {
      if (!Array.isArray(names) || !names.length) continue;
      const wk = weekKeyFromIso(date);
      if (!boundaryWeeks.has(wk)) continue;

      if (!constraints[wk]) constraints[wk] = new Set();
      for (const name of names) {
        constraints[wk].add(name);
      }
    }
  }

  return constraints;
}

function validateBoundaryWeeks(year, month, schedule) {
  const externalConstraints = getExternalWeekConstraints(year, month);
  const maxWeeklyPeople = Math.min(settings.maxPeoplePerWeek, settings.people.length);

  const weekPeople = {};

  for (const [date, names] of Object.entries(schedule)) {
    if (!Array.isArray(names) || !names.length) continue;
    const wk = weekKeyFromIso(date);
    if (!weekPeople[wk]) weekPeople[wk] = new Set();
    for (const name of names) weekPeople[wk].add(name);
  }

  for (const [wk, ext] of Object.entries(externalConstraints)) {
    if (!ext.size) continue;

    const currentPeople = weekPeople[wk];
    if (!currentPeople) continue;

    for (const name of currentPeople) {
      if (ext.has(name)) return { valid: false };
    }

    const combined = new Set([...currentPeople, ...ext]);
    if (combined.size > maxWeeklyPeople) return { valid: false };
  }

  return { valid: true };
}

function scheduleCapacityCheck(year, month) {
  const eligibleDates = getEligibleDates(year, month);
  const assignmentsNeeded = settings.people.length * settings.daysPerPerson;

  if (!settings.people.length) {
    return { ok: false, reason: "Add at least one person." };
  }

  if (!settings.allowedWeekdays.length) {
    return { ok: false, reason: "Select at least one allowed weekday." };
  }

  const externalConstraints = getExternalWeekConstraints(year, month);
  const maxWeeklyPeople = Math.min(settings.maxPeoplePerWeek, settings.people.length);

  const weeks = {};
  for (const date of eligibleDates) {
    const wk = weekKeyFromIso(date);
    if (!weeks[wk]) weeks[wk] = [];
    weeks[wk].push(date);
  }

  const weekKeys = Object.keys(weeks);

  for (const person of settings.people) {
    let available = 0;
    for (const wk of weekKeys) {
      const ext = externalConstraints[wk];
      if (ext && ext.has(person)) continue;
      const extSize = ext ? ext.size : 0;
      if (maxWeeklyPeople - extSize > 0) available++;
    }
    if (available < settings.daysPerPerson) {
      const blockedWeeks = weekKeys.filter(wk => {
        const ext = externalConstraints[wk];
        return ext && ext.has(person);
      });
      if (blockedWeeks.length) {
        return {
          ok: false,
          reason: `Impossible configuration: ${person} already has a remote day during the week of ${blockedWeeks[0]} from an adjacent month, leaving only ${available} available weeks (needs ${settings.daysPerPerson}).`
        };
      }
      return {
        ok: false,
        reason: `Impossible configuration: each person needs ${settings.daysPerPerson} remote days in different calendar weeks, but this month only has ${available} usable weeks.`
      };
    }
  }

  let totalCapacity = 0;
  for (const wk of weekKeys) {
    const ext = externalConstraints[wk];
    const extSize = ext ? ext.size : 0;
    const remaining = Math.max(0, maxWeeklyPeople - extSize);
    const dateCapacity = weeks[wk].length * settings.maxPerDay;
    totalCapacity += Math.min(dateCapacity, remaining);
  }

  if (totalCapacity < assignmentsNeeded) {
    const boundaryBottleneck = weekKeys.find(wk => {
      const ext = externalConstraints[wk];
      return ext && ext.size > 0;
    });

    if (boundaryBottleneck) {
      const ext = externalConstraints[boundaryBottleneck];
      const [wy, wm, wd] = boundaryBottleneck.split("-").map(Number);
      const sunday = new Date(wy, wm - 1, wd + 6);
      const sundayStr = isoDate(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
      return {
        ok: false,
        reason: `Impossible configuration: the week of ${boundaryBottleneck} – ${sundayStr} already contains ${ext.size} remote workers from an adjacent month, leaving insufficient weekly capacity.`
      };
    }

    let suggestedWeeklyLimit = settings.maxPeoplePerWeek;
    while (suggestedWeeklyLimit < settings.people.length) {
      suggestedWeeklyLimit++;
      const possible = weekKeys.reduce((sum, wk) => {
        const ext = externalConstraints[wk];
        const extSize = ext ? ext.size : 0;
        const remaining = Math.max(0, suggestedWeeklyLimit - extSize);
        const dateCapacity = weeks[wk].length * settings.maxPerDay;
        return sum + Math.min(dateCapacity, remaining, settings.people.length);
      }, 0);
      if (possible >= assignmentsNeeded) break;
    }

    const suggestion = suggestedWeeklyLimit <= settings.people.length
      ? ` Increase Maximum distinct people per week to at least ${suggestedWeeklyLimit}, or increase another capacity setting.`
      : " Increase the per-day limit or allow more weekdays.";

    return {
      ok: false,
      reason: `Impossible configuration: ${assignmentsNeeded} assignments are required, but the current weekly and daily limits allow at most ${totalCapacity}.${suggestion}`
    };
  }

  return { ok: true };
}

function solveWeekAssignment(people, weekBuckets, daysPerPerson) {
  const P = people.length;
  const W = weekBuckets.length;
  const source = 0;
  const sink = P + W + 1;
  const nodeCount = sink + 1;

  const adj = Array.from({ length: nodeCount }, () => []);

  function addEdge(u, v, cap) {
    adj[u].push({ to: v, cap, flow: 0, rev: adj[v].length });
    adj[v].push({ to: u, cap: 0, flow: 0, rev: adj[u].length - 1 });
  }

  const peopleOrder = shuffle([...Array(P).keys()]);
  const weekOrder = shuffle([...Array(W).keys()]);

  for (const pi of peopleOrder) {
    addEdge(source, 1 + pi, daysPerPerson);
  }

  for (const pi of peopleOrder) {
    const shuffledWeekOrder = shuffle([...weekOrder]);
    for (const wi of shuffledWeekOrder) {
      const bucket = weekBuckets[wi];
      if (bucket.externalPeople.has(people[pi])) continue;
      if (bucket.remainingCapacity <= 0) continue;
      if (!bucket.dates.length) continue;
      addEdge(1 + pi, 1 + P + wi, 1);
    }
  }

  for (const wi of weekOrder) {
    if (weekBuckets[wi].remainingCapacity > 0) {
      addEdge(1 + P + wi, sink, weekBuckets[wi].remainingCapacity);
    }
  }

  let totalFlow = 0;

  while (true) {
    const prev = new Array(nodeCount).fill(-1);
    const prevEdge = new Array(nodeCount).fill(-1);
    prev[source] = source;
    const queue = [source];
    let qi = 0;

    while (qi < queue.length && prev[sink] === -1) {
      const u = queue[qi++];
      for (let i = 0; i < adj[u].length; i++) {
        const e = adj[u][i];
        if (prev[e.to] === -1 && e.cap - e.flow > 0) {
          prev[e.to] = u;
          prevEdge[e.to] = i;
          queue.push(e.to);
        }
      }
    }

    if (prev[sink] === -1) break;

    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const e = adj[prev[v]][prevEdge[v]];
      pathFlow = Math.min(pathFlow, e.cap - e.flow);
      v = prev[v];
    }

    v = sink;
    while (v !== source) {
      const e = adj[prev[v]][prevEdge[v]];
      e.flow += pathFlow;
      adj[e.to][e.rev].flow -= pathFlow;
      v = prev[v];
    }

    totalFlow += pathFlow;
  }

  if (totalFlow < P * daysPerPerson) return null;

  const assignment = {};
  for (let pi = 0; pi < P; pi++) {
    assignment[people[pi]] = [];
    for (const e of adj[1 + pi]) {
      if (e.to >= 1 + P && e.to <= P + W && e.flow > 0) {
        assignment[people[pi]].push(weekBuckets[e.to - 1 - P].weekKey);
      }
    }
  }

  return assignment;
}

function placePeopleOnDates(peopleToBePlaced, eligibleDates, maxPerDay) {
  const result = {};
  for (const d of eligibleDates) result[d] = [];

  const preferred = [];
  const fallback = [];

  for (const d of eligibleDates) {
    const [y, m, day] = d.split("-").map(Number);
    const wd = toMondayIndex(new Date(y, m - 1, day).getDay());
    if (PREFERRED_WEEKDAYS.includes(wd)) {
      preferred.push(d);
    } else {
      fallback.push(d);
    }
  }

  const preferredCapacity = preferred.length * maxPerDay;
  const shuffledPeople = shuffle(peopleToBePlaced);
  const forPreferred = shuffledPeople.slice(0, Math.min(shuffledPeople.length, preferredCapacity));
  const forFallback = shuffledPeople.slice(Math.min(shuffledPeople.length, preferredCapacity));

  function assignToPool(people, pool) {
    const load = {};
    for (const d of pool) load[d] = result[d].length;

    for (const person of people) {
      const candidates = pool
        .filter(d => load[d] < maxPerDay)
        .map(d => ({ date: d, load: load[d], noise: Math.random() }))
        .sort((a, b) => a.load - b.load || a.noise - b.noise);

      if (candidates.length) {
        result[candidates[0].date].push(person);
        load[candidates[0].date]++;
      }
    }
  }

  assignToPool(forPreferred, preferred);
  assignToPool(forFallback, fallback);

  return result;
}

function generateSchedule(year, month) {
  const validation = scheduleCapacityCheck(year, month);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const eligibleDates = getEligibleDates(year, month);
  const externalConstraints = getExternalWeekConstraints(year, month);
  const maxWeeklyPeople = Math.min(settings.maxPeoplePerWeek, settings.people.length);

  const weekMap = {};
  for (const date of eligibleDates) {
    const wk = weekKeyFromIso(date);
    if (!weekMap[wk]) weekMap[wk] = { weekKey: wk, dates: [], externalPeople: new Set(), remainingCapacity: 0 };
    weekMap[wk].dates.push(date);
  }

  const weekBuckets = Object.values(weekMap);

  for (const bucket of weekBuckets) {
    const ext = externalConstraints[bucket.weekKey];
    bucket.externalPeople = ext || new Set();
    bucket.remainingCapacity = Math.max(0, Math.min(
      maxWeeklyPeople - bucket.externalPeople.size,
      bucket.dates.length * settings.maxPerDay
    ));
  }

  const assignment = solveWeekAssignment(settings.people, weekBuckets, settings.daysPerPerson);

  if (!assignment) {
    throw new Error("Could not generate a valid schedule. The cross-month weekly constraints and capacity limits make it impossible. Try adjusting settings.");
  }

  const schedule = {};
  for (const date of eligibleDates) schedule[date] = [];

  for (const bucket of weekBuckets) {
    const weekPeople = [];
    for (const person of settings.people) {
      if (assignment[person] && assignment[person].includes(bucket.weekKey)) {
        weekPeople.push(person);
      }
    }

    if (!weekPeople.length) continue;

    const weekResult = placePeopleOnDates(weekPeople, bucket.dates, settings.maxPerDay);
    for (const [date, names] of Object.entries(weekResult)) {
      schedule[date] = shuffle(names);
    }
  }

  return schedule;
}

function ensureCurrentSchedule() {
  const key = monthKey(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (schedules[key]) {
    const boundaryCheck = validateBoundaryWeeks(year, month, schedules[key]);
    if (!boundaryCheck.valid) {
      try {
        schedules[key] = generateSchedule(year, month);
        saveSchedulesState();
        showToast("Schedule regenerated to fix a cross-month weekly conflict.");
      } catch (error) {
        showToast(error.message, true);
      }
    }
    return schedules[key];
  }

  try {
    schedules[key] = generateSchedule(year, month);
    saveSchedulesState();
  } catch (error) {
    showToast(error.message, true);
    schedules[key] = {};
  }

  return schedules[key];
}

function personColor(name) {
  const index = settings.people.indexOf(name);
  return palette[(index >= 0 ? index : 0) % palette.length];
}

function renderLegend() {
  legend.innerHTML = "";

  settings.people.forEach(person => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${personColor(person)}"></span><span>${escapeHtml(person)}</span>`;
    legend.appendChild(item);
  });
}

function renderSummary(schedule) {
  const totalAssignments = Object.values(schedule).reduce((sum, names) => sum + names.length, 0);
  const activeDays = Object.values(schedule).filter(names => names.length).length;

  summary.innerHTML = `
    <div class="summary-pill">${settings.people.length} people</div>
    <div class="summary-pill">${settings.daysPerPerson} days each</div>
    <div class="summary-pill">≤ ${settings.maxPeoplePerWeek} people / week</div>
    <div class="summary-pill">${totalAssignments} assignments</div>
    <div class="summary-pill">${activeDays} active remote days</div>
  `;
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const schedule = ensureCurrentSchedule();

  monthLabel.textContent = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  renderLegend();
  renderSummary(schedule);
  calendarGrid.innerHTML = "";

  const first = new Date(year, month, 1);
  const leading = toMondayIndex(first.getDay()) - 1;
  const totalDays = daysInMonth(year, month);
  const totalCells = Math.ceil((leading + totalDays) / 7) * 7;
  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const extConstraints = getExternalWeekConstraints(year, month);

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
    const allowed = settings.allowedWeekdays.includes(weekday);
    const names = schedule[dateIso] || [];

    const wk = weekKeyFromIso(dateIso);
    const ext = extConstraints[wk];
    const isConstrained = allowed && ext && ext.size > 0;

    dayEl.className = `day${allowed ? "" : " disabled"}${dateIso === todayIso ? " today" : ""}${isConstrained ? " constrained" : ""}`;

    const stateText = allowed
      ? (names.length
        ? `${names.length} remote`
        : (isConstrained ? "Shared week" : "Available"))
      : "Office";

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
    showToast("Fresh random schedule generated.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function openSettings() {
  daysPerPersonInput.value = settings.daysPerPerson;
  maxPerDayInput.value = settings.maxPerDay;
  maxPeoplePerWeekInput.value = settings.maxPeoplePerWeek;
  renderWeekdaySettings();
  renderPeopleEditor();
  settingsModal.classList.add("open");
}

function closeSettings() {
  settingsModal.classList.remove("open");
}

function renderWeekdaySettings() {
  const options = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" }
  ];

  weekdayOptions.innerHTML = options.map(option => `
    <div class="check-card">
      <input
        type="checkbox"
        id="weekday-${option.value}"
        value="${option.value}"
        ${settings.allowedWeekdays.includes(option.value) ? "checked" : ""}
      >
      <label for="weekday-${option.value}">${option.label}</label>
    </div>
  `).join("");
}

function renderPeopleEditor() {
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
  return [...peopleEditor.querySelectorAll(".person-name")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function saveSettingsFromModal() {
  const people = getPeopleFromEditor();
  const daysPerPerson = Math.max(1, Number(daysPerPersonInput.value) || 1);
  const maxPerDay = Math.max(1, Number(maxPerDayInput.value) || 1);
  const maxPeoplePerWeek = Math.max(1, Number(maxPeoplePerWeekInput.value) || 1);
  const allowedWeekdays = [...weekdayOptions.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => Number(input.value));

  if (!people.length) {
    showToast("Add at least one person.", true);
    return;
  }

  if (!allowedWeekdays.length) {
    showToast("Select at least one allowed weekday.", true);
    return;
  }

  const duplicate = people.find((name, index) => people.findIndex(other => other.toLowerCase() === name.toLowerCase()) !== index);
  if (duplicate) {
    showToast(`Duplicate person: ${duplicate}`, true);
    return;
  }

  const previous = settings;
  const previousSchedules = schedules;
  settings = {
    people,
    daysPerPerson,
    maxPerDay,
    maxPeoplePerWeek,
    allowedWeekdays
  };
  schedules = {};

  const validation = scheduleCapacityCheck(currentDate.getFullYear(), currentDate.getMonth());
  if (!validation.ok) {
    settings = previous;
    schedules = previousSchedules;
    showToast(validation.reason, true);
    return;
  }

  saveSettingsState();
  saveSchedulesState();
  closeSettings();
  renderCalendar();
  showToast("Settings saved and schedule regenerated.");
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

  if (!Array.isArray(importedSettings.allowedWeekdays) || !importedSettings.allowedWeekdays.length) {
    throw new Error("The backup contains invalid weekday settings.");
  }

  const allowedWeekdays = importedSettings.allowedWeekdays.map(Number);

  if (allowedWeekdays.some(day => !Number.isInteger(day) || day < 1 || day > 5)) {
    throw new Error("The backup contains unsupported weekdays.");
  }

  const daysPerPerson = Number(importedSettings.daysPerPerson);
  const maxPerDay = Number(importedSettings.maxPerDay);
  const maxPeoplePerWeek = Number(importedSettings.maxPeoplePerWeek);

  if (!Number.isInteger(daysPerPerson) || daysPerPerson < 1) {
    throw new Error("The backup contains an invalid monthly remote-day count.");
  }

  if (!Number.isInteger(maxPerDay) || maxPerDay < 1) {
    throw new Error("The backup contains an invalid daily limit.");
  }

  if (!Number.isInteger(maxPeoplePerWeek) || maxPeoplePerWeek < 1) {
    throw new Error("The backup contains an invalid weekly limit.");
  }

  const personSet = new Set(people);

  for (const [month, schedule] of Object.entries(data.schedules)) {
    if (!/^\d{4}-\d{2}$/.test(month) || !schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
      throw new Error(`The backup contains an invalid schedule entry: ${month}.`);
    }

    for (const [date, names] of Object.entries(schedule)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(names)) {
        throw new Error(`The backup contains invalid data for ${date}.`);
      }

      if (names.some(name => !personSet.has(name))) {
        throw new Error(`The backup references an unknown person on ${date}.`);
      }
    }
  }

  const globalWeekPeople = {};

  for (const [, schedule] of Object.entries(data.schedules)) {
    for (const [date, names] of Object.entries(schedule)) {
      if (!Array.isArray(names)) continue;
      const wk = weekKeyFromIso(date);
      if (!globalWeekPeople[wk]) globalWeekPeople[wk] = {};

      for (const name of names) {
        if (!globalWeekPeople[wk][name]) globalWeekPeople[wk][name] = [];
        globalWeekPeople[wk][name].push(date);
      }
    }
  }

  for (const [wk, peopleMap] of Object.entries(globalWeekPeople)) {
    for (const [person, dates] of Object.entries(peopleMap)) {
      if (dates.length > 1) {
        throw new Error(`Import rejected: ${person} is assigned on ${dates.join(" and ")}, which are in the same calendar week (${wk}).`);
      }
    }

    const distinctPeople = Object.keys(peopleMap).length;
    if (distinctPeople > maxPeoplePerWeek) {
      throw new Error(`Import rejected: the week of ${wk} has ${distinctPeople} distinct remote workers, exceeding the maximum of ${maxPeoplePerWeek}.`);
    }
  }

  return {
    settings: {
      people,
      daysPerPerson,
      maxPerDay,
      maxPeoplePerWeek,
      allowedWeekdays: [...new Set(allowedWeekdays)]
    },
    schedules: data.schedules
  };
}

async function importCalendarData(file) {
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = validateImportedData(parsed);

    const confirmed = window.confirm(
      "Import this calendar backup? This will replace the schedules and settings currently saved in this browser."
    );

    if (!confirmed) {
      return;
    }

    settings = imported.settings;
    schedules = imported.schedules;

    saveSettingsState();
    saveSchedulesState();
    renderCalendar();
    showToast("Calendar data imported.");
  } catch (error) {
    showToast(`Import failed: ${error.message}`, true);
  } finally {
    importFileInput.value = "";
  }
}

function showToast(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

renderCalendar();
