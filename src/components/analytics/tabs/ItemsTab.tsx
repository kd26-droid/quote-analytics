import { useState } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../ui/card';
import CostView from './items-views/CostView';
import VendorView from './items-views/VendorView';
import CategoryView from './items-views/CategoryView';
import RateView from './items-views/RateView';
import AdditionalCostsView from './items-views/AdditionalCostsView';
import CustomView from './items-views/CustomView';
import ItemVolumeAnalysisView from './items-views/ItemVolumeAnalysisView';
import { useBOMInstances } from '../../../hooks/useBOMInstances';
import type { TopItemsAnalytics, Category, Vendor, VendorRateDeviation, BOMCostComparison } from '../../../types/quote.types';
import type { NavigationContext, TabType } from '../QuoteAnalyticsDashboard';
import type { CostViewData } from '../../../services/api';

export type ItemViewType = 'cost' | 'vendor' | 'category' | 'rate' | 'additional-costs' | 'volume-analysis' | 'custom';

interface ItemsTabProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol?: string;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  vendorRateDeviation: VendorRateDeviation;
  bomCostComparison: BOMCostComparison[];
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  filterResetKey?: number;
  clearAllFilters?: () => void;
}

export default function ItemsTab({
  data,
  costViewData,
  currencySymbol = '₹',
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  vendorRateDeviation,
  bomCostComparison,
  navigationContext,
  navigateToTab,
  filterResetKey,
  clearAllFilters
}: ItemsTabProps) {
  const [selectedView, setSelectedView] = useState<ItemViewType>('cost');

  // Use shared hook to detect volume scenarios from costViewData
  const { hasVolumeScenarios } = useBOMInstances(costViewData?.items || []);

  const views = [
    { id: 'cost' as ItemViewType, label: 'Cost View', icon: '💰' },
    { id: 'vendor' as ItemViewType, label: 'Vendor View', icon: '🏢' },
    { id: 'category' as ItemViewType, label: 'Category View', icon: '📑' },
    { id: 'rate' as ItemViewType, label: 'Rate View', icon: '📊' },
    { id: 'additional-costs' as ItemViewType, label: 'Additional Costs', icon: '💸' },
    ...(hasVolumeScenarios
      ? [{ id: 'volume-analysis' as ItemViewType, label: 'Volume Analysis', icon: '📈' }]
      : []
    ),
    { id: 'custom' as ItemViewType, label: 'Custom View', icon: '⚙️' }
  ];

  // Handle navigation context to switch views automatically
  React.useEffect(() => {
    const validViews: ItemViewType[] = ['cost', 'vendor', 'category', 'rate', 'additional-costs', 'volume-analysis', 'custom'];
    if (navigationContext.targetView) {
      // Navigate to specific view (e.g., from Summary "View All Items in Cost View")
      const viewId = navigationContext.targetView as ItemViewType;
      if (validViews.includes(viewId)) {
        setSelectedView(viewId);
      }
    } else if (navigationContext.selectedCategory) {
      setSelectedView('category');
    } else if (navigationContext.selectedVendor) {
      setSelectedView('vendor');
    }
  }, [navigationContext]);

  return (
    <div className="space-y-4">
      {/* View Selector */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-gray-700">🎯 SELECT ANALYSIS VIEW:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {views.map(view => (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedView === view.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{view.icon}</span>
                <span>{view.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View Content */}
      <div>
        {selectedView === 'cost' && (
          <CostView
            data={data}
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            totalItems={totalItems}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            setSelectedView={setSelectedView}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'vendor' && (
          <VendorView
            data={data}
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            topVendors={topVendors}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'category' && (
          <CategoryView
            data={data}
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            topCategories={topCategories}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'rate' && (
          <RateView
            data={data}
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            vendorRateDeviation={vendorRateDeviation}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'additional-costs' && (
          <AdditionalCostsView
            data={data}
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'volume-analysis' && hasVolumeScenarios && costViewData && (
          <ItemVolumeAnalysisView
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
        {selectedView === 'custom' && (
          <CustomView
            data={data}
            totalQuoteValue={totalQuoteValue}
            topCategories={topCategories}
            topVendors={topVendors}
            navigateToTab={navigateToTab}
          />
        )}
      </div>
    </div>
  );
}
