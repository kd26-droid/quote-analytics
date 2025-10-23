# Quote Analytics Dashboard - Top 10 Items by Cost

This is the first analytics component for the Quote Analytics Dashboard project.

## 🎯 What's Built

**Analytics #1: Top 10 Items by Cost**

A comprehensive chart showing the most expensive items in a quote with:

- ✅ **BOM Hierarchical Filtering** - Drill down from "All BOMs" → "BOM A" → "BOM A.1" → "BOM A.1.1"
- ✅ **Display Mode Toggle** - Switch between Total Cost and Per-Unit Rate views
- ✅ **Interactive Bar Chart** - Horizontal bars with color coding for easy comparison
- ✅ **Rich Tooltips** - Hover to see item details (code, BOM, quantity, rate, vendor)
- ✅ **Data Table** - Detailed table view with medals for top 3 items
- ✅ **Smart Insights** - Auto-calculated insights that change based on selected BOM filter

## 🚀 Features

### BOM Filter Hierarchy

The filter dropdown shows:
```
All BOMs
BOM A
  └─ BOM A.1
    └─ BOM A.1.1
    └─ BOM A.1.2
  └─ BOM A.2
BOM B
BOM C
```

**How it helps users:**
- See all items across the quote (All BOMs)
- Focus on a main assembly (BOM A includes A.1, A.1.1, A.1.2, A.2, etc.)
- Drill into specific sub-assembly (BOM A.1.1 only)

### Total Cost vs Per-Unit Rate

**Total Cost View:**
- Shows: `quotedRate × quantity`
- Useful for: Identifying biggest contributors to quote total
- Example: 100 KG × $157.5/KG = $18,900 total

**Per-Unit Rate View:**
- Shows: `quotedRate` (per unit)
- Useful for: Finding items with high unit prices (may indicate quality or complexity)
- Example: $2,625/PCS (expensive individual item)

### Dynamic Insights

Insights change based on selected filter:

**When "All BOMs" selected:**
- Top 10 items = $X (Y% of quote)
- Top 3 items = $A (B% of quote)
- Most expensive item: [item code]
- Highest concentration: BOM A.1.1 (4 items in top 10)

**When specific BOM selected (e.g., "BOM A.1"):**
- 5 items in this BOM = $75,000 (14.2% of quote)
- Top 3 in this BOM = $45,000 (8.5% of quote)
- Most expensive: 5HP Industrial Motor ($21,000)

## 🏗️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Recharts** - Chart library
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

## 📦 Installation & Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── card.tsx
│   │   └── badge.tsx
│   └── analytics/
│       └── charts/
│           └── TopItemsChart.tsx    # Main chart component
├── data/
│   └── mockQuoteData.ts             # Mock analytics data
├── types/
│   └── quote.types.ts               # TypeScript interfaces
├── lib/
│   └── utils.ts                     # Utility functions
└── App.tsx                          # Main app component
```

## 🎨 Component Features

### TopItemsChart Component

**Props:**
```typescript
interface TopItemsChartProps {
  data: TopItemsAnalytics;
}
```

**State:**
- `selectedBOM` - Currently selected BOM filter
- `displayMode` - 'total' | 'perUnit'

**Computed Values:**
- `filteredItems` - Items filtered by selected BOM
- `filteredInsights` - Recalculated insights for filtered data
- `chartData` - Chart data based on display mode

## 📊 Data Model

```typescript
interface TopItem {
  rank: number;
  itemCode: string;
  itemName: string;
  bomPath: string;          // e.g., "A.1.1"
  quantity: number;
  unit: string;             // e.g., "PCS", "KG"
  quotedRate: number;       // Per-unit rate
  totalCost: number;        // quotedRate × quantity
  percentOfQuote: number;
  vendor: string;
}
```

## 🎯 User Benefits

1. **Quick Identification** - See top 10 costliest items instantly
2. **Cost Concentration** - Understand which BOM/sub-BOM is expensive
3. **Negotiation Focus** - Prioritize vendor negotiations on high-impact items
4. **Unit vs Total** - Distinguish between "expensive because of quantity" vs "expensive per unit"
5. **Visual Clarity** - Bar chart makes cost comparison intuitive

## 🔮 Next Steps

This is Analytics #1 of 10 planned analytics. Next to build:

2. Top Item Categories (Pie Chart)
3. Additional Costs Breakdown
4. BOM Cost Comparison
5. Top Vendors
6. Vendor Rate Deviation
7. Time to Submission
8. Project to Quote Time
9. Section Timeline
10. AC Level Comparison

## 📝 Notes

- Uses dummy data from `QUOTE_ANALYTICS_DUMMY_DATA.md`
- BOM hierarchy auto-generated from item `bomPath` fields
- Responsive design (works on desktop, tablet, mobile)
- Color-coded bars for visual distinction
- Medal badges (🥇🥈🥉) for top 3 items

## 🐛 Known Limitations

- No actual API integration (using mock data)
- No drill-down click interactions (chart is view-only)
- No export functionality yet
- No comparison with historical quotes

---

**Built with ❤️ using React + TypeScript + Recharts**
