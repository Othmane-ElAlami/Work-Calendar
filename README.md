# Work Calendar

A lightweight browser-based work calendar for generating and managing randomized remote-work schedules. The project is intentionally general enough to support additional workplace scheduling features in the future.

## Features

- Monthly calendar interface
- Configurable employee list
- Configurable remote days per person per month
- Randomized monthly scheduling
- Maximum one remote day per person per calendar week
- Configurable maximum people per remote day
- Configurable maximum distinct remote workers per week
- Configurable allowed weekdays
- Tuesday, Wednesday, and Thursday are prioritized
- Monday and Friday act as fallback days when enabled and preferred slots are unavailable
- Existing monthly schedules persist using localStorage
- Settings persist using localStorage
- Individual months can be randomized again
- Calendar data can be exported to JSON
- Calendar data can be imported from JSON
- Responsive dark-mode interface
- No backend or database required

## Default Team

- Alae
- Othmane
- Omar
- Zakaria
- Zouhair
- Hamza
- Yassine

The list can be changed from Settings.

## Default Scheduling Rules

Each person is assigned **3 remote days per month**, with a maximum of **1 remote day per person per calendar week**. Not every person is necessarily scheduled every week.

**Tuesday**, **Wednesday**, and **Thursday** are the preferred days. **Monday** and **Friday** are excluded by default. If Monday or Friday are manually enabled in Settings, they are used only as fallback days when the preferred slots are unavailable.

Other limits — such as the maximum number of people per remote day and the maximum number of distinct remote workers per week — are configurable through Settings.

## Persistence

Schedules and settings are stored using browser **localStorage**.

- Refreshing or reopening the site in the same browser preserves schedules.
- Different browsers or devices have independent localStorage and will not share data.
- Use **Export** / **Import** to move or back up calendar data across browsers or devices.
- GitHub Pages itself does not provide shared server-side persistence.

## Usage

1. Open the [GitHub Pages website](https://othmane-elalami.github.io/Work-Calendar/).
2. Adjust **Settings** if necessary (team members, remote days, allowed weekdays).
3. Generate or randomize the current month.
4. Navigate between months using the arrow buttons.
5. Export a backup if desired.
6. Import a previous backup when needed.

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
└── README.md
```

## Hosting

The project is hosted using **GitHub Pages** from the `master` branch, root directory (`/`).

**Live site:** https://othmane-elalami.github.io/Work-Calendar/

## Tech

- HTML5
- CSS3
- Vanilla JavaScript
- localStorage
- GitHub Pages
