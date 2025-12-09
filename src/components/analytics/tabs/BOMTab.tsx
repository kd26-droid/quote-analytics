import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import BOMComparisonView from './bom-views/BOMComparisonView';
import BOMAdditionalCostsView from './bom-views/BOMAdditionalCostsView';
import BOMVolumeAnalysisView from './bom-views/BOMVolumeAnalysisView';
import type { TopItemsAnalytics, AdditionalCostsBreakdown, BOMCostComparison } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';
import type { BOMDetailData, CostViewData } from '../../../services/api';
import { useBOMInstances } from '../../../hooks/useBOMInstances';

export type BOMViewType = 'comparison' | 'additional-costs' | 'volume-analysis';

interface BOMTabProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  totalQuoteValue: number;
  bomCostComparison: BOMCostComparison[];
  bomDetailData?: BOMDetailData | null;
  additionalCosts: AdditionalCostsBreakdown;
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  filterResetKey?: number;
  clearAllFilters?: () => void;
  currencySymbol?: string;
}

export default function BOMTab({
  data,
  costViewData,
  totalQuoteValue,
  bomCostComparison,
  bomDetailData,
  additionalCosts,
  navigationContext,
  navigateToTab,
  filterResetKey,
  clearAllFilters,
  currencySymbol = '₹'
}: BOMTabProps) {
  const [selectedView, setSelectedView] = useState<BOMViewType>('comparison');

  // Use shared hook to detect volume scenarios from costViewData
  const { hasVolumeScenarios } = useBOMInstances(costViewData?.items || []);

  // Handle navigation context (e.g., when navigating from Items tab or within BOM views)
  useEffect(() => {
    if (navigationContext?.selectedBOM) {
      // If specific BOM selected, might want to show hierarchy
      if (selectedView === 'comparison') {
        // Stay on comparison but pass context to filter
      }
    }
  }, [navigationContext, selectedView]);

  // Conditionally add volume analysis to views
  const views = [
    { id: 'comparison' as BOMViewType, label: 'BOM Comparison', icon: '📊' },
    { id: 'additional-costs' as BOMViewType, label: 'BOM Additional Costs', icon: '💰' },
    ...(hasVolumeScenarios
      ? [{ id: 'volume-analysis' as BOMViewType, label: 'Volume Analysis', icon: '📈' }]
      : []
    )
  ];

  return (
    <div className="space-y-4">
      {/* View Selector - Exact same style as Items Tab */}
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
        {selectedView === 'comparison' && (
          <BOMComparisonView
            key="comparison"
            bomCostComparison={bomCostComparison}
            bomDetailData={bomDetailData}
            costViewData={costViewData}
            totalQuoteValue={totalQuoteValue}
            data={data}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            setSelectedView={setSelectedView}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
            currencySymbol={currencySymbol}
          />
        )}
        {selectedView === 'additional-costs' && (
          <BOMAdditionalCostsView
            key="additional-costs"
            additionalCosts={additionalCosts}
            bomCostComparison={bomCostComparison}
            bomDetailData={bomDetailData}
            costViewData={costViewData}
            totalQuoteValue={totalQuoteValue}
            data={data}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
            currencySymbol={currencySymbol}
          />
        )}
        {selectedView === 'volume-analysis' && hasVolumeScenarios && costViewData && (
          <BOMVolumeAnalysisView
            costViewData={costViewData}
            currencySymbol={currencySymbol}
            totalQuoteValue={totalQuoteValue}
            navigateToTab={navigateToTab}
            navigationContext={navigationContext}
            filterResetKey={filterResetKey}
            onClearAllFilters={clearAllFilters}
          />
        )}
      </div>
    </div>
  );
}
