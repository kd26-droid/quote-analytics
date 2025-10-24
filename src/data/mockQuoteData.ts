import type { AnalyticsData } from '../types/quote.types';

export const analyticsData: AnalyticsData = {
  // Analytics #1: Top 10 Items by Cost
  topItemsByCost: {
    overall: [
      { rank: 1, itemCode: "MOTOR-5HP-001", itemName: "5HP Industrial Motor - Premium Grade", bomPath: "A.1.1", quantity: 8, unit: "PCS", quotedRate: 2625, totalCost: 21000, percentOfQuote: 4.0, vendor: "Motor Supply Corp", category: "Motors & Drives" },
      { rank: 2, itemCode: "STEEL-304-SHEET", itemName: "Stainless Steel Sheet 304 Grade", bomPath: "A.2", quantity: 120, unit: "KG", quotedRate: 157.5, totalCost: 18900, percentOfQuote: 3.6, vendor: "Steel & Metals Co", category: "Raw Materials" },
      { rank: 3, itemCode: "PUMP-CENT-3HP", itemName: "Centrifugal Pump 3HP", bomPath: "B", quantity: 6, unit: "PCS", quotedRate: 2940, totalCost: 17640, percentOfQuote: 3.3, vendor: "Fluid Tech Solutions", category: "Pumps & Valves" },
      { rank: 4, itemCode: "VALVE-BALL-50MM", itemName: "Ball Valve 50mm Stainless Steel", bomPath: "A.1.2", quantity: 24, unit: "PCS", quotedRate: 714, totalCost: 17136, percentOfQuote: 3.2, vendor: "Valve World Inc", category: "Pumps & Valves" },
      { rank: 5, itemCode: "BEARING-SKF-6308", itemName: "SKF Deep Groove Ball Bearing 6308", bomPath: "A.1.1", quantity: 48, unit: "PCS", quotedRate: 346.5, totalCost: 16632, percentOfQuote: 3.1, vendor: "Bearing Supply Direct", category: "Bearings & Seals" },
      { rank: 6, itemCode: "GEARBOX-REDUC-40:1", itemName: "Worm Gearbox Reducer 40:1 Ratio", bomPath: "A.1", quantity: 6, unit: "PCS", quotedRate: 2310, totalCost: 13860, percentOfQuote: 2.6, vendor: "Power Transmission Ltd", category: "Motors & Drives" },
      { rank: 7, itemCode: "SHAFT-DRIVE-50MM", itemName: "Drive Shaft 50mm Hardened Steel", bomPath: "A.2", quantity: 12, unit: "PCS", quotedRate: 1050, totalCost: 12600, percentOfQuote: 2.4, vendor: "Steel & Metals Co", category: "Mechanical Components" },
      { rank: 8, itemCode: "COUPLING-FLEX-75MM", itemName: "Flexible Coupling 75mm Bore", bomPath: "A.1.1", quantity: 12, unit: "PCS", quotedRate: 997.5, totalCost: 11970, percentOfQuote: 2.3, vendor: "Power Transmission Ltd", category: "Mechanical Components" },
      { rank: 9, itemCode: "SEAL-KIT-PUMP", itemName: "Mechanical Seal Kit for Centrifugal Pump", bomPath: "B", quantity: 12, unit: "SET", quotedRate: 892.5, totalCost: 10710, percentOfQuote: 2.0, vendor: "Seal Solutions Inc", category: "Bearings & Seals" },
      { rank: 10, itemCode: "MOTOR-3HP-001", itemName: "3HP Industrial Motor - Standard", bomPath: "B", quantity: 4, unit: "PCS", quotedRate: 1995, totalCost: 7980, percentOfQuote: 1.5, vendor: "Motor Supply Corp", category: "Motors & Drives" },
      // Additional items including BOM C items
      { rank: 11, itemCode: "PAINT-INDUSTRIAL-5L", itemName: "Industrial Grade Paint - Grey 5L", bomPath: "C", quantity: 20, unit: "L", quotedRate: 180, totalCost: 3600, percentOfQuote: 0.7, vendor: "Industrial Chemicals Co", category: "Consumables" },
      { rank: 12, itemCode: "PACKAGING-CRATE", itemName: "Heavy Duty Wooden Crate", bomPath: "C", quantity: 8, unit: "PCS", quotedRate: 450, totalCost: 3600, percentOfQuote: 0.7, vendor: "Packaging Solutions Ltd", category: "Consumables" },
      { rank: 13, itemCode: "FOAM-PADDING", itemName: "Protective Foam Padding", bomPath: "C", quantity: 50, unit: "SQ.M", quotedRate: 85, totalCost: 4250, percentOfQuote: 0.8, vendor: "Packaging Solutions Ltd", category: "Consumables" },
      { rank: 14, itemCode: "LABEL-SHIPPING", itemName: "Shipping Labels & Documentation Kit", bomPath: "C", quantity: 10, unit: "KIT", quotedRate: 120, totalCost: 1200, percentOfQuote: 0.2, vendor: "Office Supplies Co", category: "Consumables" },
      { rank: 15, itemCode: "WRAP-SHRINK", itemName: "Industrial Shrink Wrap Roll", bomPath: "C", quantity: 15, unit: "ROLL", quotedRate: 95, totalCost: 1425, percentOfQuote: 0.3, vendor: "Packaging Solutions Ltd", category: "Consumables" },

      // BOM D - Low Volume (10 units) - for Volume Analysis
      { rank: 16, itemCode: "CTRL-PANEL-001", itemName: "Industrial Control Panel", bomPath: "D", quantity: 10, unit: "PCS", quotedRate: 1500, totalCost: 15000, percentOfQuote: 2.8, vendor: "Electronics Corp", category: "Electronics" },
      { rank: 17, itemCode: "SENSOR-TEMP-001", itemName: "Temperature Sensor Module", bomPath: "D.1", quantity: 10, unit: "PCS", quotedRate: 200, totalCost: 2000, percentOfQuote: 0.4, vendor: "Sensor Tech Inc", category: "Electronics" },
      { rank: 18, itemCode: "RELAY-MODULE", itemName: "Power Relay Module", bomPath: "D.1", quantity: 10, unit: "PCS", quotedRate: 150, totalCost: 1500, percentOfQuote: 0.3, vendor: "Electronics Corp", category: "Electronics" },
      { rank: 19, itemCode: "CABLE-ASSEMBLY", itemName: "Wiring Cable Assembly", bomPath: "D.2", quantity: 10, unit: "SET", quotedRate: 300, totalCost: 3000, percentOfQuote: 0.6, vendor: "Cable Solutions", category: "Electronics" },

      // BOM D - High Volume (1000 units) - for Volume Analysis
      { rank: 20, itemCode: "CTRL-PANEL-001", itemName: "Industrial Control Panel", bomPath: "D", quantity: 1000, unit: "PCS", quotedRate: 1380, totalCost: 1380000, percentOfQuote: 260.0, vendor: "Electronics Corp", category: "Electronics" },
      { rank: 21, itemCode: "SENSOR-TEMP-001", itemName: "Temperature Sensor Module", bomPath: "D.1", quantity: 1000, unit: "PCS", quotedRate: 175, totalCost: 175000, percentOfQuote: 33.0, vendor: "Sensor Tech Inc", category: "Electronics" },
      { rank: 22, itemCode: "RELAY-MODULE", itemName: "Power Relay Module", bomPath: "D.1", quantity: 1000, unit: "PCS", quotedRate: 138, totalCost: 138000, percentOfQuote: 26.0, vendor: "Electronics Corp", category: "Electronics" },
      { rank: 23, itemCode: "CABLE-ASSEMBLY", itemName: "Wiring Cable Assembly", bomPath: "D.2", quantity: 1000, unit: "SET", quotedRate: 285, totalCost: 285000, percentOfQuote: 54.0, vendor: "Cable Solutions", category: "Electronics" }
    ],
    insights: {
      top10Total: 148428,
      top10Percent: 28.0,
      top3Total: 57540,
      top3Percent: 10.9,
      dominantBom: "A",
      itemsInBomA: 7,
      mostExpensiveSingleItem: "MOTOR-5HP-001",
      highestConcentration: "A.1.1 (4 items in top 10)"
    }
  },

  // Analytics #2: Top Item Categories
  topCategories: [
    { category: "Motors & Drives", itemCount: 15, totalCost: 185000, percentOfQuote: 35.0 },
    { category: "Raw Materials", itemCount: 8, totalCost: 125000, percentOfQuote: 23.7 },
    { category: "Pumps & Valves", itemCount: 12, totalCost: 95000, percentOfQuote: 18.0 },
    { category: "Bearings & Seals", itemCount: 18, totalCost: 52000, percentOfQuote: 9.8 },
    { category: "Mechanical Components", itemCount: 10, totalCost: 38000, percentOfQuote: 7.2 },
    { category: "Hardware", itemCount: 25, totalCost: 18000, percentOfQuote: 3.4 },
    { category: "Consumables", itemCount: 12, totalCost: 15000, percentOfQuote: 2.8 }
  ],

  // Analytics #3: Additional Costs Breakdown
  additionalCostsBreakdown: {
    itemLevel: {
      total: 52000,
      percentOfQuote: 9.8,
      breakdown: [
        { costName: "Special Coating", total: 15000, count: 8 },
        { costName: "Testing & Certification", total: 12000, count: 24 },
        { costName: "Installation Kits", total: 8500, count: 6 },
        { costName: "Premium Materials", total: 7800, count: 12 },
        { costName: "Other", total: 8700, count: 30 }
      ]
    },
    bomLevel: {
      total: 27000,
      percentOfQuote: 5.1,
      breakdown: [
        { bomCode: "A", bomName: "Main Assembly", total: 19000, percentOfBom: 6.1 },
        { bomCode: "B", bomName: "Secondary Assembly", total: 6500, percentOfBom: 5.8 },
        { bomCode: "C", bomName: "Finishing & Packaging", total: 1500, percentOfBom: 8.5 }
      ]
    },
    overallLevel: {
      total: 10500,
      percentOfQuote: 2.0,
      breakdown: [
        { costName: "Freight & Shipping", original: 8000, agreed: 7500 },
        { costName: "Insurance", original: 7680, agreed: 7680 },
        { costName: "Handling & Documentation", original: 2000, agreed: 2000 }
      ]
    },
    totalAdditionalCosts: 89500,
    percentOfBaseQuote: 18.4
  },

  // Analytics #4: Base Cost vs Final Cost by BOM
  bomCostComparison: [
    {
      bomCode: "A",
      bomName: "Main Assembly",
      itemsSubtotal: 345000,
      bomAdditionalCosts: 19000,
      bomTotalWithAC: 364000,
      percentOfQuote: 68.9
    },
    {
      bomCode: "B",
      bomName: "Secondary Assembly",
      itemsSubtotal: 112000,
      bomAdditionalCosts: 6500,
      bomTotalWithAC: 118500,
      percentOfQuote: 22.4
    },
    {
      bomCode: "C",
      bomName: "Finishing & Packaging",
      itemsSubtotal: 28000,
      bomAdditionalCosts: 4000,
      bomTotalWithAC: 32000,
      percentOfQuote: 6.1
    },
    {
      bomCode: "D",
      bomName: "Control System - Low Volume (10 units)",
      itemsSubtotal: 21500,
      bomAdditionalCosts: 1500,
      bomTotalWithAC: 23000,
      percentOfQuote: 4.3,
      bomQuantity: 10
    },
    {
      bomCode: "D",
      bomName: "Control System - High Volume (1000 units)",
      itemsSubtotal: 1978000,
      bomAdditionalCosts: 120000,
      bomTotalWithAC: 2098000,
      percentOfQuote: 396.0,
      bomQuantity: 1000
    }
  ],

  // Analytics #5: Top Vendors
  topVendors: [
    { vendorName: "Motor Supply Corp", itemCount: 12, totalValue: 145000, percentOfQuote: 27.4 },
    { vendorName: "Steel & Metals Co", itemCount: 18, totalValue: 98000, percentOfQuote: 18.5 },
    { vendorName: "Fluid Tech Solutions", itemCount: 8, totalValue: 52000, percentOfQuote: 9.8 },
    { vendorName: "Power Transmission Ltd", itemCount: 10, totalValue: 48000, percentOfQuote: 9.1 },
    { vendorName: "Valve World Inc", itemCount: 15, totalValue: 42000, percentOfQuote: 7.9 }
  ],

  // Analytics #6: Deviation from Vendor Rate
  vendorRateDeviation: {
    averageMarkup: 18.5,
    items: [
      { itemCode: "MOTOR-5HP-001", vendorRate: 2200, baseRate: 2500, markup: 13.6, markupAmount: 300 },
      { itemCode: "STEEL-304-SHEET", vendorRate: 125, baseRate: 150, markup: 20.0, markupAmount: 25 },
      { itemCode: "PUMP-CENT-3HP", vendorRate: 2400, baseRate: 2800, markup: 16.7, markupAmount: 400 }
    ],
    highestMarkupItem: { itemCode: "GEARBOX-REDUC-40:1", markup: 18.9 },
    lowestMarkupItem: { itemCode: "MOTOR-5HP-001", markup: 13.6 },
    itemsAbove20Percent: 15,
    itemsBelow10Percent: 3
  },

  // Analytics #7: Time from Creation to Submission
  creationToSubmission: {
    quoteCreated: "2024-10-01T08:00:00Z",
    lastSectionSubmitted: "2024-10-14T17:00:00Z",
    totalDays: 13,
    workingDays: 10,
    totalHours: 78.5,
    sectionsCompleted: 3,
    sectionsPending: 1
  },

  // Analytics #8: Time from Project to Quote Creation
  projectToQuote: {
    projectCreated: "2024-09-28T10:00:00Z",
    quoteCreated: "2024-10-01T08:00:00Z",
    lagDays: 3,
    lagHours: 70
  },

  // Analytics #9: Time per Section per User
  sectionTimeline: [
    {
      sectionName: "Quote Details",
      assignedUser: "John Doe",
      startTime: "2024-10-01T09:00:00Z",
      submitTime: "2024-10-01T11:30:00Z",
      duration: 2.5,
      status: "SUBMITTED"
    },
    {
      sectionName: "Essential Terms",
      assignedUser: "Jane Smith",
      startTime: "2024-10-01T14:00:00Z",
      submitTime: "2024-10-08T18:00:00Z",
      duration: 40,
      status: "SUBMITTED"
    },
    {
      sectionName: "BOM Additional Costs",
      assignedUser: "Bob Johnson",
      startTime: "2024-10-09T09:00:00Z",
      submitTime: "2024-10-14T17:00:00Z",
      duration: 32,
      status: "SUBMITTED"
    },
    {
      sectionName: "Overall Additional Costs",
      assignedUser: "Bob Johnson",
      startTime: "2024-10-15T09:00:00Z",
      submitTime: null,
      duration: 4,
      status: "DRAFT"
    }
  ],

  // Analytics #10: Overall vs BOM Additional Costs
  additionalCostsLevelComparison: {
    overallAC: {
      total: 10500,
      percentOfQuote: 2.0,
      items: [
        { name: "Freight & Shipping", value: 7500 },
        { name: "Insurance", value: 7680 },
        { name: "Handling", value: 2000 }
      ]
    },
    bomAC: {
      total: 27000,
      percentOfQuote: 5.1,
      items: [
        { bomCode: "A", name: "Main Assembly", value: 19000 },
        { bomCode: "B", name: "Secondary Assembly", value: 6500 },
        { bomCode: "C", name: "Finishing & Packaging", value: 4000 }
      ]
    },
    itemAC: {
      total: 52000,
      percentOfQuote: 9.8
    },
    comparison: {
      itemACIsLargest: true,
      ratio: "Item AC : BOM AC : Overall AC = 5.0 : 2.6 : 1.0"
    }
  }
};
