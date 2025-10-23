import { Card, CardContent } from '../../ui/card';
import type { TopItemsAnalytics, Category, Vendor, BOMCostComparison } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';

interface SummaryTabProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  bomCostComparison: BOMCostComparison[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

export default function SummaryTab({ data, totalQuoteValue, totalItems }: SummaryTabProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Total Quote Value</div>
            <div className="text-3xl font-bold text-blue-600">${totalQuoteValue.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Items</div>
            <div className="text-3xl font-bold text-green-600">{totalItems}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Top 10 Items</div>
            <div className="text-3xl font-bold text-orange-600">${data.insights.top10Total.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{data.insights.top10Percent}% of quote</div>
          </div>
        </div>
        <p className="text-gray-600 mt-6">Detailed summary charts coming soon...</p>
      </CardContent>
    </Card>
  );
}
