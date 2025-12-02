// API Base URL
const API_BASE_URL = 'http://localhost:8000';

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
    event_ids: string[];
    last_export_datetime: string;
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
  cost_source: 'DEFAULT' | 'FORMULA';
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

// Explicit type exports for better module resolution
export type {
  CostViewData,
  CostViewItem,
  CostViewSummary,
  CostViewFilters,
  AdditionalCost,
  BOMAdditionalCost,
  OverallAdditionalCost,
  QuoteAnalyticsHeaderData
};
