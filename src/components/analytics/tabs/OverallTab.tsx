import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import OverallAdditionalCostsView from './overall-views/OverallAdditionalCostsView';
import type { Category, Vendor, AdditionalCostsBreakdown, VendorRateDeviation } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';

export type OverallViewType = 'additional-costs';

interface OverallTabProps {
  totalQuoteValue: number;
  topVendors: Vendor[];
  topCategories: Category[];
  additionalCosts: AdditionalCostsBreakdown;
  vendorRateDeviation: VendorRateDeviation;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

export default function OverallTab({
  totalQuoteValue,
  additionalCosts
}: OverallTabProps) {
  const [selectedView, setSelectedView] = useState<OverallViewType>('additional-costs');

  const views = [
    { id: 'additional-costs' as OverallViewType, label: 'Overall Additional Costs', icon: '💰' }
  ];

  return (
    <div className="space-y-4">
      {/* View Selector - Exact same style as Items/BOM Tab */}
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
        {selectedView === 'additional-costs' && (
          <OverallAdditionalCostsView
            additionalCosts={additionalCosts}
            totalQuoteValue={totalQuoteValue}
          />
        )}
      </div>
    </div>
  );
}
