import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../ui/card';
import CostView from './items-views/CostView';
import VendorView from './items-views/VendorView';
import CategoryView from './items-views/CategoryView';
import RateView from './items-views/RateView';
import AdditionalCostsView from './items-views/AdditionalCostsView';
import CustomView from './items-views/CustomView';
import ItemSourceView from './items-views/ItemSourceView';
import ItemVolumeAnalysisView from './items-views/ItemVolumeAnalysisView';
import type { TopItemsAnalytics, Category, Vendor, VendorRateDeviation, BOMCostComparison } from '../../../types/quote.types';
import type { NavigationContext, TabType } from '../QuoteAnalyticsDashboard';

export type ItemViewType = 'cost' | 'vendor' | 'category' | 'rate' | 'additional-costs' | 'item-source' | 'volume-analysis' | 'custom';

interface ItemsTabProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  vendorRateDeviation: VendorRateDeviation;
  bomCostComparison: BOMCostComparison[];
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

export default function ItemsTab({
  data,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  vendorRateDeviation,
  bomCostComparison,
  navigationContext,
  navigateToTab
}: ItemsTabProps) {
  const [selectedView, setSelectedView] = useState<ItemViewType>('cost');

  // Handle navigation context to switch views automatically
  React.useEffect(() => {
    if (navigationContext.selectedCategory) {
      setSelectedView('category');
    } else if (navigationContext.selectedVendor) {
      setSelectedView('vendor');
    }
  }, [navigationContext]);

  // Detect if volume analysis should be shown
  const hasVolumeItems = useMemo(() => {
    const itemCodeCounts = new Map<string, number>();
    data.overall.forEach(item => {
      const count = itemCodeCounts.get(item.itemCode) || 0;
      itemCodeCounts.set(item.itemCode, count + 1);
    });
    return Array.from(itemCodeCounts.values()).some(count => count > 1);
  }, [data.overall]);

  const views = [
    { id: 'cost' as ItemViewType, label: 'Cost View', icon: '💰' },
    { id: 'vendor' as ItemViewType, label: 'Vendor View', icon: '🏢' },
    { id: 'category' as ItemViewType, label: 'Category View', icon: '📑' },
    { id: 'rate' as ItemViewType, label: 'Rate View', icon: '📊' },
    { id: 'additional-costs' as ItemViewType, label: 'Additional Costs', icon: '💸' },
    { id: 'item-source' as ItemViewType, label: 'Item Source', icon: '🔄' },
    ...(hasVolumeItems
      ? [{ id: 'volume-analysis' as ItemViewType, label: 'Volume Analysis', icon: '📈' }]
      : []
    ),
    { id: 'custom' as ItemViewType, label: 'Custom View', icon: '⚙️' }
  ];

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
            totalQuoteValue={totalQuoteValue}
            totalItems={totalItems}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            setSelectedView={setSelectedView}
          />
        )}
        {selectedView === 'vendor' && (
          <VendorView
            data={data}
            totalQuoteValue={totalQuoteValue}
            topVendors={topVendors}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
          />
        )}
        {selectedView === 'category' && (
          <CategoryView
            data={data}
            totalQuoteValue={totalQuoteValue}
            topCategories={topCategories}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
          />
        )}
        {selectedView === 'rate' && (
          <RateView
            data={data}
            totalQuoteValue={totalQuoteValue}
            vendorRateDeviation={vendorRateDeviation}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
          />
        )}
        {selectedView === 'additional-costs' && (
          <AdditionalCostsView
            data={data}
            totalQuoteValue={totalQuoteValue}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
          />
        )}
        {selectedView === 'item-source' && (
          <ItemSourceView
            data={data}
            totalQuoteValue={totalQuoteValue}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
          />
        )}
        {selectedView === 'volume-analysis' && hasVolumeItems && (
          <ItemVolumeAnalysisView
            data={data}
            bomCostComparison={bomCostComparison}
            totalQuoteValue={totalQuoteValue}
            navigateToTab={navigateToTab}
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
