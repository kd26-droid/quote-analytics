import { useEffect, useState } from 'react';
import QuoteAnalyticsDashboard from './components/analytics/QuoteAnalyticsDashboard';
import { analyticsData } from './data/mockQuoteData';
import {
  fetchQuoteAnalyticsHeader,
  fetchCostViewData,
  QuoteAnalyticsHeaderData,
  CostViewData
} from './services/api';

function App() {
  const [headerData, setHeaderData] = useState<QuoteAnalyticsHeaderData | null>(null);
  const [costViewData, setCostViewData] = useState<CostViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get params from URL
  const urlParams = new URLSearchParams(window.location.search);
  const costingSheetId = urlParams.get('costing_sheet_id');
  const token = urlParams.get('token');

  useEffect(() => {
    const loadData = async () => {
      if (!costingSheetId || !token) {
        setError('Missing costing_sheet_id or token in URL');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Load header and cost view data in parallel
        const [headerResponse, costViewResponse] = await Promise.all([
          fetchQuoteAnalyticsHeader(costingSheetId, token),
          fetchCostViewData(costingSheetId, token)
        ]);

        setHeaderData(headerResponse.data);
        setCostViewData(costViewResponse.data);
      } catch (err: any) {
        console.error('Failed to load quote analytics data:', err);
        setError(err.message || 'Failed to load quote data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [costingSheetId, token]);

  // Handle back button - send message to parent
  const handleBack = () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'CLOSE_ANALYTICS' }, '*');
    } else {
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading quote data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '18px', color: '#dc2626', marginBottom: '16px' }}>
                Error loading quote data
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                {error}
              </div>
              <button
                onClick={handleBack}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!headerData || !costViewData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Quote Details - Table Layout matching Factwise */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          {/* Header with Back Button */}
          <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={handleBack}
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#4b5563',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                marginRight: '12px',
              }}
              title="Back to Quote"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Quote Analytics Dashboard</h1>
          </div>

          {/* Quote Details - Simple Table Layout */}
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 16px' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: '600', color: '#374151', width: '15%', fontSize: '14px' }}>Quote ID</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.quote_overview.quote_id}</td>
                <td style={{ fontWeight: '600', color: '#374151', width: '15%', fontSize: '14px' }}>Quote Name</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.quote_overview.quote_name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Entity</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.entity_info.seller_entity_name}</td>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Quote Creator</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.creator_info.user_name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Quote Status</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.status_info.status_display}</td>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Currency</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.currency_info.currency_name} ({headerData.currency_info.currency_symbol})</td>
              </tr>
              <tr>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Customer</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.customer_info.customer_entity_name || '-'}</td>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Project</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.project_info.project_name || 'NA'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>Total Items</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{costViewData.summary.total_costing_sheet_items}</td>
                <td style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>BOMs</td>
                <td style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>{headerData.bom_summary.bom_list.map(bom => bom.bom_name).join(', ') || '-'}</td>
              </tr>
              <tr style={{ backgroundColor: '#f0f9ff' }}>
                <td style={{ fontWeight: '700', color: '#1e40af', fontSize: '14px', padding: '12px' }}>Total Quote Value</td>
                <td colSpan={3} style={{ fontWeight: '700', color: '#1e40af', fontSize: '24px', padding: '12px' }}>
                  {headerData.financial_summary.currency_symbol}{costViewData.summary.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabbed Dashboard */}
        <QuoteAnalyticsDashboard
          data={analyticsData.topItemsByCost}
          costViewData={costViewData}
          totalQuoteValue={costViewData.summary.grand_total}
          totalItems={costViewData.summary.total_costing_sheet_items}
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
