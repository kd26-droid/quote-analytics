import { useState } from 'react';
import { Card } from '../ui/card';
import SummaryTab from './tabs/SummaryTab';
import ItemsTab from './tabs/ItemsTab';
import BOMTab from './tabs/BOMTab';
import OverallTab from './tabs/OverallTab';
import type { TopItemsAnalytics, Category, Vendor, AdditionalCostsBreakdown, BOMCostComparison, VendorRateDeviation } from '../../types/quote.types';

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
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  additionalCosts: AdditionalCostsBreakdown;
  bomCostComparison: BOMCostComparison[];
  vendorRateDeviation: VendorRateDeviation;
}

export default function QuoteAnalyticsDashboard({
  data,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  additionalCosts,
  bomCostComparison,
  vendorRateDeviation
}: QuoteAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [navigationContext, setNavigationContext] = useState<NavigationContext>({});

  // Cross-tab navigation function
  const navigateToTab = (tab: TabType, context: NavigationContext = {}) => {
    setActiveTab(tab);
    setNavigationContext(prev => ({ ...prev, ...context }));
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
            navigateToTab={navigateToTab}
          />
        )}
        {activeTab === 'items' && (
          <ItemsTab
            data={data}
            totalQuoteValue={totalQuoteValue}
            totalItems={totalItems}
            topCategories={topCategories}
            topVendors={topVendors}
            vendorRateDeviation={vendorRateDeviation}
            bomCostComparison={bomCostComparison}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
          />
        )}
        {activeTab === 'bom' && (
          <BOMTab
            data={data}
            totalQuoteValue={totalQuoteValue}
            bomCostComparison={bomCostComparison}
            additionalCosts={additionalCosts}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
          />
        )}
        {activeTab === 'overall' && (
          <OverallTab
            totalQuoteValue={totalQuoteValue}
            topVendors={topVendors}
            topCategories={topCategories}
            additionalCosts={additionalCosts}
            vendorRateDeviation={vendorRateDeviation}
            navigateToTab={navigateToTab}
          />
        )}
      </div>
    </div>
  );
}
