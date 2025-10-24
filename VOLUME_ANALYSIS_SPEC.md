# Volume Analysis Feature - Complete Specification

## Table of Contents
1. [Overview](#overview)
2. [Business Context](#business-context)
3. [Data Model](#data-model)
4. [Detection Logic](#detection-logic)
5. [UI Components](#ui-components)
6. [Implementation Steps](#implementation-steps)
7. [Code Examples](#code-examples)
8. [Testing Scenarios](#testing-scenarios)

---

## Overview

**Feature Name:** Volume Analysis
**Purpose:** Analyze cost differences when the same BOM (Bill of Materials) or item is ordered at different quantities
**Location:**
- BOM Tab → Volume Analysis view
- Items Tab → Volume Analysis view

**When to Show:**
- Only display this tab/view when duplicate BOMs with different quantities are detected
- If no duplicates exist, hide this tab completely

---

## Business Context

### The Problem
In manufacturing, vendors often provide volume discounts (or sometimes price increases) when ordering at scale.

**Example Scenario:**
```
BOM D - Control System

Low Volume (10 units):
├── Control Panel: $1500/unit × 10 = $15,000
├── Temp Sensor:   $200/unit × 10  = $2,000
├── Relay Module:  $150/unit × 10  = $1,500
└── Cable Assembly: $300/unit × 10  = $3,000
TOTAL: $21,500 for 10 units
PER UNIT COST: $2,150

High Volume (1000 units):
├── Control Panel: $1380/unit × 1000 = $1,380,000  (8% discount!)
├── Temp Sensor:   $175/unit × 1000  = $175,000    (12.5% discount!)
├── Relay Module:  $138/unit × 1000  = $138,000    (8% discount!)
└── Cable Assembly: $285/unit × 1000  = $285,000   (5% discount!)
TOTAL: $1,978,000 for 1000 units
PER UNIT COST: $1,978

SAVINGS: $172 per unit (8% reduction)
TOTAL SAVINGS at 1000 units: $172,000
```

### Key Insights to Show Users:
1. **Which items got cheaper** at higher volumes (volume discounts)
2. **Which items got more expensive** (some items may increase due to customization, rush orders, etc.)
3. **Per-unit cost trend** as volume increases
4. **Break-even analysis** - at what volume does it become economical
5. **Vendor performance** - which vendors gave best discounts

---

## Data Model

### Current Mock Data Location
`src/data/mockQuoteData.ts`

### BOM D Structure (Volume Analysis Example)

```typescript
// Low Volume Scenario (10 units)
topItemsByCost.overall = [
  // ... existing items ...

  // BOM D - Low Volume (10 units)
  {
    rank: 16,
    itemCode: "CTRL-PANEL-001",
    itemName: "Industrial Control Panel",
    bomPath: "D",           // Main BOM
    quantity: 10,
    unit: "PCS",
    quotedRate: 1500,       // $1500 per unit at low volume
    totalCost: 15000,
    percentOfQuote: 2.8,
    vendor: "Electronics Corp",
    category: "Electronics"
  },
  {
    rank: 17,
    itemCode: "SENSOR-TEMP-001",
    itemName: "Temperature Sensor Module",
    bomPath: "D.1",         // Sub-BOM
    quantity: 10,
    unit: "PCS",
    quotedRate: 200,        // $200 per unit at low volume
    totalCost: 2000,
    percentOfQuote: 0.4,
    vendor: "Sensor Tech Inc",
    category: "Electronics"
  },
  // ... more items for BOM D at 10 units

  // High Volume Scenario (1000 units) - SAME ITEMS, DIFFERENT QUANTITIES
  {
    rank: 20,
    itemCode: "CTRL-PANEL-001",   // SAME item code
    itemName: "Industrial Control Panel",
    bomPath: "D",                  // SAME BOM path
    quantity: 1000,                // DIFFERENT quantity
    unit: "PCS",
    quotedRate: 1380,              // $1380 per unit (8% discount!)
    totalCost: 1380000,
    percentOfQuote: 260.0,
    vendor: "Electronics Corp",
    category: "Electronics"
  },
  {
    rank: 21,
    itemCode: "SENSOR-TEMP-001",  // SAME item code
    itemName: "Temperature Sensor Module",
    bomPath: "D.1",                // SAME BOM path
    quantity: 1000,                // DIFFERENT quantity
    unit: "PCS",
    quotedRate: 175,               // $175 per unit (12.5% discount!)
    totalCost: 175000,
    percentOfQuote: 33.0,
    vendor: "Sensor Tech Inc",
    category: "Electronics"
  },
  // ... more items
]

// BOM-level data
bomCostComparison = [
  // ... existing BOMs A, B, C ...

  {
    bomCode: "D",
    bomName: "Control System - Low Volume (10 units)",
    itemsSubtotal: 21500,        // Sum of all items
    bomAdditionalCosts: 1500,    // BOM-level additional costs
    bomTotalWithAC: 23000,       // Total with AC
    percentOfQuote: 4.3,
    bomQuantity: 10              // NEW FIELD - BOM quantity
  },
  {
    bomCode: "D",
    bomName: "Control System - High Volume (1000 units)",
    itemsSubtotal: 1978000,      // Sum of all items
    bomAdditionalCosts: 120000,  // BOM-level additional costs
    bomTotalWithAC: 2098000,     // Total with AC
    percentOfQuote: 396.0,
    bomQuantity: 1000            // NEW FIELD - BOM quantity
  }
]
```

### TypeScript Interface Update

```typescript
// src/types/quote.types.ts

export interface BOMCostComparison {
  bomCode: string;
  bomName: string;
  itemsSubtotal: number;
  bomAdditionalCosts: number;
  bomTotalWithAC: number;
  percentOfQuote: number;
  bomQuantity?: number;          // NEW - For volume analysis
}
```

---

## Detection Logic

### How to Detect Volume Scenarios

**Rule:** A volume scenario exists when the same `bomCode` appears multiple times with different quantities.

```typescript
// Function to detect if volume analysis should be shown
function hasVolumeScenarios(bomCostComparison: BOMCostComparison[]): boolean {
  const bomCodeCounts = new Map<string, number>();

  for (const bom of bomCostComparison) {
    const count = bomCodeCounts.get(bom.bomCode) || 0;
    bomCodeCounts.set(bom.bomCode, count + 1);
  }

  // If any BOM code appears more than once, we have volume scenarios
  for (const count of bomCodeCounts.values()) {
    if (count > 1) return true;
  }

  return false;
}

// Usage in BOMTab component
const showVolumeAnalysis = hasVolumeScenarios(bomCostComparison);

// Only show Volume Analysis button if true
const views = [
  { id: 'comparison', label: 'BOM Comparison', icon: '📊' },
  { id: 'additional-costs', label: 'BOM Additional Costs', icon: '💰' },
  { id: 'validation', label: 'Cost Validation', icon: '✅' },
  // Conditionally add volume analysis
  ...(showVolumeAnalysis ? [{ id: 'volume-analysis', label: 'Volume Analysis', icon: '📈' }] : [])
];
```

---

## UI Components

### Component Structure

```
src/components/analytics/tabs/bom-views/
├── BOMComparisonView.tsx          (existing)
├── BOMAdditionalCostsView.tsx     (existing)
├── BOMValidationView.tsx          (existing)
└── BOMVolumeAnalysisView.tsx      (NEW - to create)

src/components/analytics/tabs/items-views/
├── CostView.tsx                   (existing)
├── VendorView.tsx                 (existing)
├── CategoryView.tsx               (existing)
├── RateView.tsx                   (existing)
├── AdditionalCostsView.tsx        (existing)
├── ItemSourceView.tsx             (existing)
└── ItemVolumeAnalysisView.tsx     (NEW - to create)
```

### BOM Volume Analysis View Layout

```
┌────────────────────────────────────────────────────────────┐
│  VOLUME SCENARIOS DETECTED                                 │
│  📊 BOM D appears at 2 different volumes                   │
└────────────────────────────────────────────────────────────┘

┌─────────────┬─────────────┬──────────────┬────────────────┐
│  Metric     │ Low Volume  │ High Volume  │  Difference    │
├─────────────┼─────────────┼──────────────┼────────────────┤
│  Quantity   │  10 units   │  1000 units  │  100x          │
│  Base Cost  │  $21,500    │  $1,978,000  │  -             │
│  With AC    │  $23,000    │  $2,098,000  │  -             │
│  Per Unit   │  $2,150     │  $1,978      │  -$172 (8%)    │
└─────────────┴─────────────┴──────────────┴────────────────┘

┌────────────────────────────────────────────────────────────┐
│  SCATTER PLOT: Volume vs Per-Unit Cost                    │
│                                                            │
│   2200 ┤                                                   │
│        │  ●  (10, $2150)                                   │
│   2100 ┤                                                   │
│        │                                                   │
│   2000 ┤            ●  (1000, $1978)                       │
│        │                                                   │
│   1900 ┤                                                   │
│        └──────┬──────┬──────┬──────┬──────                │
│              10     100    500    1000   Volume            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ITEM-LEVEL COST CHANGES                                   │
│                                                            │
│  Item                   │ Low Vol │ High Vol │  Change    │
│  ──────────────────────┼─────────┼──────────┼──────────  │
│  Control Panel         │  $1500  │  $1380   │  -8.0% ✓   │
│  Temp Sensor          │  $200   │  $175    │  -12.5% ✓✓ │
│  Relay Module         │  $150   │  $138    │  -8.0% ✓   │
│  Cable Assembly       │  $300   │  $285    │  -5.0% ✓   │
└────────────────────────────────────────────────────────────┘

Legend: ✓ = Discount, ✗ = Price increase
```

### Items Volume Analysis View Layout

```
┌────────────────────────────────────────────────────────────┐
│  ITEMS ACROSS MULTIPLE VOLUMES                             │
│  📦 4 items appear in BOMs with different quantities       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  SCATTER PLOT: Item Rate Changes by Volume                │
│                                                            │
│  Each dot = one item at a specific volume                  │
│  Color = Category                                          │
│                                                            │
│   Rate                                                     │
│   ($)                                                      │
│   1500 ┤  ●  Control Panel (10)                            │
│        │                                                   │
│   1380 ┤            ●  Control Panel (1000)                │
│        │                                                   │
│    300 ┤  ●  Cable (10)                                    │
│    285 ┤     ●  Cable (1000)                               │
│    200 ┤  ●  Sensor (10)                                   │
│    175 ┤     ●  Sensor (1000)                              │
│        └──────┬──────┬──────┬──────┬──────                │
│              10     100    500    1000   Quantity          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  VENDOR DISCOUNT PERFORMANCE                               │
│                                                            │
│  Vendor              │ Items │ Avg Discount │  Rating     │
│  ───────────────────┼───────┼──────────────┼────────────  │
│  Sensor Tech Inc    │   1   │   -12.5%     │  Excellent  │
│  Electronics Corp   │   2   │   -8.0%      │  Good       │
│  Cable Solutions    │   1   │   -5.0%      │  Fair       │
└────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create BOM Volume Analysis Component

**File:** `src/components/analytics/tabs/bom-views/BOMVolumeAnalysisView.tsx`

**Props Interface:**
```typescript
interface BOMVolumeAnalysisViewProps {
  bomCostComparison: BOMCostComparison[];
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}
```

**Key Sections:**
1. **Volume Scenarios Detection**
   - Group BOMs by `bomCode`
   - Filter groups with > 1 entry
   - Extract low/high volume pairs

2. **Comparison Table**
   - Side-by-side comparison of volumes
   - Calculate per-unit costs
   - Show absolute and % differences

3. **Scatter Plot Chart** (using Recharts)
   - X-axis: Quantity (volume)
   - Y-axis: Per-unit cost
   - Each point = one volume scenario
   - Color by BOM code

4. **Item-Level Analysis**
   - For each item in the BOM volumes
   - Show rate changes
   - Highlight discounts (green) vs increases (red)
   - Sort by % change (largest discounts first)

### Step 2: Create Items Volume Analysis Component

**File:** `src/components/analytics/tabs/items-views/ItemVolumeAnalysisView.tsx`

**Props Interface:**
```typescript
interface ItemVolumeAnalysisViewProps {
  data: TopItemsAnalytics;
  bomCostComparison: BOMCostComparison[];
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}
```

**Key Sections:**
1. **Item Volume Detection**
   - Group items by `itemCode`
   - Find items that appear at multiple quantities
   - Build comparison data

2. **Scatter Plot** (Multi-item)
   - X-axis: Quantity
   - Y-axis: Quoted Rate
   - Each point = one item at one volume
   - Color by category
   - Tooltip shows item name, quantity, rate

3. **Vendor Discount Table**
   - Group by vendor
   - Calculate average discount %
   - Rank vendors by discount performance

4. **Item Details Table**
   - All items with volume scenarios
   - Show each volume, rate, % change
   - Filter by category, vendor

### Step 3: Update BOMTab to Show Volume Analysis

**File:** `src/components/analytics/tabs/BOMTab.tsx`

**Changes:**
```typescript
import BOMVolumeAnalysisView from './bom-views/BOMVolumeAnalysisView';

// Add volume-analysis to BOMViewType
export type BOMViewType = 'comparison' | 'additional-costs' | 'validation' | 'volume-analysis';

export default function BOMTab({ ... }) {
  // Detect if volume analysis should be shown
  const hasVolumeScenarios = useMemo(() => {
    const bomCodeCounts = new Map<string, number>();
    bomCostComparison.forEach(bom => {
      const count = bomCodeCounts.get(bom.bomCode) || 0;
      bomCodeCounts.set(bom.bomCode, count + 1);
    });
    return Array.from(bomCodeCounts.values()).some(count => count > 1);
  }, [bomCostComparison]);

  // Conditionally add volume analysis to views
  const views = [
    { id: 'comparison' as BOMViewType, label: 'BOM Comparison', icon: '📊' },
    { id: 'additional-costs' as BOMViewType, label: 'BOM Additional Costs', icon: '💰' },
    { id: 'validation' as BOMViewType, label: 'Cost Validation', icon: '✅' },
    ...(hasVolumeScenarios
      ? [{ id: 'volume-analysis' as BOMViewType, label: 'Volume Analysis', icon: '📈' }]
      : []
    )
  ];

  return (
    <div className="space-y-4">
      {/* ... existing view selector ... */}

      {/* Add volume analysis view */}
      {selectedView === 'volume-analysis' && hasVolumeScenarios && (
        <BOMVolumeAnalysisView
          bomCostComparison={bomCostComparison}
          data={data}
          totalQuoteValue={totalQuoteValue}
          navigateToTab={navigateToTab}
        />
      )}
    </div>
  );
}
```

### Step 4: Update ItemsTab to Show Volume Analysis

**File:** `src/components/analytics/tabs/ItemsTab.tsx`

**Changes:** (Similar to BOMTab)
```typescript
import ItemVolumeAnalysisView from './items-views/ItemVolumeAnalysisView';

// Add to ItemViewType
export type ItemViewType = 'cost' | 'vendor' | 'category' | 'rate' | 'additional-costs' | 'item-source' | 'volume-analysis' | 'custom';

// ... similar detection logic and conditional rendering
```

---

## Code Examples

### Example 1: Volume Scenario Detection

```typescript
interface VolumeScenario {
  bomCode: string;
  volumes: BOMCostComparison[];
  lowVolume: BOMCostComparison;
  highVolume: BOMCostComparison;
  perUnitCostLow: number;
  perUnitCostHigh: number;
  savingsPerUnit: number;
  savingsPercent: number;
}

function detectVolumeScenarios(
  bomCostComparison: BOMCostComparison[]
): VolumeScenario[] {
  // Group by BOM code
  const grouped = new Map<string, BOMCostComparison[]>();

  bomCostComparison.forEach(bom => {
    if (!grouped.has(bom.bomCode)) {
      grouped.set(bom.bomCode, []);
    }
    grouped.get(bom.bomCode)!.push(bom);
  });

  // Find scenarios with multiple volumes
  const scenarios: VolumeScenario[] = [];

  grouped.forEach((volumes, bomCode) => {
    if (volumes.length > 1) {
      // Sort by quantity (low to high)
      volumes.sort((a, b) => (a.bomQuantity || 0) - (b.bomQuantity || 0));

      const lowVolume = volumes[0];
      const highVolume = volumes[volumes.length - 1];

      const perUnitCostLow = lowVolume.bomTotalWithAC / (lowVolume.bomQuantity || 1);
      const perUnitCostHigh = highVolume.bomTotalWithAC / (highVolume.bomQuantity || 1);

      const savingsPerUnit = perUnitCostLow - perUnitCostHigh;
      const savingsPercent = (savingsPerUnit / perUnitCostLow) * 100;

      scenarios.push({
        bomCode,
        volumes,
        lowVolume,
        highVolume,
        perUnitCostLow,
        perUnitCostHigh,
        savingsPerUnit,
        savingsPercent
      });
    }
  });

  return scenarios;
}
```

### Example 2: Scatter Plot Chart Component

```typescript
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function VolumeScatterPlot({ scenarios }: { scenarios: VolumeScenario[] }) {
  // Prepare data for scatter plot
  const scatterData = scenarios.flatMap(scenario =>
    scenario.volumes.map(vol => ({
      bomCode: scenario.bomCode,
      quantity: vol.bomQuantity || 0,
      perUnitCost: vol.bomTotalWithAC / (vol.bomQuantity || 1),
      bomName: vol.bomName
    }))
  );

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          dataKey="quantity"
          name="Volume"
          label={{ value: 'Volume (units)', position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="perUnitCost"
          name="Per-Unit Cost"
          label={{ value: 'Per-Unit Cost ($)', angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
          formatter={(value: number, name: string) => {
            if (name === 'Per-Unit Cost') return [`$${value.toLocaleString()}`, 'Per-Unit Cost'];
            return [value, name];
          }}
        />
        <Scatter data={scatterData} fill="#3b82f6">
          {scatterData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[scenarios.findIndex(s => s.bomCode === entry.bomCode) % COLORS.length]}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
```

### Example 3: Item-Level Cost Changes

```typescript
interface ItemVolumeChange {
  itemCode: string;
  itemName: string;
  lowVolumeRate: number;
  highVolumeRate: number;
  changeAmount: number;
  changePercent: number;
  isDiscount: boolean;
}

function calculateItemChanges(
  data: TopItemsAnalytics,
  scenario: VolumeScenario
): ItemVolumeChange[] {
  const changes: ItemVolumeChange[] = [];

  // Get items for low volume BOM
  const lowVolumeItems = data.overall.filter(item =>
    item.bomPath.startsWith(scenario.bomCode) &&
    item.quantity === scenario.lowVolume.bomQuantity
  );

  // Get items for high volume BOM
  const highVolumeItems = data.overall.filter(item =>
    item.bomPath.startsWith(scenario.bomCode) &&
    item.quantity === scenario.highVolume.bomQuantity
  );

  // Match items by item code
  lowVolumeItems.forEach(lowItem => {
    const highItem = highVolumeItems.find(h => h.itemCode === lowItem.itemCode);

    if (highItem) {
      const changeAmount = lowItem.quotedRate - highItem.quotedRate;
      const changePercent = (changeAmount / lowItem.quotedRate) * 100;

      changes.push({
        itemCode: lowItem.itemCode,
        itemName: lowItem.itemName,
        lowVolumeRate: lowItem.quotedRate,
        highVolumeRate: highItem.quotedRate,
        changeAmount,
        changePercent,
        isDiscount: changeAmount > 0 // Positive = discount
      });
    }
  });

  // Sort by change percent (largest discounts first)
  changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return changes;
}
```

### Example 4: Item Changes Table Component

```typescript
function ItemChangesTable({ changes }: { changes: ItemVolumeChange[] }) {
  return (
    <Card className="border-gray-300 shadow-sm">
      <CardContent className="p-0">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
          <h4 className="font-semibold text-gray-900 text-sm">Item-Level Cost Changes</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-400">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Low Volume Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">High Volume Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Change ($)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Change (%)</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {changes.map((change, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                    {change.itemName}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900 border-r border-gray-200 text-xs">
                    ${change.lowVolumeRate.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900 border-r border-gray-200 text-xs">
                    ${change.highVolumeRate.toLocaleString()}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono border-r border-gray-200 text-xs font-semibold ${
                    change.isDiscount ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {change.isDiscount ? '-' : '+'}${Math.abs(change.changeAmount).toLocaleString()}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                    change.isDiscount ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {change.isDiscount ? '-' : '+'}{Math.abs(change.changePercent).toFixed(1)}%
                    {change.isDiscount ? ' ✓' : ' ✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Testing Scenarios

### Test Case 1: Volume Analysis Appears
**Given:** BOM D exists at 2 volumes (10 and 1000 units)
**When:** User navigates to BOM tab
**Then:** "Volume Analysis" button should appear in view selector

### Test Case 2: Volume Analysis Hidden
**Given:** No duplicate BOMs exist
**When:** User navigates to BOM tab
**Then:** "Volume Analysis" button should NOT appear

### Test Case 3: Scatter Plot Shows Correct Data
**Given:** BOM D at 10 units ($2150/unit) and 1000 units ($1978/unit)
**When:** User clicks Volume Analysis
**Then:**
- Scatter plot shows 2 points
- Point 1: (10, $2150)
- Point 2: (1000, $1978)
- Points are color-coded by BOM

### Test Case 4: Cost Reduction Calculated Correctly
**Given:** BOM D volumes
**When:** User views comparison table
**Then:**
- Per-unit savings: $172
- Savings percent: 8%
- Both values displayed correctly

### Test Case 5: Item Changes Sorted by Discount
**Given:** Multiple items with varying discounts
**When:** User views item changes table
**Then:** Items sorted with largest discount % first

### Test Case 6: Items Tab Volume Analysis
**Given:** Items exist at multiple volumes
**When:** User navigates to Items → Volume Analysis
**Then:**
- Tab appears
- Scatter plot shows all items across volumes
- Vendor discount table shows rankings

---

## Styling Guidelines

### Colors
- **Discounts/Savings:** Green (`text-green-600`, `bg-green-100`)
- **Price Increases:** Red (`text-red-600`, `bg-red-100`)
- **Neutral/Info:** Blue (`text-blue-600`, `bg-blue-100`)
- **Charts:** Use existing COLORS array from other views

### Icons
- Volume Analysis tab: 📈
- Discount indicator: ✓
- Price increase indicator: ✗

### Table Styling
- Match existing table styles from CostView.tsx
- Use `border-gray-300` for borders
- Use `hover:bg-gray-50` for row hovers
- Use `font-mono` for numbers

### Chart Styling
- Height: 300px for main charts
- Use `ResponsiveContainer` from Recharts
- Match tooltip styles from existing charts
- Add axis labels for clarity

---

## Questions to Ask if Unclear

1. Should we show volume analysis if only 2 volumes exist, or require 3+?
2. How to handle BOMs with >2 volumes (e.g., 10, 100, 1000)?
3. Should scatter plot be linear or logarithmic scale for X-axis?
4. Break-even analysis: show recommended volume for best per-unit cost?
5. Should we allow filtering by BOM code in volume analysis?

---

## File Checklist

- [ ] `src/components/analytics/tabs/bom-views/BOMVolumeAnalysisView.tsx` (create)
- [ ] `src/components/analytics/tabs/items-views/ItemVolumeAnalysisView.tsx` (create)
- [ ] `src/components/analytics/tabs/BOMTab.tsx` (update - add volume-analysis view)
- [ ] `src/components/analytics/tabs/ItemsTab.tsx` (update - add volume-analysis view)
- [ ] `src/types/quote.types.ts` (already updated - bomQuantity field added)
- [ ] `src/data/mockQuoteData.ts` (already updated - BOM D added)

---

## Estimated Time

- BOM Volume Analysis View: 2-3 hours
- Items Volume Analysis View: 2-3 hours
- Tab integration & testing: 1 hour
- **Total:** 5-7 hours for a junior engineer with guidance

---

## Additional Resources

- [Recharts Documentation](https://recharts.org/)
- [Recharts ScatterChart Examples](https://recharts.org/en-US/examples/SimpleScatterChart)
- Existing similar components to reference:
  - `src/components/analytics/tabs/bom-views/BOMComparisonView.tsx`
  - `src/components/analytics/tabs/items-views/CostView.tsx`

---

**Last Updated:** 2025-01-23
**Author:** Senior Developer
**For:** Junior Engineer Implementation
