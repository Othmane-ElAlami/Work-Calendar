const STORAGE_OVERRIDES = "remoteCalendarHolidayOverridesV2";
const STORAGE_HOLIDAYS_PREFIX = "remoteCalendarHolidays_";
const BACKUP_VERSION = 2;

const ROTATION_ORDER = [
  "Hamza",
  "Zakaria",
  "Othmane",
  "Zouhair",
  "Alae",
  "Yassine",
  "Omar"
];

const ANCHOR_DATE = "2026-09-21";

const palette = [
  "#a970ff",
  "#ff6fcf",
  "#6bb8ff",
  "#62d9a3",
  "#ffb45f",
  "#ff6b7f",
  "#b9d866"
];

let holidayOverrides = loadHolidayOverrides();
let holidaysCache = {};
let currentDate = new Date();
currentDate.setDate(1);

function isoDate(year, month, day) {
  if (year instanceof Date) {
    const y = year.getFullYear();
    const m = String(year.getMonth() + 1).padStart(2, "0");
    const d = String(year.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
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

function monthKey(date) {
  const y = typeof date === "string" ? date.slice(0, 4) : date.getFullYear();
  const m = typeof date === "string" ? date.slice(5, 7) : String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getStaticHolidays(year) {
  return [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-01-11`, name: "Proclamation of Independence" },
    { date: `${year}-05-01`, name: "Labour Day" },
    { date: `${year}-07-30`, name: "Feast of the Throne" },
    { date: `${year}-08-14`, name: "Oued Ed-Dahab Day" },
    { date: `${year}-08-20`, name: "Revolution of the King and the People" },
    { date: `${year}-08-21`, name: "Youth Day" },
    { date: `${year}-11-06`, name: "Green March" },
    { date: `${year}-11-18`, name: "Independence Day" }
  ];
}

function getEffectiveHolidays(apiHolidays = [], overrides = []) {
  const effective = {};
  for (const h of apiHolidays) {
    if (h && h.date) {
      effective[h.date] = h.name || h.localName || "Public Holiday";
    }
  }
  for (const ov of overrides) {
    if (ov && ov.date) {
      if (ov.isHoliday === false) {
        delete effective[ov.date];
      } else {
        effective[ov.date] = ov.name || "Holiday";
      }
    }
  }
  return effective;
}

function loadHolidayOverrides() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_OVERRIDES);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHolidayOverridesState() {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(holidayOverrides));
}

function getLocalHolidaysForYear(year) {
  if (holidaysCache[year]) {
    return holidaysCache[year];
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`${STORAGE_HOLIDAYS_PREFIX}${year}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.holidays) && parsed.holidays.length) {
          holidaysCache[year] = parsed.holidays;
          return holidaysCache[year];
        }
      }
    } catch {}
  }
  return null;
}

async function fetchHolidaysForYear(year) {
  const cacheKey = `${STORAGE_HOLIDAYS_PREFIX}${year}`;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/MA`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      holidaysCache[year] = data;
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), holidays: data }));
      }
      return { holidays: data, fromCache: false, fallbackUsed: false };
    }
  } catch {
    const cached = getLocalHolidaysForYear(year);
    if (cached) {
      return { holidays: cached, fromCache: true, fallbackUsed: false };
    }
    const fallback = getStaticHolidays(year);
    holidaysCache[year] = fallback;
    return { holidays: fallback, fromCache: false, fallbackUsed: true };
  }
  const fallback = getStaticHolidays(year);
  holidaysCache[year] = fallback;
  return { holidays: fallback, fromCache: false, fallbackUsed: true };
}

function getAllEffectiveHolidays(targetYear) {
  const startYear = 2026;
  const endYear = Math.max(2026, targetYear);
  const allHolidays = [];
  let anyFallbackUsed = false;

  for (let y = startYear; y <= endYear; y++) {
    const list = getLocalHolidaysForYear(y);
    if (list) {
      allHolidays.push(...list);
    } else {
      const fallback = getStaticHolidays(y);
      holidaysCache[y] = fallback;
      allHolidays.push(...fallback);
      anyFallbackUsed = true;
    }
  }

  const effective = getEffectiveHolidays(allHolidays, holidayOverrides);
  return { effective, anyFallbackUsed };
}

async function syncHolidays(targetYear) {
  const startYear = 2026;
  const endYear = Math.max(2026, targetYear);
  let warningActive = false;

  for (let y = startYear; y <= endYear; y++) {
    const res = await fetchHolidaysForYear(y);
    if (res.fallbackUsed) {
      warningActive = true;
    }
  }

  updateWarningBanner(warningActive);
  renderCalendar();
}

function updateWarningBanner(show) {
  const banner = document.getElementById("warningBanner");
  if (!banner) return;
  if (show) {
    banner.textContent = "Warning: Public holiday service (https://date.nager.at) unreachable. Using cached or fallback Moroccan public holidays.";
    banner.style.display = "flex";
  } else {
    banner.style.display = "none";
  }
}

function renderSummary(assignmentsInMonth, holidaysInMonth) {
  const summary = document.getElementById("summary");
  if (!summary) return;
  const remoteCount = Object.keys(assignmentsInMonth).length;
  const holidayCount = Object.keys(holidaysInMonth).length;

  let html = `
    <div class="summary-pill">${ROTATION_ORDER.length} people</div>
    <div class="summary-pill">Rotation anchor: Sep 21, 2026</div>
    <div class="summary-pill">${remoteCount} remote days this month</div>
  `;
  if (holidayCount > 0) {
    html += `<div class="summary-pill">${holidayCount} public holiday${holidayCount > 1 ? "s" : ""}</div>`;
  }
  summary.innerHTML = html;
}

function computeSchedule(endDateIso, rotationOrder = ROTATION_ORDER, anchorDate = ANCHOR_DATE, effectiveHolidaysMap = {}) {
  const [ay, am, ad] = anchorDate.split("-").map(Number);
  const [ey, em, ed] = endDateIso.split("-").map(Number);

  let cur = new Date(ay, am - 1, ad);
  const end = new Date(ey, em - 1, ed);

  let rotationIndex = 0;
  const assignments = {};
  const holidays = {};

  for (const [dateStr, name] of Object.entries(effectiveHolidaysMap)) {
    holidays[dateStr] = name;
  }

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    const dateStr = isoDate(y, m, d);
    const wd = toMondayIndex(cur.getDay());

    if (effectiveHolidaysMap[dateStr]) {
      holidays[dateStr] = effectiveHolidaysMap[dateStr];
    }

    if (wd >= 2 && wd <= 4) {
      if (!effectiveHolidaysMap[dateStr]) {
        assignments[dateStr] = rotationOrder[rotationIndex % rotationOrder.length];
        rotationIndex++;
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  return { assignments, holidays, totalAssigned: rotationIndex };
}

function personColor(name) {
  const index = ROTATION_ORDER.indexOf(name);
  return palette[(index >= 0 ? index : 0) % palette.length];
}

function renderLegend(assignmentsInMonth) {
  const legend = document.getElementById("legend");
  if (!legend) return;
  legend.innerHTML = "";

  const personCounts = {};
  for (const p of ROTATION_ORDER) personCounts[p] = 0;
  for (const name of Object.values(assignmentsInMonth)) {
    if (personCounts[name] !== undefined) personCounts[name]++;
  }

  ROTATION_ORDER.forEach(person => {
    const count = personCounts[person] || 0;
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${personColor(person)}"></span><span>${escapeHtml(person)} (${count})</span>`;
    legend.appendChild(item);
  });
}

function renderCalendar() {
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  if (!calendarGrid || !monthLabel) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const endIso = isoDate(year, month, totalDays);

  const { effective } = getAllEffectiveHolidays(year);
  const scheduleData = computeSchedule(endIso, ROTATION_ORDER, ANCHOR_DATE, effective);

  monthLabel.textContent = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const assignmentsInMonth = {};
  const holidaysInMonth = {};

  for (const [date, name] of Object.entries(scheduleData.assignments)) {
    if (date.startsWith(monthPrefix)) {
      assignmentsInMonth[date] = name;
    }
  }
  for (const [date, name] of Object.entries(scheduleData.holidays)) {
    if (date.startsWith(monthPrefix)) {
      holidaysInMonth[date] = name;
    }
  }

  renderLegend(assignmentsInMonth);
  renderSummary(assignmentsInMonth, holidaysInMonth);
  calendarGrid.innerHTML = "";

  const first = new Date(year, month, 1);
  const leading = toMondayIndex(first.getDay()) - 1;
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
    const isAllowedWeekday = weekday >= 2 && weekday <= 4;
    const isWeekend = weekday === 6 || weekday === 7;
    const isBeforeAnchor = dateIso < ANCHOR_DATE;
    const holidayName = scheduleData.holidays[dateIso] || effective[dateIso];
    const assignedPerson = scheduleData.assignments[dateIso];

    let dayClass = "day";
    if (dateIso === todayIso) dayClass += " today";
    if (!isAllowedWeekday) dayClass += " disabled";
    if (isWeekend) dayClass += " weekend";
    if (holidayName) dayClass += " holiday";

    dayEl.className = dayClass;

    if (holidayName) {
      dayEl.innerHTML = `
        <div class="day-number">
          <span class="num">${dayNumber}</span>
          <span class="day-state holiday">Holiday</span>
        </div>
        <div class="remote-list">
          <div class="holiday-chip" title="${escapeHtml(holidayName)}">
            <span>${escapeHtml(holidayName)}</span>
          </div>
        </div>
      `;
    } else if (!isAllowedWeekday) {
      const stateText = isWeekend ? "Weekend" : "Office";
      dayEl.innerHTML = `
        <div class="day-number">
          <span class="num">${dayNumber}</span>
          <span class="day-state">${stateText}</span>
        </div>
      `;
    } else if (isBeforeAnchor) {
      dayEl.innerHTML = `
        <div class="day-number">
          <span class="num">${dayNumber}</span>
          <span class="day-state">Pre-rotation</span>
        </div>
      `;
    } else if (assignedPerson) {
      dayEl.innerHTML = `
        <div class="day-number">
          <span class="num">${dayNumber}</span>
          <span class="day-state">1 remote</span>
        </div>
        <div class="remote-list">
          <div class="remote-chip" title="${escapeHtml(assignedPerson)}">
            <span class="dot" style="background:${personColor(assignedPerson)}"></span>
            <span>${escapeHtml(assignedPerson)}</span>
          </div>
        </div>
      `;
    } else {
      dayEl.innerHTML = `
        <div class="day-number">
          <span class="num">${dayNumber}</span>
          <span class="day-state">Available</span>
        </div>
      `;
    }

    calendarGrid.appendChild(dayEl);
  }
}

function openSettings() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  renderRotationInfo();
  renderOverridesList();
  modal.classList.add("open");
}

function closeSettings() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.classList.remove("open");
}

function renderRotationInfo() {
  const meta = document.getElementById("rotationMeta");
  const list = document.getElementById("rotationList");
  if (meta) {
    meta.textContent = `Anchor start date: ${ANCHOR_DATE} (first scheduled date: Tuesday, 2026-09-22)`;
  }
  if (list) {
    list.innerHTML = "";
    ROTATION_ORDER.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      list.appendChild(li);
    });
  }
}

function renderOverridesList() {
  const container = document.getElementById("overrideList");
  if (!container) return;
  container.innerHTML = "";

  if (!holidayOverrides.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:0.84rem;padding:8px;">No custom overrides defined.</div>`;
    return;
  }

  holidayOverrides.forEach((ov, index) => {
    const item = document.createElement("div");
    item.className = "override-item";
    const statusText = ov.isHoliday ? "Holiday" : "Workday";
    item.innerHTML = `
      <span><strong>${escapeHtml(ov.date)}</strong> — ${escapeHtml(ov.name || statusText)} (${statusText})</span>
      <button class="btn danger" data-index="${index}">Remove</button>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll("button[data-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      holidayOverrides.splice(idx, 1);
      saveHolidayOverridesState();
      renderOverridesList();
      renderCalendar();
      showToast("Holiday override removed.");
    });
  });
}

function addOverride() {
  const dateInput = document.getElementById("overrideDateInput");
  const nameInput = document.getElementById("overrideNameInput");
  const typeSelect = document.getElementById("overrideTypeSelect");
  if (!dateInput || !typeSelect) return;

  const dateVal = dateInput.value.trim();
  if (!dateVal) {
    showToast("Please select a date.", true);
    return;
  }

  const isHoliday = typeSelect.value === "holiday";
  const nameVal = nameInput ? nameInput.value.trim() : "";
  const name = nameVal || (isHoliday ? "Manual Holiday" : "Workday Override");

  const existingIdx = holidayOverrides.findIndex(o => o.date === dateVal);
  if (existingIdx >= 0) {
    holidayOverrides[existingIdx] = { date: dateVal, name, isHoliday };
  } else {
    holidayOverrides.push({ date: dateVal, name, isHoliday });
  }

  holidayOverrides.sort((a, b) => a.date.localeCompare(b.date));
  saveHolidayOverridesState();
  if (nameInput) nameInput.value = "";
  renderOverridesList();
  renderCalendar();
  showToast("Holiday override saved.");
}

function exportCalendarData() {
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    rotationOrder: ROTATION_ORDER,
    anchorDate: ANCHOR_DATE,
    overrides: holidayOverrides,
    cachedHolidays: holidaysCache
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `work-calendar-rotation-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Calendar backup exported.");
}

function validateImportedData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid backup file.");
  }
  if (!Array.isArray(data.overrides)) {
    throw new Error("Backup is missing valid overrides list.");
  }
  for (const ov of data.overrides) {
    if (!ov || typeof ov.date !== "string" || !ov.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error("Backup contains invalid override dates.");
    }
  }
  return {
    overrides: data.overrides,
    cachedHolidays: data.cachedHolidays && typeof data.cachedHolidays === "object" ? data.cachedHolidays : {}
  };
}

async function importCalendarData(file) {
  const importFileInput = document.getElementById("importFileInput");
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = validateImportedData(parsed);

    const confirmed = window.confirm(
      "Import this calendar backup? This will replace your holiday overrides and cached holiday data."
    );
    if (!confirmed) return;

    holidayOverrides = imported.overrides;
    saveHolidayOverridesState();

    if (imported.cachedHolidays) {
      for (const [year, list] of Object.entries(imported.cachedHolidays)) {
        if (Array.isArray(list)) {
          holidaysCache[year] = list;
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(`${STORAGE_HOLIDAYS_PREFIX}${year}`, JSON.stringify({ timestamp: Date.now(), holidays: list }));
          }
        }
      }
    }

    renderCalendar();
    renderOverridesList();
    showToast("Calendar backup imported successfully.");
  } catch (error) {
    showToast(`Import failed: ${error.message}`, true);
  } finally {
    if (importFileInput) importFileInput.value = "";
  }
}

function showToast(message, error = false) {
  const toast = document.getElementById("toast");
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

function cleanupLegacyStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem("remoteCalendarSchedulesV1");
  } catch {}
}

async function initApp() {
  cleanupLegacyStorage();
  const year = currentDate.getFullYear();
  getAllEffectiveHolidays(year);
  renderCalendar();
  await syncHolidays(year);
}

if (typeof document !== "undefined") {
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    syncHolidays(currentDate.getFullYear());
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    syncHolidays(currentDate.getFullYear());
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    const now = new Date();
    currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    renderCalendar();
    syncHolidays(currentDate.getFullYear());
  });

  document.getElementById("exportBtn").addEventListener("click", exportCalendarData);
  document.getElementById("importBtn").addEventListener("click", () => {
    const input = document.getElementById("importFileInput");
    if (input) input.click();
  });

  const importFileInput = document.getElementById("importFileInput");
  if (importFileInput) {
    importFileInput.addEventListener("change", event => importCalendarData(event.target.files[0]));
  }

  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("cancelSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("addOverrideBtn").addEventListener("click", addOverride);

  document.getElementById("refreshHolidaysBtn").addEventListener("click", async () => {
    const year = currentDate.getFullYear();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`${STORAGE_HOLIDAYS_PREFIX}${year}`);
    }
    delete holidaysCache[year];
    await syncHolidays(year);
    showToast("Holiday data refreshed.");
  });

  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) {
    settingsModal.addEventListener("click", event => {
      if (event.target === settingsModal) closeSettings();
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSettings();
  });

  initApp();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
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
  };
}
