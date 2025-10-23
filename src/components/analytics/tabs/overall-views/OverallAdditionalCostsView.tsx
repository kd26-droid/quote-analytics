import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AdditionalCostsBreakdown } from '../../../../types/quote.types';

interface OverallAdditionalCostsViewProps {
  additionalCosts: AdditionalCostsBreakdown;
  totalQuoteValue: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function OverallAdditionalCostsView({
  additionalCosts,
  totalQuoteValue
}: OverallAdditionalCostsViewProps) {
  const [selectedCosts, setSelectedCosts] = useState<string[]>(['all']);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Helper function to toggle multi-select
  const toggleSelection = (current: string[], value: string) => {
    if (value === 'all') return ['all'];
    let newSelection = current.filter(v => v !== 'all');
    if (newSelection.includes(value)) {
      newSelection = newSelection.filter(v => v !== value);
      if (newSelection.length === 0) return ['all'];
    } else {
      newSelection.push(value);
    }
    return newSelection;
  };

  // Extract overall AC data (just use the agreed/final amount)
  const overallACData = useMemo(() => {
    return additionalCosts.overallLevel.breakdown.map(cost => ({
      costName: cost.costName,
      amount: cost.agreed, // Just the final cost amount
      percentOfQuote: ((cost.agreed / totalQuoteValue) * 100).toFixed(1)
    }));
  }, [additionalCosts, totalQuoteValue]);

  // Get all cost names
  const allCostNames = useMemo(() => {
    return overallACData.map(c => c.costName);
  }, [overallACData]);

  // Filter costs
  const filteredCosts = useMemo(() => {
    if (selectedCosts.includes('all')) return overallACData;
    return overallACData.filter(cost => selectedCosts.includes(cost.costName));
  }, [overallACData, selectedCosts]);

  // Calculate insights
  const insights = useMemo(() => {
    const totalAmount = filteredCosts.reduce((sum, c) => sum + c.amount, 0);
    const percentOfQuote = ((totalAmount / totalQuoteValue) * 100).toFixed(1);

    const highestCost = filteredCosts.reduce((max, c) =>
      c.amount > max.amount ? c : max
    , filteredCosts[0] || { costName: '', amount: 0 });

    return {
      totalAmount,
      percentOfQuote,
      highestCost,
      costCount: filteredCosts.length
    };
  }, [filteredCosts, totalQuoteValue]);

  // Bar chart data - individual costs
  const barChartData = useMemo(() => {
    return filteredCosts.map(cost => ({
      name: cost.costName,
      amount: cost.amount
    }));
  }, [filteredCosts]);

  // Pie chart data - Filtered Overall AC vs Rest of Quote
  const quoteComparisonData = useMemo(() => {
    const totalFilteredAC = filteredCosts.reduce((sum, c) => sum + c.amount, 0);
    const restOfQuote = totalQuoteValue - totalFilteredAC;

    // If specific costs selected, show those costs vs rest
    const label = selectedCosts.includes('all')
      ? 'Overall AC'
      : selectedCosts.length === 1
        ? selectedCosts[0]
        : `${selectedCosts.length} Costs`;

    return [
      { name: label, value: totalFilteredAC },
      { name: 'Rest of Quote', value: restOfQuote }
    ];
  }, [filteredCosts, totalQuoteValue, selectedCosts]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="space-y-3">
            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="font-semibold text-gray-700">
                Filters: {selectedCosts.includes('all') ? 'All Costs' : `${selectedCosts.length} Cost(s)`}
              </span>

              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {filtersExpanded ? '▲ Hide Filters' : '▼ Show Filters'}
              </button>

              {!selectedCosts.includes('all') && (
                <button
                  onClick={() => setSelectedCosts(['all'])}
                  className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Expanded Filters */}
            {filtersExpanded && (
              <div className="pt-3 border-t">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Filter by Cost Type:</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedCosts.includes('all')}
                        onChange={() => setSelectedCosts(['all'])}
                        className="rounded"
                      />
                      <span className="font-medium">All</span>
                    </label>
                    {allCostNames.map(costName => (
                      <label key={costName} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedCosts.includes(costName)}
                          onChange={() => setSelectedCosts(toggleSelection(selectedCosts, costName))}
                          className="rounded"
                        />
                        <span>{costName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actionable Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Overall AC */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Overall AC</div>
            <div className="text-2xl font-bold text-blue-600">${insights.totalAmount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{insights.percentOfQuote}% of quote</div>
            <div className="text-xs text-gray-500">{insights.costCount} cost type(s)</div>
          </CardContent>
        </Card>

        {/* Highest Cost */}
        <Card className="border-gray-200 hover:border-blue-400 transition-colors cursor-pointer">
          <CardContent
            className="p-4"
            onClick={() => {
              if (insights.highestCost) {
                setSelectedCosts([insights.highestCost.costName]);
                setFiltersExpanded(true);
              }
            }}
          >
            <div className="text-xs font-semibold text-gray-600 mb-1">Highest Cost</div>
            <div className="text-2xl font-bold text-orange-600">
              {insights.highestCost ? `$${insights.highestCost.amount.toLocaleString()}` : 'N/A'}
            </div>
            {insights.highestCost && (
              <>
                <div className="text-xs text-gray-500 mt-1">{insights.highestCost.costName}</div>
                <div className="text-xs text-blue-600 hover:underline mt-1 font-medium">
                  Click to filter →
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Overall AC vs Rest of Quote */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Overall AC vs Quote</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={quoteComparisonData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    const percent = ((entry.value / totalQuoteValue) * 100).toFixed(1);
                    return `${entry.name}: ${percent}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#f59e0b" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip
                  formatter={(value: number) => {
                    const percent = ((value / totalQuoteValue) * 100).toFixed(1);
                    return [`$${value.toLocaleString()} (${percent}%)`, ''];
                  }}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Individual Cost Breakdown Bar Chart */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Cost Type Breakdown</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">Overall Additional Costs Breakdown</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 text-sm">Cost Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 text-sm">Amount</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 text-sm">% of Quote</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredCosts.map((cost) => (
                  <tr key={cost.costName} className="border-b border-gray-200 hover:bg-blue-50">
                    <td className="px-4 py-3 text-gray-900 border-r border-gray-200 text-sm">
                      {cost.costName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 border-r border-gray-200 text-sm">
                      ${cost.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 text-sm">
                      {cost.percentOfQuote}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td className="px-4 py-3 font-bold text-gray-900 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-sm">
                    ${insights.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-sm">
                    {insights.percentOfQuote}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            <span className="font-medium">Note:</span> Overall Additional Costs are quote-level costs like freight, insurance, and handling.
            These apply to the entire quote and should typically be &lt;5% of quote value.
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
