// Quote Analytics Types

export interface TopItem {
  rank: number;
  itemCode: string;
  itemName: string;
  bomPath: string;
  quantity: number;
  unit: string;
  quotedRate: number;
  totalCost: number;
  percentOfQuote: number;
  vendor: string;
  category?: string;
}

export interface TopItemsInsights {
  top10Total: number;
  top10Percent: number;
  top3Total: number;
  top3Percent: number;
  dominantBom: string;
  itemsInBomA: number;
  mostExpensiveSingleItem: string;
  highestConcentration: string;
}

export interface TopItemsAnalytics {
  overall: TopItem[];
  insights: TopItemsInsights;
}

export interface Category {
  category: string;
  itemCount: number;
  totalCost: number;
  percentOfQuote: number;
}

export interface AdditionalCostBreakdownItem {
  costName: string;
  total: number;
  count: number;
}

export interface AdditionalCostsBreakdown {
  itemLevel: {
    total: number;
    percentOfQuote: number;
    breakdown: AdditionalCostBreakdownItem[];
  };
  bomLevel: {
    total: number;
    percentOfQuote: number;
    breakdown: Array<{
      bomCode: string;
      bomName: string;
      total: number;
      percentOfBom: number;
    }>;
  };
  overallLevel: {
    total: number;
    percentOfQuote: number;
    breakdown: Array<{
      costName: string;
      original: number;
      agreed: number;
    }>;
  };
  totalAdditionalCosts: number;
  percentOfBaseQuote: number;
}

export interface BOMCostComparison {
  bomCode: string;
  bomName: string;
  itemsSubtotal: number;
  bomAdditionalCosts: number;
  bomTotalWithAC: number;
  percentOfQuote: number;
}

export interface Vendor {
  vendorName: string;
  itemCount: number;
  totalValue: number;
  percentOfQuote: number;
}

export interface VendorRateDeviationItem {
  itemCode: string;
  vendorRate: number;
  baseRate: number;
  markup: number;
  markupAmount: number;
}

export interface VendorRateDeviation {
  averageMarkup: number;
  items: VendorRateDeviationItem[];
  highestMarkupItem: {
    itemCode: string;
    markup: number;
  };
  lowestMarkupItem: {
    itemCode: string;
    markup: number;
  };
  itemsAbove20Percent: number;
  itemsBelow10Percent: number;
}

export interface CreationToSubmission {
  quoteCreated: string;
  lastSectionSubmitted: string;
  totalDays: number;
  workingDays: number;
  totalHours: number;
  sectionsCompleted: number;
  sectionsPending: number;
}

export interface ProjectToQuote {
  projectCreated: string;
  quoteCreated: string;
  lagDays: number;
  lagHours: number;
}

export interface SectionTimelineItem {
  sectionName: string;
  assignedUser: string;
  startTime: string;
  submitTime: string | null;
  duration: number;
  status: string;
}

export interface AdditionalCostsLevelComparison {
  overallAC: {
    total: number;
    percentOfQuote: number;
    items: Array<{
      name: string;
      value: number;
    }>;
  };
  bomAC: {
    total: number;
    percentOfQuote: number;
    items: Array<{
      bomCode: string;
      name: string;
      value: number;
    }>;
  };
  itemAC: {
    total: number;
    percentOfQuote: number;
  };
  comparison: {
    itemACIsLargest: boolean;
    ratio: string;
  };
}

export interface AnalyticsData {
  topItemsByCost: TopItemsAnalytics;
  topCategories: Category[];
  additionalCostsBreakdown: AdditionalCostsBreakdown;
  bomCostComparison: BOMCostComparison[];
  topVendors: Vendor[];
  vendorRateDeviation: VendorRateDeviation;
  creationToSubmission: CreationToSubmission;
  projectToQuote: ProjectToQuote;
  sectionTimeline: SectionTimelineItem[];
  additionalCostsLevelComparison: AdditionalCostsLevelComparison;
}
