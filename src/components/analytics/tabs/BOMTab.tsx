import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../ui/card';
import BOMComparisonView from './bom-views/BOMComparisonView';
import BOMAdditionalCostsView from './bom-views/BOMAdditionalCostsView';
import type { TopItemsAnalytics, AdditionalCostsBreakdown, BOMCostComparison } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';

export type BOMViewType = 'comparison' | 'additional-costs';

interface BOMTabProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  bomCostComparison: BOMCostComparison[];
  additionalCosts: AdditionalCostsBreakdown;
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

export default function BOMTab({
  data,
  totalQuoteValue,
  bomCostComparison,
  additionalCosts,
  navigationContext,
  navigateToTab
}: BOMTabProps) {
  const [selectedView, setSelectedView] = useState<BOMViewType>('comparison');

  // Handle navigation context (e.g., when navigating from Items tab or within BOM views)
  useEffect(() => {
    if (navigationContext?.selectedBOM) {
      // If specific BOM selected, might want to show hierarchy
      if (selectedView === 'comparison') {
        // Stay on comparison but pass context to filter
      }
    }
  }, [navigationContext, selectedView]);

  const views = [
    { id: 'comparison' as BOMViewType, label: 'BOM Comparison', icon: '📊' },
    { id: 'additional-costs' as BOMViewType, label: 'BOM Additional Costs', icon: '💰' }
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
            bomCostComparison={bomCostComparison}
            totalQuoteValue={totalQuoteValue}
            data={data}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
            setSelectedView={setSelectedView}
          />
        )}
        {selectedView === 'additional-costs' && (
          <BOMAdditionalCostsView
            additionalCosts={additionalCosts}
            bomCostComparison={bomCostComparison}
            totalQuoteValue={totalQuoteValue}
            data={data}
            navigationContext={navigationContext}
            navigateToTab={navigateToTab}
          />
        )}
      </div>
    </div>
  );
}
