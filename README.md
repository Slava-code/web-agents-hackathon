# Medical Device Vendor Dashboards

A collection of 5 simulated medical device vendor web dashboards for OR (Operating Room) turnover scenarios. Each dashboard is designed to look like it comes from a different medical device company, with distinct visual styles and functionality.

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** (or next available port like 3001, 3002, 3003 if occupied)

## Dashboards

| Dashboard | Route | Style | Description |
|-----------|-------|-------|-------------|
| UV Disinfection Robot | `/uv-robot` | Swiss Minimalism | Cycle controls, battery, room selection |
| Environmental Monitoring | `/environmental` | Palo Alto IoT | Sensor tracking, alerts, thresholds |
| TUG Fleet Monitor | `/tug-robot` | Medical-grade | Multi-bot tracking, OR → Sterilization |
| EHR / Room Scheduling | `/ehr` | Epic/Cerner | Patient scheduling, room assignments |
| Variable Tracker | `/camera` | 2010s Epic UI | UV & TUG metrics monitoring |

---

### 1. UV Disinfection Robot Portal (`/uv-robot`)
**Style:** Swiss Precision Minimalism - clean white primary colors, Instrument Serif + DM Mono fonts, clinical teal accent

**Features:**
- Room selection (8 operating rooms)
- Cycle mode selection (Standard, High, Terminal)
- UV intensity control slider
- Battery level indicator with color coding
- Connection status management
- Start/Abort cycle controls
- Emergency stop button
- Cycle history log with export/print/clear options

---

### 2. Environmental Monitoring System (`/environmental`)
**Style:** Palo Alto Networks IoT Security Dashboard - dark navy header, cyan accents, data-dense layout

**Features:**
- Real-time sensor monitoring (8 sensors)
- Auto-refresh toggle with 5-second intervals
- Summary statistics (online/offline/warning sensors)
- Sensor utilization charts
- Risk assessment panel
- Alert management (acknowledge/dismiss)
- Threshold configuration (Particulate, CO2, Temperature)
- Export data to JSON
- Site and time range filters

---

### 3. TUG Fleet Monitor (`/tug-robot`)
**Style:** Professional medical-grade fleet management - light theme, clean table layout

**Features:**
- 4 TUG bots displayed in table view (Alpha, Beta, Gamma, Delta)
- Source locations: OR-1 through OR-6
- Destination: Sterilization Unit (standard)
- Status indicators: IDLE, EN_ROUTE, ARRIVED, RETURNING
- Real-time progress bars for active bots
- Battery level per unit
- "Deploy to Sterilization" button for idle bots
- "Return" button for arrived bots
- Quick stats: Avg Transit Time, On-Time Rate, Items Transported, Fleet Uptime

---

### 4. Room Scheduling / EHR System (`/ehr`)
**Style:** Epic/Cerner-inspired healthcare IT interface

**Features:**
- Patient scheduling
- Room assignments
- Status tracking

---

### 5. Variable Tracker (`/camera`)
**Style:** 2010s Epic Healthcare UI - blue title bar, grey gradients, beveled buttons, Windows-era aesthetic

**Features:**
- Unified monitoring of UV Robot and TUG Fleet metrics
- Tab filtering: All Variables, UV Disinfection, TUG Fleet
- 16 tracked variables across both systems
- Summary cards: Total, Normal, Warning, Critical counts
- Auto-refresh toggle (3-second intervals)
- Status indicators with color coding
- Monospace data display (Consolas font)
- Fixed status bar with live counts

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + Inline styles
- **Testing:** Jest + React Testing Library
- **Language:** TypeScript

## Development

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The server will start on the first available port (3000, 3001, 3002, etc.)

### Build for Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests for a specific dashboard
npm test -- uv-robot --watchAll=false
npm test -- environmental --watchAll=false
npm test -- tug-robot --watchAll=false

# Run all tests once (CI mode)
npm test -- --watchAll=false
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard index
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── uv-robot/
│   │   ├── page.tsx          # UV Robot dashboard
│   │   └── page.test.tsx     # 48 tests
│   ├── environmental/
│   │   ├── page.tsx          # Environmental monitoring
│   │   └── page.test.tsx     # 56 tests
│   ├── tug-robot/
│   │   ├── page.tsx          # TUG Fleet Monitor
│   │   └── page.test.tsx     # 20 tests
│   ├── ehr/
│   │   └── page.tsx          # EHR/Scheduling dashboard
│   └── camera/
│       └── page.tsx          # Variable Tracker dashboard
```

## Test Coverage

| Dashboard | Tests | Coverage |
|-----------|-------|----------|
| UV Robot Portal | 48 | All interactive elements |
| Environmental Monitoring | 56 | All interactive elements |
| TUG Fleet Monitor | 20 | All interactive elements |
| **Total** | **124** | |

## Design Philosophy

Each dashboard is intentionally designed to appear as if built by a different vendor:

- **UV Robot:** Swiss minimalism, generous whitespace, oversized typography
- **Environmental:** Modern IoT dashboard, data-dense, dark header
- **TUG Fleet:** Clean medical software, professional table layout
- **EHR:** Dense enterprise healthcare IT aesthetic
- **Variable Tracker:** Legacy 2010s Epic-style, Windows-era UI patterns

This diversity simulates the real-world experience of hospital staff who must interact with equipment from multiple vendors during OR turnover procedures.

## URLs

When running locally:
- **Index:** http://localhost:3000
- **UV Robot:** http://localhost:3000/uv-robot
- **Environmental:** http://localhost:3000/environmental
- **TUG Fleet:** http://localhost:3000/tug-robot
- **EHR:** http://localhost:3000/ehr
- **Variable Tracker:** http://localhost:3000/camera

*Note: If port 3000 is occupied, Next.js will use the next available port (3001, 3002, etc.)*
