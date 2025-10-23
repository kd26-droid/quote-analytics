import { Card, CardContent } from '../../../ui/card';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface BOMViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

export default function BOMView({ data }: BOMViewProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">BOM View</h3>
        <p className="text-gray-600">BOM analysis coming soon...</p>
      </CardContent>
    </Card>
  );
}
