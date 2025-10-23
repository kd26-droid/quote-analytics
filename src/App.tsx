import QuoteAnalyticsDashboard from './components/analytics/QuoteAnalyticsDashboard';
import { analyticsData } from './data/mockQuoteData';

const TOTAL_QUOTE_VALUE = 528000;
const TOTAL_ITEMS_IN_QUOTE = 50; // Total items across all BOMs
const TOTAL_BOMS = 3; // A, B, C

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quote Analytics Dashboard</h1>
              <p className="text-gray-600 mt-2 text-sm">Quote #Q-2024-045 - Acme Corp - Q4 Industrial Equipment Order</p>
              <div className="flex gap-6 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Total Items:</span>
                  <span className="font-semibold text-gray-900">{TOTAL_ITEMS_IN_QUOTE} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">BOMs:</span>
                  <span className="font-semibold text-gray-900">{TOTAL_BOMS} assemblies (A, B, C)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Status:</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">Draft</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Quote Value</div>
              <div className="text-4xl font-bold text-gray-900">${TOTAL_QUOTE_VALUE.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Across {TOTAL_ITEMS_IN_QUOTE} items in {TOTAL_BOMS} BOMs</div>
            </div>
          </div>
        </div>

        {/* New Tabbed Dashboard */}
        <QuoteAnalyticsDashboard
          data={analyticsData.topItemsByCost}
          totalQuoteValue={TOTAL_QUOTE_VALUE}
          totalItems={TOTAL_ITEMS_IN_QUOTE}
          topCategories={analyticsData.topCategories}
          topVendors={analyticsData.topVendors}
          additionalCosts={analyticsData.additionalCostsBreakdown}
          bomCostComparison={analyticsData.bomCostComparison}
          vendorRateDeviation={analyticsData.vendorRateDeviation}
        />

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          Quote Analytics v2.0 • Professional B2B Analytics Dashboard
        </div>
      </div>
    </div>
  );
}

export default App;
