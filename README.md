# QA Matrix – Quality Assurance Control & Monitoring System

A full-featured web application for managing, monitoring, and analyzing quality assurance data across manufacturing workstations. Built with React, TypeScript, and Tailwind CSS, with a planned PostgreSQL backend for automatic data fetch and updates.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [Workflow](#workflow)
6. [Database Schema (SQL)](#database-schema-sql)
7. [Automatic Fetch & Update via SQL](#automatic-fetch--update-via-sql)
8. [API Endpoints](#api-endpoints)
9. [Frontend Structure](#frontend-structure)
10. [Calculations & Business Logic](#calculations--business-logic)
11. [Import & Export](#import--export)
12. [Getting Started](#getting-started)

---

## Overview

The QA Matrix system tracks quality concerns across three manufacturing stages — **Trim**, **Chassis**, and **Final** — with quality control scoring, weekly recurrence tracking, and real-time status computation (OK/NG) at Workstation, MFG, and Plant levels.

---

## Features

- **Dashboard**: Summary cards showing total concerns, NG counts by level, and rating breakdowns (1/3/5)
- **Filterable Matrix Table**: Search, filter by source, designation, rating, and status
- **Inline Editing**: Edit weekly recurrence, station scores, defect ratings, and action items directly in the table
- **Auto-Calculation**: Statuses (OK/NG) and control ratings recalculate automatically on every edit
- **Excel Import/Export**: Import from `.xlsx` files; export filtered data to Excel or CSV
- **Add/Delete Concerns**: Add new quality concerns via dialog; delete existing ones
- **Data Persistence**: Currently uses localStorage; designed for migration to PostgreSQL

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│                                                     │
│  Index Page ──► Dashboard + Filters + QAMatrixTable │
│       │                                             │
│  usePersistedData() hook (data layer)               │
│       │                                             │
│  qaCalculations.ts (business logic)                 │
│       │                                             │
│  xlsxImport / xlsxExport / csvExport (I/O)         │
└──────────────────────┬──────────────────────────────┘
                       │ (planned)
                       ▼
┌─────────────────────────────────────────────────────┐
│              Backend (PostgreSQL + API)              │
│                                                     │
│  qa_concerns table ─── RLS policies                 │
│  trim_scores table                                  │
│  chassis_scores table                               │
│  final_scores table                                 │
│  qcontrol_scores table                              │
│  weekly_recurrence table                            │
│                                                     │
│  SQL Functions: auto-recalculate statuses           │
│  Triggers: on INSERT/UPDATE → recalculate           │
│  Edge Functions: Excel import, scheduled sync       │
└─────────────────────────────────────────────────────┘
```

---

## Data Model

### QAMatrixEntry (TypeScript Interface)

Each concern record contains:

| Field | Type | Description |
|-------|------|-------------|
| `sNo` | `number` | Serial number (unique identifier) |
| `source` | `string` | Origin of concern (Field, SCA, DVX, ER4, etc.) |
| `operationStation` | `string` | Station code (T10, C50, F30, etc.) |
| `designation` | `string` | Area: Trim, Chassis, or Final |
| `concern` | `string` | Description of the defect/failure mode |
| `defectRating` | `1 \| 3 \| 5` | Severity rating |
| `weeklyRecurrence` | `number[6]` | Last 6 weeks recurrence counts |
| `recurrence` | `number` | Sum of weekly recurrence |
| `recurrenceCountPlusDefect` | `number` | `defectRating + recurrence` |
| `trim` | `TrimScores` | 11 station scores (T10–T100, TPQG) |
| `chassis` | `ChassisScores` | 15 station scores (C10–C80, CPQG) |
| `final` | `FinalScores` | 12 scores (F10–F100, FPQG, ResidualTorque) |
| `qControl` | `QControlScores` | 11 quality control method scores (1.1–5.3) |
| `qControlDetail` | `QControlDetail` | 4 detail scores (CVT, SHOWER, Dynamic/UB, CC4) |
| `controlRating` | `{MFG, Quality, Plant}` | Computed control ratings |
| `workstationStatus` | `OK \| NG` | Computed workstation status |
| `mfgStatus` | `OK \| NG` | Computed MFG status |
| `plantStatus` | `OK \| NG` | Computed plant status |
| `mfgAction` | `string` | Corrective action description |
| `resp` | `string` | Responsible person |
| `target` | `string` | Target week/date |

### Score Sections

- **Trim (11 stations)**: T10, T20, T30, T40, T50, T60, T70, T80, T90, T100, TPQG
- **Chassis (15 stations)**: C10, C20, C30, C40, C45, P10, P20, P30, C50, C60, C70, R/Sub, T/S, C80, CPQG
- **Final (12 fields)**: F10, F20, F30, F40, F50, F60, F70, F80, F90, F100, FPQG, Residual Torque
- **Q'Control (11 methods)**: 1.1 Frequency Control → 5.3 SAE Prohibition
- **Q'Control Detail (4)**: CVT, SHOWER, Dynamic/UB, CC4

---

## Workflow

### Current Workflow (Client-Side)

```
1. App loads → usePersistedData hook checks localStorage
2. If no cached data → fetches /qa.xlsx and parses it via xlsx library
3. Data displayed in Dashboard + QAMatrixTable
4. User edits (weekly recurrence, scores, fields) → recalculateStatuses()
5. Updated data saved to localStorage
6. User can export filtered data to Excel (.xlsx) or CSV
7. User can import additional concerns from Excel files
8. Reset button clears localStorage and reloads from /qa.xlsx
```

### Target Workflow (With Backend & SQL)

```
1. App loads → Frontend calls GET /api/concerns
2. Backend queries PostgreSQL → returns all QAMatrixEntry records
3. Dashboard + Table render with live data
4. User edits a field → Frontend calls PATCH /api/concerns/:id
5. Backend UPDATE triggers SQL function → auto-recalculates statuses
6. Updated record returned to frontend
7. Scheduled SQL jobs (pg_cron) auto-update recurrence weekly
8. Excel import → Edge Function parses and bulk INSERTs
9. Export → Backend generates Excel/CSV from current DB state
```

---

## Database Schema (SQL)

### Main Table: `qa_concerns`

```sql
CREATE TABLE public.qa_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s_no SERIAL UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  operation_station TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  concern TEXT NOT NULL DEFAULT '',
  defect_rating SMALLINT NOT NULL CHECK (defect_rating IN (1, 3, 5)),
  
  -- Weekly recurrence (last 6 weeks)
  week_minus_6 INTEGER NOT NULL DEFAULT 0,
  week_minus_5 INTEGER NOT NULL DEFAULT 0,
  week_minus_4 INTEGER NOT NULL DEFAULT 0,
  week_minus_3 INTEGER NOT NULL DEFAULT 0,
  week_minus_2 INTEGER NOT NULL DEFAULT 0,
  week_minus_1 INTEGER NOT NULL DEFAULT 0,
  
  -- Computed fields (auto-calculated by trigger)
  recurrence INTEGER GENERATED ALWAYS AS (
    week_minus_6 + week_minus_5 + week_minus_4 + week_minus_3 + week_minus_2 + week_minus_1
  ) STORED,
  recurrence_count_plus_defect INTEGER GENERATED ALWAYS AS (
    defect_rating + week_minus_6 + week_minus_5 + week_minus_4 + week_minus_3 + week_minus_2 + week_minus_1
  ) STORED,

  -- Trim Scores (11 stations)
  t10 INTEGER, t20 INTEGER, t30 INTEGER, t40 INTEGER, t50 INTEGER,
  t60 INTEGER, t70 INTEGER, t80 INTEGER, t90 INTEGER, t100 INTEGER, tpqg INTEGER,

  -- Chassis Scores (15 stations)
  c10 INTEGER, c20 INTEGER, c30 INTEGER, c40 INTEGER, c45 INTEGER,
  p10 INTEGER, p20 INTEGER, p30 INTEGER, c50 INTEGER, c60 INTEGER,
  c70 INTEGER, r_sub INTEGER, ts INTEGER, c80 INTEGER, cpqg INTEGER,

  -- Final Scores (12 fields)
  f10 INTEGER, f20 INTEGER, f30 INTEGER, f40 INTEGER, f50 INTEGER,
  f60 INTEGER, f70 INTEGER, f80 INTEGER, f90 INTEGER, f100 INTEGER,
  fpqg INTEGER, residual_torque INTEGER,

  -- Q'Control Scores (11 methods)
  freq_control_1_1 INTEGER,
  visual_control_1_2 INTEGER,
  periodic_audit_1_3 INTEGER,
  human_control_1_4 INTEGER,
  sae_alert_3_1 INTEGER,
  freq_measure_3_2 INTEGER,
  manual_tool_3_3 INTEGER,
  human_tracking_3_4 INTEGER,
  auto_control_5_1 INTEGER,
  impossibility_5_2 INTEGER,
  sae_prohibition_5_3 INTEGER,

  -- Q'Control Detail (4 fields)
  cvt INTEGER,
  shower INTEGER,
  dynamic_ub INTEGER,
  cc4 INTEGER,

  -- Control Ratings (computed by trigger)
  ctrl_rating_mfg INTEGER DEFAULT 0,
  ctrl_rating_quality INTEGER DEFAULT 0,
  ctrl_rating_plant INTEGER DEFAULT 0,

  -- Statuses (computed by trigger)
  workstation_status TEXT DEFAULT 'NG' CHECK (workstation_status IN ('OK', 'NG')),
  mfg_status TEXT DEFAULT 'NG' CHECK (mfg_status IN ('OK', 'NG')),
  plant_status TEXT DEFAULT 'NG' CHECK (plant_status IN ('OK', 'NG')),

  -- Action tracking
  mfg_action TEXT DEFAULT '',
  resp TEXT DEFAULT '',
  target TEXT DEFAULT '',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common filters
CREATE INDEX idx_qa_concerns_source ON public.qa_concerns(source);
CREATE INDEX idx_qa_concerns_designation ON public.qa_concerns(designation);
CREATE INDEX idx_qa_concerns_defect_rating ON public.qa_concerns(defect_rating);
CREATE INDEX idx_qa_concerns_plant_status ON public.qa_concerns(plant_status);
```

### Enable Row Level Security

```sql
ALTER TABLE public.qa_concerns ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all concerns
CREATE POLICY "Users can view all concerns"
  ON public.qa_concerns FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert concerns
CREATE POLICY "Users can insert concerns"
  ON public.qa_concerns FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update concerns
CREATE POLICY "Users can update concerns"
  ON public.qa_concerns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete concerns
CREATE POLICY "Users can delete concerns"
  ON public.qa_concerns FOR DELETE
  TO authenticated
  USING (true);
```

---

## Automatic Fetch & Update via SQL

### Auto-Recalculate Trigger Function

This SQL function automatically recalculates control ratings and statuses whenever a row is inserted or updated:

```sql
CREATE OR REPLACE FUNCTION public.recalculate_qa_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  trim_sum INTEGER;
  chassis_sum INTEGER;
  final_sum INTEGER;
  mfg_rating INTEGER;
  quality_rating INTEGER;
  plant_rating INTEGER;
  has_recurrence BOOLEAN;
  dr INTEGER;
BEGIN
  dr := NEW.defect_rating;

  -- Sum Trim scores
  trim_sum := COALESCE(NEW.t10, 0) + COALESCE(NEW.t20, 0) + COALESCE(NEW.t30, 0) +
              COALESCE(NEW.t40, 0) + COALESCE(NEW.t50, 0) + COALESCE(NEW.t60, 0) +
              COALESCE(NEW.t70, 0) + COALESCE(NEW.t80, 0) + COALESCE(NEW.t90, 0) +
              COALESCE(NEW.t100, 0) + COALESCE(NEW.tpqg, 0);

  -- Sum Chassis scores
  chassis_sum := COALESCE(NEW.c10, 0) + COALESCE(NEW.c20, 0) + COALESCE(NEW.c30, 0) +
                 COALESCE(NEW.c40, 0) + COALESCE(NEW.c45, 0) + COALESCE(NEW.p10, 0) +
                 COALESCE(NEW.p20, 0) + COALESCE(NEW.p30, 0) + COALESCE(NEW.c50, 0) +
                 COALESCE(NEW.c60, 0) + COALESCE(NEW.c70, 0) + COALESCE(NEW.r_sub, 0) +
                 COALESCE(NEW.ts, 0) + COALESCE(NEW.c80, 0) + COALESCE(NEW.cpqg, 0);

  -- Sum Final scores (excluding Residual Torque for MFG rating)
  final_sum := COALESCE(NEW.f10, 0) + COALESCE(NEW.f20, 0) + COALESCE(NEW.f30, 0) +
               COALESCE(NEW.f40, 0) + COALESCE(NEW.f50, 0) + COALESCE(NEW.f60, 0) +
               COALESCE(NEW.f70, 0) + COALESCE(NEW.f80, 0) + COALESCE(NEW.f90, 0) +
               COALESCE(NEW.f100, 0) + COALESCE(NEW.fpqg, 0);

  -- MFG Control Rating = Trim + Chassis + Final (without Residual Torque)
  mfg_rating := trim_sum + chassis_sum + final_sum;

  -- Quality Control Rating = sum of Q'Control scores (1.1 to 5.3)
  quality_rating := COALESCE(NEW.freq_control_1_1, 0) + COALESCE(NEW.visual_control_1_2, 0) +
                    COALESCE(NEW.periodic_audit_1_3, 0) + COALESCE(NEW.human_control_1_4, 0) +
                    COALESCE(NEW.sae_alert_3_1, 0) + COALESCE(NEW.freq_measure_3_2, 0) +
                    COALESCE(NEW.manual_tool_3_3, 0) + COALESCE(NEW.human_tracking_3_4, 0) +
                    COALESCE(NEW.auto_control_5_1, 0) + COALESCE(NEW.impossibility_5_2, 0) +
                    COALESCE(NEW.sae_prohibition_5_3, 0);

  -- Plant Control Rating = Residual Torque + Q'Control + Q'Control Detail
  plant_rating := COALESCE(NEW.residual_torque, 0) + quality_rating +
                  COALESCE(NEW.cvt, 0) + COALESCE(NEW.shower, 0) +
                  COALESCE(NEW.dynamic_ub, 0) + COALESCE(NEW.cc4, 0);

  -- Check if any recurrence in last 6 weeks
  has_recurrence := (NEW.week_minus_6 + NEW.week_minus_5 + NEW.week_minus_4 +
                     NEW.week_minus_3 + NEW.week_minus_2 + NEW.week_minus_1) > 0;

  -- Set computed fields
  NEW.ctrl_rating_mfg := mfg_rating;
  NEW.ctrl_rating_quality := quality_rating;
  NEW.ctrl_rating_plant := plant_rating;

  -- Workstation: NG if any recurrence, else compare MFG rating vs defect rating
  NEW.workstation_status := CASE
    WHEN has_recurrence THEN 'NG'
    WHEN mfg_rating >= dr THEN 'OK'
    ELSE 'NG'
  END;

  -- MFG Status: MFG rating >= defect rating
  NEW.mfg_status := CASE WHEN mfg_rating >= dr THEN 'OK' ELSE 'NG' END;

  -- Plant Status: Plant rating >= defect rating
  NEW.plant_status := CASE WHEN plant_rating >= dr THEN 'OK' ELSE 'NG' END;

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Attach trigger to auto-run on INSERT and UPDATE
CREATE TRIGGER trg_recalculate_qa_statuses
  BEFORE INSERT OR UPDATE ON public.qa_concerns
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_qa_statuses();
```

### Weekly Recurrence Auto-Shift (Scheduled Job)

Use `pg_cron` to automatically shift weekly recurrence data every Monday:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Shift recurrence: W-6 ← W-5, W-5 ← W-4, ..., W-1 ← 0
SELECT cron.schedule(
  'shift-weekly-recurrence',
  '0 0 * * 1',  -- Every Monday at midnight
  $$
    UPDATE public.qa_concerns
    SET
      week_minus_6 = week_minus_5,
      week_minus_5 = week_minus_4,
      week_minus_4 = week_minus_3,
      week_minus_3 = week_minus_2,
      week_minus_2 = week_minus_1,
      week_minus_1 = 0;
  $$
);
```

### Useful SQL Queries

```sql
-- Get all Plant NG concerns
SELECT * FROM public.qa_concerns WHERE plant_status = 'NG';

-- Get concerns by rating and status
SELECT * FROM public.qa_concerns 
WHERE defect_rating = 5 AND plant_status = 'NG';

-- Dashboard summary
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE workstation_status = 'NG') AS ng_workstation,
  COUNT(*) FILTER (WHERE mfg_status = 'NG') AS ng_mfg,
  COUNT(*) FILTER (WHERE plant_status = 'NG') AS ng_plant,
  COUNT(*) FILTER (WHERE defect_rating = 1) AS rating_1,
  COUNT(*) FILTER (WHERE defect_rating = 3) AS rating_3,
  COUNT(*) FILTER (WHERE defect_rating = 5) AS rating_5
FROM public.qa_concerns;

-- Rating breakdown by level
SELECT
  defect_rating,
  COUNT(*) FILTER (WHERE workstation_status = 'NG') AS ng_ws,
  COUNT(*) FILTER (WHERE workstation_status = 'OK') AS ok_ws,
  COUNT(*) FILTER (WHERE mfg_status = 'NG') AS ng_mfg,
  COUNT(*) FILTER (WHERE mfg_status = 'OK') AS ok_mfg,
  COUNT(*) FILTER (WHERE plant_status = 'NG') AS ng_plant,
  COUNT(*) FILTER (WHERE plant_status = 'OK') AS ok_plant
FROM public.qa_concerns
GROUP BY defect_rating;

-- Update a specific concern's score
UPDATE public.qa_concerns
SET t30 = 3, c50 = 5
WHERE s_no = 1;
-- Trigger auto-recalculates statuses!

-- Bulk insert from Excel import (via Edge Function)
INSERT INTO public.qa_concerns (
  source, operation_station, designation, concern, defect_rating,
  week_minus_6, week_minus_5, week_minus_4, week_minus_3, week_minus_2, week_minus_1,
  t10, t20, t30, /* ... all score columns ... */
  mfg_action, resp, target
) VALUES
  ('Field', 'C80', 'Chassis', 'Brake switch failure', 5, 0, 0, 0, 0, 0, 0, ...),
  ('SCA', 'T20', 'Trim', 'AC knob malfunction', 3, 0, 0, 0, 0, 0, 0, ...);
-- Statuses auto-calculated by trigger!
```

---

## API Endpoints

### REST API (Edge Functions)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/concerns` | Fetch all concerns (with optional filters) |
| `GET` | `/api/concerns/:id` | Fetch single concern by ID |
| `POST` | `/api/concerns` | Create new concern |
| `PATCH` | `/api/concerns/:id` | Update concern fields |
| `DELETE` | `/api/concerns/:id` | Delete a concern |
| `GET` | `/api/dashboard` | Get dashboard summary stats |
| `POST` | `/api/import` | Bulk import from Excel file |
| `GET` | `/api/export?format=xlsx` | Export data as Excel |
| `GET` | `/api/export?format=csv` | Export data as CSV |

### Query Parameters for GET /api/concerns

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Filter by source (Field, SCA, DVX, etc.) |
| `designation` | string | Filter by area (Trim, Chassis, Final) |
| `defect_rating` | number | Filter by rating (1, 3, or 5) |
| `status` | string | Filter: `NG` (any NG) or `OK` (all OK) |
| `search` | string | Search in concern text and station |

---

## Frontend Structure

```
src/
├── pages/
│   └── Index.tsx              # Main page with dashboard, filters, table
├── components/
│   ├── Dashboard.tsx          # Summary cards and rating breakdown
│   ├── QAMatrixTable.tsx      # Editable data table
│   ├── AddConcernDialog.tsx   # Dialog for adding new concerns
│   ├── FileUploadDialog.tsx   # Excel file import dialog
│   ├── StatusBadge.tsx        # OK/NG status badge component
│   └── NavLink.tsx            # Navigation link component
├── hooks/
│   ├── usePersistedData.ts    # Data persistence hook (localStorage → DB)
│   └── use-mobile.tsx         # Mobile detection hook
├── types/
│   └── qaMatrix.ts            # TypeScript interfaces
├── utils/
│   ├── qaCalculations.ts      # Status recalculation logic
│   ├── xlsxImport.ts          # Excel file parser (76-column mapping)
│   ├── xlsxExport.ts          # Excel export generator
│   └── csvExport.ts           # CSV export generator
└── data/
    └── qaMatrixData.ts        # Seed/sample data
```

---

## Calculations & Business Logic

### Control Rating Formulas

| Rating | Formula |
|--------|---------|
| **MFG** | Sum of all Trim + Chassis + Final scores (excluding Residual Torque) |
| **Quality** | Sum of all Q'Control scores (1.1 through 5.3) |
| **Plant** | Residual Torque + Q'Control scores + Q'Control Detail (CVT, SHOWER, Dynamic/UB, CC4) |

### Status Rules

| Status | Rule |
|--------|------|
| **Workstation** | `NG` if any weekly recurrence > 0; else `OK` if MFG Rating ≥ Defect Rating |
| **MFG** | `OK` if MFG Rating ≥ Defect Rating; else `NG` |
| **Plant** | `OK` if Plant Rating ≥ Defect Rating; else `NG` |

### Excel Column Mapping (0-indexed)

```
Col 0: S.No          Col 14-24: Trim (T10–TPQG)
Col 1: Source         Col 25-39: Chassis (C10–CPQG)
Col 2: Station        Col 40-51: Final (F10–ResidualTorque)
Col 3: Designation    Col 52-62: Q'Control (1.1–5.3)
Col 4: Concern        Col 63-66: Q'Control Detail
Col 5: Defect Rating  Col 67-69: Control Ratings
Col 6: Recurrence     Col 70-72: Statuses
Col 7-12: W-6 to W-1  Col 73-75: Action/Resp/Target
Col 13: RC+DR
```

---

## Import & Export

### Excel Import

- Supports `.xlsx` files with the standard 76-column format
- Automatically detects header rows and starts parsing from the first numeric S.No
- All scores are parsed as nullable integers
- Statuses are recalculated after import regardless of source values

### Excel Export

- Exports all visible/filtered data to `.xlsx` format
- Preserves the full 76-column structure with headers
- File downloads automatically as `qa-matrix-export.xlsx`

### CSV Export

- Lightweight export of filtered data
- Concern text and action fields are properly quoted
- Downloads as `qa-matrix-export.csv`

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (for backend)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd qa-matrix

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database Setup

1. Create a PostgreSQL database
2. Run the schema SQL from [Database Schema](#database-schema-sql)
3. Run the trigger function from [Automatic Fetch & Update](#automatic-fetch--update-via-sql)
4. (Optional) Set up pg_cron for weekly recurrence shift
5. Seed initial data by importing from the provided `qa.xlsx` file

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/qa_matrix
API_URL=http://localhost:3000/api
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Lucide Icons |
| Charts | Recharts |
| Excel I/O | SheetJS (xlsx) |
| Database | PostgreSQL 14+ |
| Backend | Edge Functions (Deno) |
| Scheduling | pg_cron + pg_net |

---

## License

Internal use only. All rights reserved.
