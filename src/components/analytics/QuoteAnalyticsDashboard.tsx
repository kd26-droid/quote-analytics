import { useState } from 'react';
import { Card } from '../ui/card';
import SummaryTab from './tabs/SummaryTab';
import ItemsTab from './tabs/ItemsTab';
import BOMTab from './tabs/BOMTab';
import OverallTab from './tabs/OverallTab';
import type { TopItemsAnalytics, Category, Vendor, AdditionalCostsBreakdown, BOMCostComparison, VendorRateDeviation } from '../../types/quote.types';
import type { CostViewData, BOMDetailData, OverallACData } from '../../services/api';

export type TabType = 'summary' | 'items' | 'bom' | 'overall';

export interface NavigationContext {
  selectedBOM?: string;
  selectedItem?: string;
  selectedVendor?: string;
  selectedCategory?: string;
  selectedAdditionalCost?: string;
  selectedSource?: string;
}

interface QuoteAnalyticsDashboardProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  bomDetailData?: BOMDetailData | null;
  overallACData?: OverallACData | null;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  additionalCosts: AdditionalCostsBreakdown;
  bomCostComparison: BOMCostComparison[];
  vendorRateDeviation: VendorRateDeviation;
  currencySymbol?: string;
}

export default function QuoteAnalyticsDashboard({
  data,
  costViewData,
  bomDetailData,
  overallACData,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  additionalCosts,
  bomCostComparison,
  vendorRateDeviation,
  currencySymbol = '₹'
}: QuoteAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [navigationContext, setNavigationContext] = useState<NavigationContext>({});
  const [filterResetKey, setFilterResetKey] = useState(0); // Increment to trigger filter reset in all tabs

  // Cross-tab navigation function
  const navigateToTab = (tab: TabType, context: NavigationContext = {}) => {
    setActiveTab(tab);
    setNavigationContext(prev => ({ ...prev, ...context }));
  };

  // Clear all filters across all tabs
  const clearAllFilters = () => {
    setNavigationContext({});
    setFilterResetKey(prev => prev + 1); // This triggers useEffect in child tabs to reset their local filters
  };

  const tabs = [
    { id: 'summary' as TabType, label: 'Summary', icon: '📊' },
    { id: 'items' as TabType, label: 'Items', icon: '📦' },
    { id: 'bom' as TabType, label: 'BOM', icon: '🔧' },
    { id: 'overall' as TabType, label: 'Overall', icon: '🎯' }
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <Card className="border-gray-200">
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'summary' && (
          <SummaryTab
            data={data}
            totalQuoteValue={totalQuoteValue}
            totalItems={totalItems}
            topCategories={topCategories}
            topVendors={topVendors}
            bomCostComparison={bomCostComparison}
            additionalCosts={additionalCosts}
            navigateToTab={navigateToTab}
            currencySymbol={currencySymbol}
          />
        )}
        {activeTab === 'items' && (
          <ItemsTab
            data={data}
            costViewData={costViewData}
            totalQuoteValue={totalQuoteValue}
            totalItems={totalItems}
            topCategories={topCategories}
            topVendors={topVendors}
            vendorRateDeviation={vendorRateDeviation}
            bomCostComparison={bomCostComparison}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            filterResetKey={filterResetKey}
            clearAllFilters={clearAllFilters}
            currencySymbol={currencySymbol}
          />
        )}
        {activeTab === 'bom' && (
          <BOMTab
            data={data}
            costViewData={costViewData}
            totalQuoteValue={totalQuoteValue}
            bomCostComparison={bomCostComparison}
            bomDetailData={bomDetailData}
            additionalCosts={additionalCosts}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            filterResetKey={filterResetKey}
            clearAllFilters={clearAllFilters}
            currencySymbol={currencySymbol}
          />
        )}
        {activeTab === 'overall' && (
          <OverallTab
            overallACData={overallACData}
            currencySymbol={currencySymbol}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
      </div>
    </div>
  );
}
