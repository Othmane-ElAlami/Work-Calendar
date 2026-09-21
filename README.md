# Work Calendar

A lightweight browser-based work calendar for generating and managing remote-work schedules following a balanced, constraint-aware rotation policy.

## Scheduling Rules

The calendar enforces the following hard constraints:

1. **Allowed Weekdays**: Remote work is permitted exclusively on **Tuesday**, **Wednesday**, and **Thursday**. Monday and Friday are strictly office days.
2. **One Remote Worker per Day**: Each eligible day contains at most **1 remote worker** (never multiple people on the same date).
3. **Weekly Limit**: Each person may receive at most **1 remote day per calendar week** (Monday through Sunday).
4. **No Consecutive Remote Weeks**: A person assigned in calendar week $W$ cannot be assigned in week $W - 1$ or week $W + 1$. There must always be at least one full calendar week without remote work between assignments.
5. **Cross-Month Week Handling**: Calendar weeks spanning month boundaries (and year boundaries) are treated globally. Assignments in adjacent months are preserved as fixed constraints when generating or regenerating any month.

## Monthly Target & Long-Term Fairness

- **Monthly Target**: Up to **2 remote days per person per month** (configurable in Settings).
- **Scarcity Distribution**: In months where total calendar capacity (number of Tue/Wed/Thu dates) cannot provide everyone with 2 days without violating hard constraints, the scheduler generates the maximum feasible valid assignments rather than failing.
- **Long-Term Fairness**: The scheduler calculates cumulative fairness debt from persisted history (`fairnessDebt = targetCumulative - actualCumulative`). Employees who received fewer days in previous months automatically receive higher priority in subsequent months.

## Default Team

- Alae
- Othmane
- Omar
- Zakaria
- Zouhair
- Hamza
- Yassine

The employee list and monthly target can be adjusted in Settings.

## Persistence & Data Management

- Schedules and settings persist across browser sessions using **localStorage**.
- **Export**: Creates a timestamped JSON backup containing settings and all saved monthly schedules.
- **Import**: Restores a calendar backup after validating all global and cross-month hard constraints.
- When existing saved schedules violate updated policies, a controlled migration recalculates affected months.

## Usage

1. Open the [Work Calendar website](https://othmane-elalami.github.io/Work-Calendar/).
2. Adjust team members or monthly targets in **Settings** if needed.
3. Click **Randomize month** to generate or reshuffle the current month.
4. Navigate between months using the arrow buttons.
5. Use **Export** to create a backup or **Import** to load a backup JSON file.

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

## Hosting

Hosted on **GitHub Pages** from the `master` branch root directory (`/`).

**Live site:** https://othmane-elalami.github.io/Work-Calendar/
