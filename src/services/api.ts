// API Base URL - defaults to production, can be overridden
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-dev.factwise.io/api';

// Types
export interface QuoteAnalyticsHeaderData {
    quote_overview: {
        quote_id: string;
        quote_name: string;
    };
    entity_info: {
        seller_entity_id: string;
        seller_entity_name: string;
    };
    creator_info: {
        user_id: string;
        user_name: string;
    };
    status_info: {
        status: string;
        status_display: string;
    };
    currency_info: {
        currency_code: string;
        currency_name: string;
        currency_symbol: string;
    };
    customer_info: {
        customer_entity_id: string | null;
        customer_entity_name: string | null;
    };
    project_info: {
        project_id: string | null;
        project_name: string | null;
    };
    items_summary: {
        total_items_count: number;
    };
    bom_summary: {
        total_boms: number;
        bom_list: Array<{
            bom_id: string;
            bom_code: string;
            bom_name: string;
        }>;
    };
    financial_summary: {
        currency_symbol: string;
        total_quote_value: number;
    };
}

export interface AdditionalCost {
    cost_name: string;
    cost_type: 'PERCENTAGE' | 'ABSOLUTE_VALUE';
    allocation_type: 'PER_UNIT' | 'OVERALL_QUANTITY' | null;
    cost_source: 'DEFAULT' | 'FORMULA';
    total_amount: number;
    per_unit_amount: number;
}

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
    base_rate: number;
    additional_costs: AdditionalCost[];
    total_additional_cost: number;
    additional_cost_per_unit: number;
    quoted_rate: number;
    total_item_cost: number;
    total_amount: number;
    percent_of_quote: number;
    item_source: 'PROJECT' | 'EVENT' | 'QUOTE';
}

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

export interface BOMAdditionalCostItem {
    cost_name: string;
    cost_type: string;
    cost_total: number;
    cost_per_unit: number;
}

export interface BOMAdditionalCost {
    bom_code: string;
    bom_path: string;
    total_ac: number;
    costs: BOMAdditionalCostItem[];
}

export interface OverallAdditionalCost {
    cost_name: string;
    cost_type: string;
    cost_total: number;
    cost_per_unit: number;
}

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

export interface CostViewData {
    items: CostViewItem[];
    summary: CostViewSummary;
    bom_additional_costs: Record<string, BOMAdditionalCost>;
    overall_additional_costs: OverallAdditionalCost[];
    filters: CostViewFilters;
}

// API Functions
export const fetchQuoteAnalyticsHeader = async (
    costingSheetId: string,
    token: string
): Promise<{ success: boolean; data: QuoteAnalyticsHeaderData }> => {
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

    return data;
};

export const fetchCostViewData = async (
    costingSheetId: string,
    token: string
): Promise<{ success: boolean; data: CostViewData }> => {
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

    return data;
};
