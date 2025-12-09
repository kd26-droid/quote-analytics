// API Base URL - uses env variable in production, localhost for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Header API Types
export interface QuoteAnalyticsHeaderData {
  quote_overview: {
    quote_id: string;
    quote_name: string;
    quote_title: string;
    quote_description: string;
    custom_costing_sheet_id: string;
  };
  entity_info: {
    seller_entity_id: string;
    seller_entity_name: string;
  };
  creator_info: {
    user_id: string;
    user_name: string;
    created_datetime: string;
  };
  status_info: {
    status: string;
    status_display: string;
    modified_datetime: string;
    modified_by_name: string;
    version: number;
  };
  currency_info: {
    currency_code: string;
    currency_name: string;
    currency_symbol: string;
    decimals: number;
  };
  customer_info: {
    customer_entity_id: string | null;
    customer_entity_name: string | null;
    customer_contact_ids: string[];
  };
  project_info: {
    project_id: string | null;
    project_code: string | null;
    project_name: string | null;
  };
  items_summary: {
    total_items_count: number;
    unique_items_count: number;
    total_quantity: number;
  };
  bom_summary: {
    total_boms_count: number;
    bom_list: Array<{
      bom_id: string;
      bom_code: string;
      bom_name: string;
      item_count: number;
      total_value: number;
    }>;
    bom_codes_display: string;
  };
  financial_summary: {
    currency_symbol: string;
    total_quote_value: number;
    agreed_total_value: number;
    subtotal_items: number;
    total_additional_costs: number;
  };
  dates_info: {
    created_datetime: string;
    modified_datetime: string;
    validity_datetime: string | null;
    deadline_datetime: string | null;
  };
  exported_events: {
    events: Array<{
      event_id: string;
      event_code: string;
      event_name: string;
    }>;
    last_export_datetime: string | null;
  };
}

// Cost View Summary Types
export interface CostViewSummary {
  total_costing_sheet_items: number;
  total_unique_items: number;
  total_vendors: number;
  total_rows: number;
  sum_item_totals: number;
  total_bom_ac: number;
  total_overall_ac: number;
  grand_total: number;
}

// Additional Cost (Item Level)
export interface AdditionalCost {
  cost_name: string;
  cost_type: 'ABSOLUTE_VALUE' | 'PERCENTAGE';
  allocation_type: 'PER_UNIT' | 'OVERALL_QUANTITY' | null;
  cost_source: 'FORMULA' | 'DEFAULT' | 'ITEM' | 'VENDOR';
  total_amount: number;
  per_unit_amount: number;
}

// Cost View Item
export interface CostViewItem {
  item_id: string;
  item_code: string;
  item_name: string;
  tags: string[];
  vendor_id: string | null;
  vendor_name: string | null;
  bom_path: string;
  bom_id: string | null;
  bom_code: string;
  bom_name: string;
  bom_instance_id: string;    // NEW: Unique ID of the BOM instance (links to BOMInstance.main_bom.entry_id)
  bom_instance_qty: number;   // NEW: The quantity of the BOM instance (e.g., 10 or 1000)
  quantity: number;
  unit: string;
  vendor_rate: number;        // Original rate from vendor bid (in vendor's currency)
  vendor_currency: string;    // Currency of vendor_rate (e.g., "USD", "INR")
  base_rate: number;          // Rate converted to costing sheet currency
  additional_costs: AdditionalCost[];
  total_additional_cost: number;
  additional_cost_per_unit: number;
  quoted_rate: number;        // base_rate + AC per unit (final landed rate)
  total_item_cost: number;
  total_amount: number;
  percent_of_quote: number;
  item_source: 'PROJECT' | 'EVENT' | 'QUOTE';
}

// BOM Additional Cost
export interface BOMAdditionalCost {
  bom_code: string;
  bom_path: string;
  total_ac: number;
  costs: Array<{
    cost_name: string;
    cost_type: string;
    cost_total: number;
    cost_per_unit: number;
  }>;
}

// Overall Additional Cost
export interface OverallAdditionalCost {
  cost_name: string;
  cost_type: string;
  cost_total: number;
  cost_per_unit: number;
}

// Cost View Filters
export interface CostViewFilters {
  bom_list: Array<{
    bom_id: string;
    bom_code: string;
    bom_name: string;
    bom_path: string;
  }>;
  vendor_list: Array<{
    vendor_id: string;
    vendor_name: string;
  }>;
  tag_list: string[];
}

// Complete Cost View Data
export interface CostViewData {
  items: CostViewItem[];
  summary: CostViewSummary;
  bom_additional_costs: Record<string, BOMAdditionalCost>;
  overall_additional_costs: OverallAdditionalCost[];
  filters: CostViewFilters;
}

// ============ BOM Detail API Types ============

// Recurring Cost (BOM level additional cost)
export interface RecurringCost {
  cost_name: string;
  cost_type: 'ABSOLUTE_VALUE' | 'PERCENTAGE' | 'TOTAL';
  allocation_type: 'PER_UNIT' | 'OVERALL_QUANTITY' | null;
  cost_source: 'FORMULA' | 'DEFAULT' | 'ITEM' | 'VENDOR' | null;
  is_calculated: boolean;  // false = subtotal/gross row (exclude from totals)
  is_agreed_manual: boolean;  // true = manually overridden
  formula: string | null;
  calculated_rate: number;
  calculated_rate_per_unit: number;
  calculated_amount: number;
  quoted_rate: number;
  quoted_rate_per_unit: number;
  quoted_amount: number;
}

// BOM Level (in hierarchy)
export interface BOMLevel {
  bom_code: string;
  bom_name: string;
  bom_path: string;
  bom_level: number;  // 0 = main, 1 = sub, 2 = sub-sub
  bom_quantity: number;
  parent_bom_code: string | null;
  total_costs: number;  // Count of recurring costs
  total_item_cost: number;  // Sum of item costs in this BOM
  total_bom_ac_calculated: number;  // Sum of calculated_amount where is_calculated=true
  total_bom_ac_quoted: number;  // Sum of quoted_amount where is_calculated=true
  total_calculated_amount: number;  // total_item_cost + total_bom_ac_calculated
  total_quoted_amount: number;  // total_item_cost + total_bom_ac_quoted
  recurring_costs: RecurringCost[];
}

// BOM Instance
export interface BOMInstance {
  instance_index: number;
  main_bom: {
    bom_code: string;
    bom_name: string;
    bom_quantity: number;
    entry_id: string;
  };
  total_calculated_amount: number;
  total_quoted_amount: number;
  hierarchy: BOMLevel[];
}

// BOM Detail Summary
export interface BOMDetailSummary {
  total_instances: number;
  total_calculated_amount: number;
  total_quoted_amount: number;
}

// Complete BOM Detail Data
export interface BOMDetailData {
  bom_instances: BOMInstance[];
  summary: BOMDetailSummary;
}

// Fetch Header Data
export const fetchQuoteAnalyticsHeader = async (
  costingSheetId: string,
  token: string
): Promise<QuoteAnalyticsHeaderData> => {
  const response = await fetch(
    `${API_BASE_URL}/quotes/${costingSheetId}/analytics/header/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch header data');
  }

  return data.data;
};

// Fetch Cost View Data (for summary/totals)
export const fetchCostViewData = async (
  costingSheetId: string,
  token: string
): Promise<CostViewData> => {
  const response = await fetch(
    `${API_BASE_URL}/quotes/${costingSheetId}/analytics/items/cost-view/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch cost view data');
  }

  return data.data;
};

// Fetch BOM Detail Data
export const fetchBOMDetailData = async (
  costingSheetId: string,
  token: string
): Promise<BOMDetailData> => {
  const response = await fetch(
    `${API_BASE_URL}/quotes/${costingSheetId}/analytics/bom-detail/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch BOM detail data');
  }

  return data.data;
};

// ============ Overall Additional Costs API Types ============

// Individual Overall AC Cost
export interface OverallACCost {
  cost_name: string;
  cost_type: 'PERCENTAGE' | 'ABSOLUTE_VALUE';
  cost_type_display: string;  // "Percentage" or "Flat Rate"
  cost_value: number;
  allocation_type: string | null;
  cost_source: 'FORMULA' | 'DEFAULT' | 'ITEM' | 'VENDOR';
  is_calculated: boolean;  // true = included in total, false = display only
  is_agreed_manual: boolean;
  calculated_rate: number;
  calculated_amount: number;
  quoted_rate: number;
  quoted_amount: number;
  calculation_formula: string;  // Human readable formula
}

// Overall AC Base Amounts
export interface OverallACBaseAmounts {
  sum_item_totals: number;
  sum_item_totals_description: string;
  total_bom_ac: number;
  total_bom_ac_description: string;
  base_amount_for_percentage: number;
  base_amount_description: string;
}

// Overall AC Costs Section
export interface OverallACCostsSection {
  description: string;
  total_calculated?: number;
  total_quoted?: number;
  costs: OverallACCost[];
}

// Overall AC All Costs
export interface OverallACAllCosts {
  total_costs: number;
  included_count: number;
  display_only_count: number;
  included_in_total: OverallACCostsSection;
  display_only: OverallACCostsSection;
}

// Grand Total
export interface OverallACGrandTotal {
  calculated: number;
  quoted: number;
  formula: string;
  formula_values_calculated: string;
  formula_values_quoted: string;
}

// Cost Type Reference
export interface CostTypeReference {
  description: string;
  formula: string;
  example: string;
}

// Complete Overall AC Data
export interface OverallACData {
  quote_id: string;
  quote_name: string;
  base_amounts: OverallACBaseAmounts;
  overall_additional_costs: OverallACAllCosts;
  grand_total: OverallACGrandTotal;
  cost_type_reference: {
    PERCENTAGE: CostTypeReference;
    ABSOLUTE_VALUE: CostTypeReference;
  };
}

// Fetch Overall AC Data
export const fetchOverallACData = async (
  costingSheetId: string,
  token: string
): Promise<OverallACData> => {
  const response = await fetch(
    `${API_BASE_URL}/quotes/${costingSheetId}/analytics/overall-ac/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch overall AC data');
  }

  return data.data;
};

// Explicit type exports for better module resolution
export type {
  CostViewData,
  CostViewItem,
  CostViewSummary,
  CostViewFilters,
  AdditionalCost,
  BOMAdditionalCost,
  OverallAdditionalCost,
  QuoteAnalyticsHeaderData,
  BOMDetailData,
  BOMInstance,
  BOMLevel,
  BOMDetailSummary,
  RecurringCost,
  OverallACData,
  OverallACCost,
  OverallACBaseAmounts,
  OverallACAllCosts,
  OverallACCostsSection,
  OverallACGrandTotal,
  CostTypeReference
};
