# Medical Device Vendor Dashboards

A collection of 5 simulated medical device vendor web dashboards for OR (Operating Room) turnover scenarios. Each dashboard is designed to look like it comes from a different medical device company, with distinct visual styles and functionality.

## Dashboards

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

### 3. Sterilizer/Autoclave System (`/sterilizer`)
**Style:** Legacy hospital CSSD (Central Sterile Services Department) interface

**Features:**
- Cycle type selection
- Temperature and pressure displays
- Chamber status monitoring
- Cycle history

### 4. Room Scheduling / EHR System (`/ehr`)
**Style:** Epic/Cerner-inspired healthcare IT interface

**Features:**
- Patient scheduling
- Room assignments
- Status tracking

### 5. PTZ Surveillance Camera (`/camera`)
**Style:** Reolink/Axis security camera interface

**Features:**
- PTZ (Pan-Tilt-Zoom) controls
- Recording status
- Camera settings

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Language:** TypeScript

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard index.

### Build

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests for a specific dashboard
npm test -- environmental --watchAll=false
npm test -- uv-robot --watchAll=false
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard index
│   ├── uv-robot/
│   │   ├── page.tsx          # UV Robot dashboard
│   │   └── page.test.tsx     # 48 tests
│   ├── environmental/
│   │   ├── page.tsx          # Environmental monitoring
│   │   └── page.test.tsx     # 56 tests
│   ├── sterilizer/
│   │   └── page.tsx          # Sterilizer dashboard
│   ├── ehr/
│   │   └── page.tsx          # EHR/Scheduling dashboard
│   └── camera/
│       └── page.tsx          # Camera control dashboard
```

## Test Coverage

- **UV Robot Portal:** 48 tests covering all interactive elements
- **Environmental Monitoring:** 56 tests covering all interactive elements
- **Total:** 104 tests

## Design Philosophy

Each dashboard is intentionally designed to appear as if built by a different vendor:
- Different typography choices
- Unique color palettes
- Varied UI patterns and layouts
- Distinct interaction paradigms

This diversity simulates the real-world experience of hospital staff who must interact with equipment from multiple vendors during OR turnover procedures.
