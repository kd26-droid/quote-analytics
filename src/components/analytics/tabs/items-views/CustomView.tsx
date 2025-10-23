import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Category, Vendor } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface CustomViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  topCategories: Category[];
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CustomView({ data, totalQuoteValue, topCategories, topVendors }: CustomViewProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [groupBy, setGroupBy] = useState<'vendor' | 'category' | 'bom'>('vendor');
  const [metric, setMetric] = useState<'totalCost' | 'itemCount' | 'avgCost'>('totalCost');
  const [topN, setTopN] = useState(6);

  // Generate chart data based on selections
  const chartData = useMemo(() => {
    const groupMap = new Map<string, { items: number; totalCost: number }>();

    data.overall.forEach(item => {
      let key = '';
      if (groupBy === 'vendor') key = item.vendor;
      else if (groupBy === 'category') key = item.category || 'Uncategorized';
      else if (groupBy === 'bom') key = item.bomPath.split('.')[0];

      const current = groupMap.get(key) || { items: 0, totalCost: 0 };
      current.items += 1;
      current.totalCost += item.totalCost;
      groupMap.set(key, current);
    });

    return Array.from(groupMap.entries())
      .map(([name, stats]) => ({
        name,
        totalCost: stats.totalCost,
        itemCount: stats.items,
        avgCost: Math.floor(stats.totalCost / stats.items)
      }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, topN);
  }, [data.overall, groupBy, metric, topN]);

  const metricLabel = {
    totalCost: 'Total Cost',
    itemCount: 'Item Count',
    avgCost: 'Avg Cost per Item'
  }[metric];

  return (
    <div className="space-y-4">
      {/* Chart Builder Controls */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Build Your Custom Chart</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Chart Type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Chart Type:</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'bar' | 'pie')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
              </select>
            </div>

            {/* Group By */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Group By:</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'vendor' | 'category' | 'bom')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="vendor">Vendor</option>
                <option value="category">Category</option>
                <option value="bom">BOM</option>
              </select>
            </div>

            {/* Metric */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Metric:</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as 'totalCost' | 'itemCount' | 'avgCost')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="totalCost">Total Cost</option>
                <option value="itemCount">Item Count</option>
                <option value="avgCost">Avg Cost</option>
              </select>
            </div>

            {/* Top N */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Show Top:</label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {[3, 5, 6, 8, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>Your Chart:</strong> Top {topN} {groupBy} by {metricLabel.toLowerCase()}
          </div>
        </CardContent>
      </Card>

      {/* Generated Chart */}
      <Card className="border-gray-200">
        <CardContent className="p-6">
          <h4 className="font-semibold text-gray-900 mb-4">
            {metricLabel} by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)} (Top {topN})
          </h4>

          {chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    metric === 'totalCost' || metric === 'avgCost'
                      ? `$${(value / 1000).toFixed(0)}k`
                      : value.toString()
                  }
                />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) =>
                    metric === 'totalCost' || metric === 'avgCost'
                      ? `$${value.toLocaleString()}`
                      : value.toString()
                  }
                />
                <Legend />
                <Bar dataKey={metric} name={metricLabel} fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => {
                    const value = entry[metric];
                    const displayValue = metric === 'totalCost' || metric === 'avgCost'
                      ? `$${(value / 1000).toFixed(0)}k`
                      : value;
                    return `${entry.name}: ${displayValue}`;
                  }}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey={metric}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    metric === 'totalCost' || metric === 'avgCost'
                      ? `$${value.toLocaleString()}`
                      : value.toString()
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Chart Data</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-3 text-left font-bold text-gray-700">#</th>
                  <th className="p-3 text-left font-bold text-gray-700">{groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</th>
                  <th className="p-3 text-right font-bold text-gray-700">Total Cost</th>
                  <th className="p-3 text-right font-bold text-gray-700">Item Count</th>
                  <th className="p-3 text-right font-bold text-gray-700">Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => (
                  <tr key={row.name} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-600">#{idx + 1}</td>
                    <td className="p-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="p-3 text-right font-bold text-green-700">${row.totalCost.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium">{row.itemCount}</td>
                    <td className="p-3 text-right font-mono text-xs">${row.avgCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
