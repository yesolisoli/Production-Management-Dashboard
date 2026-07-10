# Hog Intake & Primal Calculation — Architecture

This document describes the architecture of the **Hog Intake** and **Primal Calculation**
modules and how they share state and persistence. All diagrams are Mermaid.

Layer legend used throughout:

- **Presentation** — React components, render-only, no business logic
- **State** — hooks that own raw input state (single source of truth)
- **Derivation** — pure functions that compute derived values (no I/O, no state)
- **Persistence** — Supabase (cross-device) or localStorage (per-browser)

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph HI["Hog Intake module"]
        HIclient["hog-intake-client.tsx<br/>(presentation orchestrator)"]
        HIstate["useHogIntakeState<br/>(state — SoT for intake record)"]
        HIweekly["useWeeklyHogSchedule<br/>(state — SoT for weekly plan)"]
        HIcalc["calculations.ts<br/>(derivation)"]
    end

    subgraph PC["Primal Calculation module"]
        PCpage["PrimalCalculationPage.tsx<br/>(presentation orchestrator)"]
        PCstate["usePrimalCalculationState<br/>(state orchestrator)"]
        PCvm["view-model.ts<br/>(derivation)"]
        PCcalc["calculations.ts<br/>(derivation)"]
    end

    subgraph PERSIST["Persistence layer"]
        SB[("Supabase<br/>hog_intake_records<br/>primal_ending_stock")]
        LS[("localStorage<br/>drafts, orders,<br/>customer/custom data,<br/>weekly schedule")]
    end

    HIclient --> HIstate
    HIclient --> HIweekly
    HIclient --> HIcalc
    HIstate --> SB
    HIstate --> LS
    HIweekly --> LS

    PCpage --> PCstate
    PCpage --> PCvm
    PCvm --> PCcalc
    PCstate --> LS
    PCstate --> SB

    %% cross-module dependency: primal reads hog intake
    PCstate -. "loadHogIntakeForDate()<br/>read-only" .-> SB
    PCcalc -. "imports yieldTotal,<br/>PIECES_PER_HOG" .-> HIcalc

    classDef pres fill:#e3f2fd,stroke:#1565c0,color:#0d47a1;
    classDef state fill:#fff3e0,stroke:#e65100,color:#e65100;
    classDef deriv fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20;
    classDef persist fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c;

    class HIclient,PCpage pres;
    class HIstate,HIweekly,PCstate state;
    class HIcalc,PCvm,PCcalc deriv;
    class SB,LS persist;
```

**Cross-module boundary:** Primal Calculation is a *consumer* of Hog Intake. It reads
hog counts from Supabase (read-only, via `loadHogIntakeForDate`) and imports pure
calculation helpers (`yieldTotal`, `PIECES_PER_HOG`) from the hog-intake module. Hog
Intake has **no** dependency on Primal Calculation — the arrow only points one way.

---

## 2. Primal Calculation — Data Flow

```mermaid
flowchart TB
    subgraph INPUTS["Raw inputs"]
        user["User edits<br/>(orders, customer orders,<br/>custom groups/rows)"]
        csv["CSV file"]
    end

    subgraph STATE["State layer — usePrimalCalculationState (orchestrator)"]
        orders["usePrimalOrdersState<br/>(orders + draft)"]
        custord["usePrimalCustomerOrdersState<br/>(customer matrix)"]
        custgrp["usePrimalCustomGroupsState<br/>(custom customers/groups/rows)"]
        endstock["usePrimalEndingStockState<br/>(opening stock + carry-over)"]
        intake["intake record<br/>(loaded, read-only)"]
    end

    subgraph PURE["Parsing / derivation (pure)"]
        csvimport["csv-import.ts<br/>parsePrimalOrdersCsv()"]
        vm["view-model.ts<br/>derivePrimalViewModel()"]
        calc["calculations.ts<br/>buildGroupAvailability(),<br/>buildAvailabilityRows(),<br/>buildCustomerAvailability()"]
    end

    subgraph PERSIST["Persistence"]
        LSp[("localStorage<br/>primal-calc.*")]
        SBp[("Supabase<br/>primal_ending_stock")]
        SBi[("Supabase<br/>hog_intake_records")]
    end

    subgraph VIEW["Presentation"]
        page["PrimalCalculationPage"]
        avail["PrimalAvailabilityChart"]
        cust["PrimalCustomerChart"]
        groupsec["PrimalGroupSection (xN)"]
        modal["PrimalCsvImportModal"]
    end

    csv --> modal --> csvimport --> orders
    user --> orders
    user --> custord
    user --> custgrp

    orders <--> LSp
    custord <--> LSp
    custgrp <--> LSp
    SBi -- "loadHogIntakeForDate()" --> intake
    SBp -- "fetchPreviousEndingStock()" --> endstock

    orders --> vm
    custord --> vm
    custgrp --> vm
    endstock --> vm
    intake --> vm
    vm --> calc

    vm --> page
    page --> avail
    page --> cust
    page --> groupsec
    page --> modal

    %% ending stock is derived then written back (debounced + on save)
    calc -. "derived ending stock" .-> endstock
    endstock -- "saveEndingStockForDate()<br/>debounced ~600ms + on Save" --> SBp

    classDef pres fill:#e3f2fd,stroke:#1565c0,color:#0d47a1;
    classDef state fill:#fff3e0,stroke:#e65100,color:#e65100;
    classDef deriv fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20;
    classDef persist fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c;

    class page,avail,cust,groupsec,modal pres;
    class orders,custord,custgrp,endstock,intake state;
    class csvimport,vm,calc deriv;
    class LSp,SBp,SBi persist;
```

**The core calculation chain** (all in `calculations.ts`, invoked from `view-model.ts`):

```
Expected Production = yieldTotal(hog_counts) × PIECES_PER_HOG   ← from Hog Intake
        + Opening Stock          (per group, from Supabase carry-over)
        − Special Customer Orders (per group, from customer matrix)
        = Available Stock
        − Sales Orders            (catalog SKUs + custom rows, pooled per group)
        = Ending Stock            (derived; carried to next day; status OK/Low/Short)
```

Only the **raw inputs** (orders, customer orders, custom entities) are stored; Expected
Production, Available Stock, Ending Stock, and status are recomputed on every render.

---

## 3. Hog Intake — Data Flow

```mermaid
flowchart TB
    subgraph INPUTS["Raw inputs (user edits)"]
        farm["Farm delivery rows<br/>(JP/RWA/BK/Sow)"]
        manual["Manual counts<br/>(Round, Suckling, Customer)"]
        process["Process sheet<br/>(held over, deaths, boars)"]
        nextday["Next-day projection<br/>(side orders, overstock)"]
        weekly["Weekly plan grid<br/>(Mon–Fri)"]
    end

    subgraph STATE["State layer"]
        histate["useHogIntakeState<br/>(SoT: record, date, status, dirty)"]
        wkstate["useWeeklyHogSchedule<br/>(SoT: weekly rows)"]
    end

    subgraph DERIVE["Derivation (pure)"]
        calc["calculations.ts"]
        rollup["derivedCountsFromFarmRecords()<br/>JP/RWA/BK roll-up"]
        sow["sowPlanTotal (weekly sow rows)"]
        totals["deriveTotals()<br/>totalIntake, forCutting,<br/>yieldTotal, projectedForCutting"]
    end

    subgraph PERSIST["Persistence"]
        draftLS[("localStorage<br/>hog-intake.draft.{date}")]
        weeklyLS[("localStorage<br/>hog-intake.weekly-schedule")]
        SBrec[("Supabase<br/>hog_intake_records")]
    end

    subgraph VIEW["Presentation"]
        client["hog-intake-client.tsx"]
        wkgrid["weekly-hog-schedule.tsx"]
        summary["summary-panel.tsx"]
        farmrec["farm-records.tsx"]
        grids["hog-count-grid / primal-hogs-grid"]
        savebar["save-bar.tsx"]
    end

    farm --> histate
    manual --> histate
    process --> histate
    nextday --> histate
    weekly --> wkstate

    histate <--> draftLS
    histate -- "save(): upsertHogIntakeRecord()" --> SBrec
    SBrec -- "fetchHogIntakeByDate()" --> histate
    wkstate <--> weeklyLS

    wkstate -- "sowPlanTotal" --> histate
    histate --> rollup
    rollup --> calc
    sow --> calc
    histate --> totals
    totals --> calc

    histate --> client
    wkstate --> client
    client --> wkgrid
    client --> summary
    client --> farmrec
    client --> grids
    client --> savebar

    classDef pres fill:#e3f2fd,stroke:#1565c0,color:#0d47a1;
    classDef state fill:#fff3e0,stroke:#e65100,color:#e65100;
    classDef deriv fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20;
    classDef persist fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c;

    class client,wkgrid,summary,farmrec,grids,savebar pres;
    class histate,wkstate state;
    class calc,rollup,sow,totals deriv;
    class draftLS,weeklyLS,SBrec persist;
```

**Key derivation rule:** `hog_counts` displayed in the summary is **derived**, not raw.
It merges the persisted record's manual counts with farm-record roll-ups (JP/RWA/BK) and
the Sow figure (weekly plan + farm deliveries). Computed totals (total intake, for
cutting, yield, projected) are **never persisted** — they are recomputed wherever shown.

**Resolution order on date load:** non-empty draft → Supabase record → empty record.
The draft is cleared only after a successful Supabase save.

---

## 4. Persistence Map

```mermaid
flowchart LR
    subgraph SB["Supabase (cross-device, survives user switch)"]
        direction TB
        t1["hog_intake_records<br/>(raw inputs only;<br/>no computed totals)"]
        t2["primal_ending_stock<br/>(work_date, group_name,<br/>ending_stock)"]
    end

    subgraph LS["localStorage (per-browser)"]
        direction TB
        l1["hog-intake.draft.{date}<br/>— unsaved intake, cleared on save"]
        l2["hog-intake.weekly-schedule<br/>— weekly plan, persists"]
        l3["primal-calc.orders<br/>— committed orders"]
        l4["primal-calc.draft.{date}<br/>— unsaved orders, cleared on save"]
        l5["primal-calc.customer-orders"]
        l6["primal-calc.custom-customers"]
        l7["primal-calc.custom-groups"]
        l8["primal-calc.custom-rows"]
    end

    subgraph DV["Derived view-model (in-memory only, never persisted)"]
        direction TB
        d1["Hog Intake: deriveTotals()<br/>totalIntake, forCutting,<br/>yieldTotal, projectedForCutting"]
        d2["Primal: derivePrimalViewModel()<br/>Expected Production, Available Stock,<br/>Ending Stock, status, customer columns"]
    end

    t1 -- "yieldTotal feeds Expected Production" --> d2
    t1 --> d1
    t2 -- "previous day = opening stock" --> d2
    l3 --> d2
    l4 --> d2
    l5 --> d2
    l6 --> d2
    l7 --> d2
    l8 --> d2
    l2 -- "sowPlanTotal" --> d1

    %% derived ending stock is the only derived value written back
    d2 -. "ending stock written back<br/>(debounced + on Save)" .-> t2

    classDef sb fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c;
    classDef ls fill:#fff8e1,stroke:#f9a825,color:#f57f17;
    classDef dv fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20;

    class t1,t2 sb;
    class l1,l2,l3,l4,l5,l6,l7,l8 ls;
    class d1,d2 dv;
```

Note the one feedback edge: **Ending Stock** is a derived value, but because it must
carry over to the next production day across devices, it is written back to Supabase
(`primal_ending_stock`) — debounced ~600ms while editing and explicitly on Save. The
next day reads it back as that day's Opening Stock.

---

## Plain-English Explanation

**Hog Intake** is the upstream module. Each day an operator records how many hogs
arrived (farm delivery rows for JP/RWA/BK/Sow, plus manual counts for Round/Suckling/
Customer), processing adjustments, and a next-day projection. A separate weekly plan
grid (Mon–Fri) feeds the Sow figure. Two hooks own this state:
`useHogIntakeState` owns the daily record and `useWeeklyHogSchedule` owns the weekly
grid. Everything an operator sees as a "total" is computed on the fly by pure functions
in `calculations.ts` — the database only ever stores the raw inputs.

**Primal Calculation** is the downstream module. It reads the day's hog counts from
Hog Intake (read-only) and turns them into expected primal production:
`yieldTotal × PIECES_PER_HOG`. It then folds in yesterday's carried-over stock, special
customer orders, and the day's sales orders to compute, per production group, how much
stock is available and what will be left at end of day (with an OK / Low Reserve / Short
status). All of this derived structure is assembled in one pure function,
`derivePrimalViewModel`, which the page wraps in `useMemo`. The components are purely
presentational — they receive the view-model and render it.

The two modules connect at exactly two points, both one-directional: Primal reads
`hog_intake_records` from Supabase, and Primal's `calculations.ts` imports a couple of
pure helpers from Hog Intake. Hog Intake never imports from Primal.

### Single Source of Truth per dataset

| Dataset | Single source of truth | Backed by |
|---|---|---|
| Daily hog intake record (counts, farm rows, process, next-day) | `useHogIntakeState` | Supabase `hog_intake_records` (+ localStorage draft) |
| Weekly hog plan (Mon–Fri grid, sow plan) | `useWeeklyHogSchedule` | localStorage `hog-intake.weekly-schedule` |
| Primal production orders (catalog SKUs) | `usePrimalOrdersState` | localStorage `primal-calc.orders` (+ draft) |
| Customer order matrix | `usePrimalCustomerOrdersState` | localStorage `primal-calc.customer-orders` |
| Custom customers / groups / rows | `usePrimalCustomGroupsState` | localStorage `primal-calc.custom-*` |
| Opening / ending stock (carry-over) | `usePrimalEndingStockState` | Supabase `primal_ending_stock` |
| Hog counts consumed by Primal | (owned by Hog Intake; read-only here) | Supabase `hog_intake_records` |
| Every "total" / availability / status | **No stored SoT — derived** | `deriveTotals` / `derivePrimalViewModel` |

The rule the codebase follows: a dataset has a single owning hook, and anything that can
be computed from owned state is **never** stored as independent state — it is derived.

### Layer classification

**Presentation (render-only)**
- Hog Intake: `hog-intake-client.tsx`, `weekly-hog-schedule.tsx`, `summary-panel.tsx`,
  `farm-records.tsx`, `hog-count-grid.tsx`, `primal-hogs-grid.tsx`, `process-sheet.tsx`,
  `next-day-projection.tsx`, `save-bar.tsx`
- Primal: `PrimalCalculationPage.tsx`, `PrimalGroupSection.tsx`,
  `PrimalAvailabilityChart.tsx`, `PrimalCustomerChart.tsx`, `PrimalCsvImportModal.tsx`

**State (own raw input, single source of truth)**
- Hog Intake: `useHogIntakeState`, `useWeeklyHogSchedule`
- Primal: `usePrimalCalculationState` (orchestrator) composing `usePrimalOrdersState`,
  `usePrimalCustomerOrdersState`, `usePrimalCustomGroupsState`, `usePrimalEndingStockState`

**Derivation (pure, no I/O)**
- Hog Intake: `calculations.ts` (`deriveTotals`, `derivedCountsFromFarmRecords`,
  `yieldTotal`, `projectedForCutting`, …)
- Primal: `view-model.ts` (`derivePrimalViewModel`), `calculations.ts`
  (`buildGroupAvailability`, `buildAvailabilityRows`, `buildCustomerAvailability`, …),
  `csv-import.ts` (`parsePrimalOrdersCsv` — pure parsing)

**Persistence**
- Hog Intake: `supabase.ts` (`hog_intake_records`), `draft-storage.ts` (localStorage)
- Primal: `primal-storage.ts` (localStorage), `ending-stock-source.ts`
  (Supabase `primal_ending_stock`), `intake-source.ts` (read-only Supabase read of
  `hog_intake_records`)
```

