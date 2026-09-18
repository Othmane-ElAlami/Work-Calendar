const STORAGE_SETTINGS = "remoteCalendarSettingsV1";
const STORAGE_SCHEDULES = "remoteCalendarSchedulesV1";

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

function scheduleCapacityCheck(year, month) {
  if (!settings.people.length) {
    return { ok: false, reason: "Add at least one person." };
  }

  if (!settings.allowedWeekdays.length) {
    return { ok: false, reason: "Select at least one allowed weekday." };
  }

  const eligibleDates = getEligibleDates(year, month);
  const assignmentsNeeded = settings.people.length * settings.daysPerPerson;
  const totalCapacity = eligibleDates.length * settings.maxPerDay;

  if (eligibleDates.length < settings.daysPerPerson) {
    return {
      ok: false,
      reason: `Impossible configuration: Each person needs ${settings.daysPerPerson} remote days, but this month only has ${eligibleDates.length} eligible dates.`
    };
  }

  const weeksMap = {};
  for (const date of eligibleDates) {
    const wKey = weekKeyFromIso(date);
    if (!weeksMap[wKey]) {
      weeksMap[wKey] = [];
    }
    weeksMap[wKey].push(date);
  }
  const numWeeks = Object.keys(weeksMap).length;

  if (numWeeks < settings.daysPerPerson) {
    return {
      ok: false,
      reason: `Impossible configuration: Each person needs ${settings.daysPerPerson} remote days, but there are only ${numWeeks} weeks with eligible dates (maximum 1 day per person per week).`
    };
  }

  const maxWeeklyPeople = Math.min(settings.maxPeoplePerWeek, settings.people.length);
  const maxAssignmentsFromWeeklyLimit = numWeeks * maxWeeklyPeople;
  if (maxAssignmentsFromWeeklyLimit < assignmentsNeeded) {
    const minWeeklyNeeded = Math.ceil(assignmentsNeeded / numWeeks);
    return {
      ok: false,
      reason: `Impossible configuration: ${assignmentsNeeded} assignments are required, but the weekly limits only allow ${maxAssignmentsFromWeeklyLimit}. Increase Maximum distinct people per week to at least ${minWeeklyNeeded}.`
    };
  }

  if (totalCapacity < assignmentsNeeded) {
    const minDailyNeeded = Math.ceil(assignmentsNeeded / eligibleDates.length);
    return {
      ok: false,
      reason: `Impossible configuration: ${assignmentsNeeded} assignments are required, but daily capacity only allows ${totalCapacity}. Increase Maximum people per remote day to at least ${minDailyNeeded}.`
    };
  }

  let totalCombinedCapacity = 0;
  for (const wKey in weeksMap) {
    const weekDailyCapacity = weeksMap[wKey].length * settings.maxPerDay;
    totalCombinedCapacity += Math.min(weekDailyCapacity, maxWeeklyPeople);
  }
  if (totalCombinedCapacity < assignmentsNeeded) {
    return {
      ok: false,
      reason: `Impossible configuration: ${assignmentsNeeded} assignments are required, but the combined weekly and daily limits only allow ${totalCombinedCapacity}. Increase Maximum distinct people per week or Maximum people per remote day.`
    };
  }

  return { ok: true };
}

function generateSchedule(year, month) {
  const validation = scheduleCapacityCheck(year, month);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const eligibleDates = getEligibleDates(year, month);
  const maxWeeklyPeople = Math.min(settings.maxPeoplePerWeek, settings.people.length);

  for (let attempt = 0; attempt < 2000; attempt++) {
    const schedule = {};
    const dateLoad = {};
    const personDates = {};
    const weeklyPeople = {};

    for (const date of eligibleDates) {
      schedule[date] = [];
      dateLoad[date] = 0;
      const weekKey = weekKeyFromIso(date);
      if (!weeklyPeople[weekKey]) {
        weeklyPeople[weekKey] = new Set();
      }
    }

    for (const person of settings.people) {
      personDates[person] = new Set();
    }

    let failed = false;

    for (const person of shuffle(settings.people)) {
      for (let slot = 0; slot < settings.daysPerPerson; slot++) {
        const candidates = eligibleDates
          .filter(date => {
            if (dateLoad[date] >= settings.maxPerDay) {
              return false;
            }

            if (personDates[person].has(date)) {
              return false;
            }

            const weekKey = weekKeyFromIso(date);
            const peopleThisWeek = weeklyPeople[weekKey];
            const personAlreadyInWeek = peopleThisWeek.has(person);

            if (personAlreadyInWeek) {
              return false;
            }

            if (peopleThisWeek.size >= maxWeeklyPeople) {
              return false;
            }

            return true;
          })
          .map(date => ({
            date,
            load: dateLoad[date],
            noise: Math.random()
          }))
          .sort((a, b) =>
            a.load - b.load ||
            a.noise - b.noise
          );

        if (!candidates.length) {
          failed = true;
          break;
        }

        const minLoad = candidates[0].load;
        const balancedPool = candidates.filter(item => item.load <= minLoad + 1);
        const chosen = balancedPool[Math.floor(Math.random() * balancedPool.length)].date;
        const chosenWeek = weekKeyFromIso(chosen);

        schedule[chosen].push(person);
        dateLoad[chosen]++;
        personDates[person].add(chosen);
        weeklyPeople[chosenWeek].add(person);
      }

      if (failed) {
        break;
      }
    }

    if (!failed) {
      for (const date of Object.keys(schedule)) {
        schedule[date] = shuffle(schedule[date]);
      }
      return schedule;
    }
  }

  throw new Error("Could not generate a valid schedule with the current rules. Increase the per-day or per-week limits, or allow more weekdays.");
}

function ensureCurrentSchedule() {
  const key = monthKey(currentDate);

  if (!schedules[key]) {
    try {
      schedules[key] = generateSchedule(currentDate.getFullYear(), currentDate.getMonth());
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
  settings = {
    people,
    daysPerPerson,
    maxPerDay,
    maxPeoplePerWeek,
    allowedWeekdays
  };

  const validation = scheduleCapacityCheck(currentDate.getFullYear(), currentDate.getMonth());
  if (!validation.ok) {
    settings = previous;
    showToast(validation.reason, true);
    return;
  }

  schedules = {};
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
