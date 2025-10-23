import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import type { TopItemsAnalytics } from '../../../types/quote.types';

interface TopItemsChartProps {
  data: TopItemsAnalytics;
  totalQuoteValue?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1', '#d084d0', '#a4de6c'];
const CONCENTRATION_COLORS = {
  top10: '#3b82f6', // Blue
  rest: '#e5e7eb'   // Light gray
};

// Extract unique BOM paths and build hierarchy
const getBOMHierarchy = (items: TopItemsAnalytics['overall']) => {
  const bomPaths = new Set(items.map(item => item.bomPath));
  const hierarchy: { value: string; label: string; level: number }[] = [
    { value: 'all', label: 'All BOMs', level: 0 }
  ];

  // Sort to get parent BOMs first
  const sortedPaths = Array.from(bomPaths).sort();

  sortedPaths.forEach(path => {
    const parts = path.split('.');
    const level = parts.length;
    const mainBom = parts[0];

    // Add main BOM if not exists
    if (!hierarchy.find(h => h.value === mainBom)) {
      hierarchy.push({ value: mainBom, label: `BOM ${mainBom}`, level: 1 });
    }

    // Add sub-BOMs
    if (level > 1) {
      hierarchy.push({ value: path, label: `BOM ${path}`, level });
    }
  });

  return hierarchy;
};

export default function TopItemsChart({ data }: TopItemsChartProps) {
  const [selectedBOM, setSelectedBOM] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'total' | 'perUnit'>('total');

  const bomHierarchy = useMemo(() => getBOMHierarchy(data.overall), [data.overall]);

  // Filter items based on selected BOM
  const filteredItems = useMemo(() => {
    if (selectedBOM === 'all') return data.overall;

    // Check if it's a main BOM (single letter like "A", "B", "C")
    const isMainBOM = selectedBOM.length === 1;

    if (isMainBOM) {
      // Include all items that belong to this BOM and its sub-BOMs
      return data.overall.filter(item => item.bomPath.startsWith(selectedBOM));
    } else {
      // Exact match for sub-BOM
      return data.overall.filter(item => item.bomPath === selectedBOM);
    }
  }, [data.overall, selectedBOM]);

  // Calculate insights for filtered data
  const filteredInsights = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + item.totalCost, 0);
    const top3Total = filteredItems.slice(0, 3).reduce((sum, item) => sum + item.totalCost, 0);

    // Find total quote value (we'll use the original insights for this)
    const quoteTotal = data.insights.top10Total / (data.insights.top10Percent / 100);

    return {
      total,
      percent: (total / quoteTotal) * 100,
      top3Total,
      top3Percent: (top3Total / quoteTotal) * 100,
      count: filteredItems.length
    };
  }, [filteredItems, data.insights]);

  // Prepare chart data based on display mode
  const chartData = useMemo(() => {
    return filteredItems.map(item => ({
      ...item,
      displayValue: displayMode === 'total' ? item.totalCost : item.quotedRate
    }));
  }, [filteredItems, displayMode]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by BOM:</label>
          <select
            value={selectedBOM}
            onChange={(e) => setSelectedBOM(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {bomHierarchy.map(bom => (
              <option key={bom.value} value={bom.value}>
                {bom.level > 1 ? '  '.repeat(bom.level - 1) + '└─ ' : ''}{bom.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Display:</label>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-md">
            <button
              onClick={() => setDisplayMode('total')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                displayMode === 'total'
                  ? 'bg-white text-blue-600 font-medium shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Total Cost
            </button>
            <button
              onClick={() => setDisplayMode('perUnit')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                displayMode === 'perUnit'
                  ? 'bg-white text-blue-600 font-medium shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Per Unit Rate
            </button>
          </div>
        </div>
      </div>

      {/* Insights */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <span>💡</span>
            <span>Key Insights {selectedBOM !== 'all' && `(BOM ${selectedBOM})`}</span>
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {selectedBOM === 'all' ? (
              <>
                <li>• Top 10 items = ${data.insights.top10Total.toLocaleString()} ({data.insights.top10Percent}% of quote)</li>
                <li>• Top 3 items = ${data.insights.top3Total.toLocaleString()} ({data.insights.top3Percent}% of quote)</li>
                <li>• Most expensive item: {data.insights.mostExpensiveSingleItem}</li>
                <li>• Highest concentration: {data.insights.highestConcentration}</li>
                <li className="pt-1 font-medium">💡 Focus negotiation on top 5 items for maximum savings</li>
              </>
            ) : (
              <>
                <li>• {filteredInsights.count} items in this BOM = ${filteredInsights.total.toLocaleString()} ({filteredInsights.percent.toFixed(1)}% of quote)</li>
                <li>• Top 3 in this BOM = ${filteredInsights.top3Total.toLocaleString()} ({filteredInsights.top3Percent.toFixed(1)}% of quote)</li>
                {filteredItems.length > 0 && (
                  <li>• Most expensive: {filteredItems[0].itemName} (${filteredItems[0].totalCost.toLocaleString()})</li>
                )}
                {filteredItems.length > 1 && displayMode === 'perUnit' && (
                  <li>• Highest per-unit rate: ${Math.max(...filteredItems.map(i => i.quotedRate)).toLocaleString()}/unit</li>
                )}
              </>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      {filteredItems.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <YAxis
              dataKey="itemCode"
              type="category"
              width={100}
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded shadow-lg max-w-sm">
                      <p className="font-semibold text-gray-900">{item.itemName}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-gray-600">Code: <span className="font-mono">{item.itemCode}</span></p>
                        <p className="text-gray-600">BOM: <Badge variant="outline">{item.bomPath}</Badge></p>
                        <p className="text-gray-600">Quantity: {item.quantity} {item.unit}</p>
                        <p className="text-gray-600">Rate: ${item.quotedRate.toFixed(2)}/{item.unit}</p>
                        <p className="font-semibold text-green-600">Total: ${item.totalCost.toLocaleString()}</p>
                        <p className="text-gray-600">{item.percentOfQuote.toFixed(1)}% of quote</p>
                        <p className="text-gray-500 text-xs mt-1">Vendor: {item.vendor}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              formatter={() => displayMode === 'total' ? 'Total Cost ($)' : 'Per Unit Rate ($)'}
            />
            <Bar dataKey="displayValue" name={displayMode === 'total' ? 'Total Cost' : 'Per Unit Rate'}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No items found for selected BOM filter.
        </div>
      )}

      {/* Table View */}
      {filteredItems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold">#</th>
                  <th className="p-3 text-left font-semibold">Item Code</th>
                  <th className="p-3 text-left font-semibold">Item Name</th>
                  <th className="p-3 text-left font-semibold">BOM</th>
                  <th className="p-3 text-right font-semibold">Qty</th>
                  <th className="p-3 text-left font-semibold">Unit</th>
                  <th className="p-3 text-right font-semibold">Rate</th>
                  <th className="p-3 text-right font-semibold">Total</th>
                  <th className="p-3 text-right font-semibold">%</th>
                  <th className="p-3 text-left font-semibold">Vendor</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.rank} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      {item.rank === 1 && <Badge className="bg-yellow-400 text-gray-900 hover:bg-yellow-500">🥇 1</Badge>}
                      {item.rank === 2 && <Badge className="bg-gray-300 text-gray-900 hover:bg-gray-400">🥈 2</Badge>}
                      {item.rank === 3 && <Badge className="bg-orange-400 text-gray-900 hover:bg-orange-500">🥉 3</Badge>}
                      {item.rank > 3 && <span className="text-gray-500 font-medium">{item.rank}</span>}
                    </td>
                    <td className="p-3 font-mono text-xs text-gray-700">{item.itemCode}</td>
                    <td className="p-3 max-w-xs">
                      <div className="truncate" title={item.itemName}>{item.itemName}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">{item.bomPath}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{item.quantity}</td>
                    <td className="p-3 text-gray-600">{item.unit}</td>
                    <td className="p-3 text-right font-mono text-xs">${item.quotedRate.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold text-green-700">${item.totalCost.toLocaleString()}</td>
                    <td className="p-3 text-right text-sm text-gray-600">{item.percentOfQuote.toFixed(1)}%</td>
                    <td className="p-3 text-xs text-gray-500 max-w-xs truncate" title={item.vendor}>{item.vendor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
