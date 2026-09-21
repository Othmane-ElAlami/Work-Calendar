# Work Calendar

A lightweight, deterministic browser-based work calendar for managing remote-work schedules following a continuous static rotation.

## Continuous Rotation Model

The scheduling system is based on a single continuous permutation of the seven team members across time:

1. **Hamza**
2. **Zakaria**
3. **Othmane**
4. **Zouhair**
5. **Alae**
6. **Yassine**
7. **Omar**

### Core Rules & Invariants

1. **Anchor Date**: The rotation sequence begins at anchor date **September 21, 2026**.
2. **First Scheduled Date**: The first scheduled remote-work slot is **Tuesday, September 22, 2026** (assigned to Hamza).
3. **Allowed Weekdays**: Remote work is permitted strictly on **Tuesday**, **Wednesday**, and **Thursday**. Monday and Friday are strictly office days.
4. **Capacity**: At most **1 person** is scheduled per day (never multiple people on the same date).
5. **Continuous Unbroken Timeline**: The rotation order never resets across weeks, months, or years. It flows continuously across month and year boundaries.
6. **No Consecutive Remote Weeks**: Because there are 7 people and at most 3 remote slots per week, no employee ever appears in consecutive calendar weeks.
7. **Moroccan Public Holidays**:
   - Moroccan public holidays are dynamically retrieved from the public holiday API (`https://date.nager.at/api/v3/PublicHolidays/{year}/MA`) and cached locally in `localStorage` per year.
   - Holidays falling on Tuesday, Wednesday, or Thursday are skipped for remote work.
   - An employee whose turn coincides with a holiday is shifted to the very next available remote day without losing their turn.
   - An offline fallback is maintained for static Moroccan national holidays. A warning banner alerts users if the remote holiday service is unreachable.
8. **Manual Holiday Overrides**:
   - Custom overrides can be added or removed through the Settings modal.
   - Users can designate custom holidays (skipping remote work) or custom workday overrides.
   - Overrides persist in `localStorage` (`remoteCalendarHolidayOverridesV2`).

## Persistence & Data Management

- **Storage**: Holiday overrides and fetched holiday cache persist across browser sessions in `localStorage`.
- **Export**: Generates a timestamped JSON backup containing the static rotation configuration, anchor date, manual overrides, and cached holiday data.
- **Import**: Restores manual overrides and cached holiday data with validation and confirmation before applying.

## Verification & Automated Tests

A dedicated test suite verifies all 10 core scheduler requirements:

```bash
node tests/scheduler.test.js
```

### Test Coverage

1. **Rotation Order Preservation**: Cycles through all 7 members in order across repeated rounds.
2. **Month Boundary Continuity**: Seamless transition from September to October without resetting.
3. **Year Boundary Continuity**: Seamless transition from December 2026 to January 2027.
4. **Holiday Skipping & Turn Retention**: Ensures holidays cancel remote day assignments while retaining turn order for subsequent days.
5. **Capacity Constraint**: Validates at most 1 person per day.
6. **Allowed Days Constraint**: Restricts all remote assignments exclusively to Tuesday, Wednesday, and Thursday.
7. **Consecutive Weeks Constraint**: Guarantees no employee works remotely in adjacent calendar weeks.
8. **Deterministic Generation**: Verifies identical inputs always produce identical schedules.
9. **API Outage Fallback**: Validates cache lookup, static holiday fallback, and outage warning flag handling.
10. **Holiday Manual Overrides**: Validates custom holiday addition, turning off public holidays as workdays, and queue shift retention.

## Project Structure

```
Work-Calendar/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
│   └── favicon.svg
├── tests/
│   └── scheduler.test.js
└── README.md
```

## Hosting & Deployment

Hosted on **GitHub Pages** from the root directory of the `master` branch.

**Live site:** https://othmane-elalami.github.io/Work-Calendar/
