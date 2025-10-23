import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, VendorRateDeviation } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface RateViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  vendorRateDeviation: VendorRateDeviation;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

export default function RateView({ data, vendorRateDeviation, totalQuoteValue, navigationContext }: RateViewProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Calculate all 4 rates for each item
  const itemRates = useMemo(() => {
    return data.overall.map(item => {
      // Get vendor rate from vendorRateDeviation data
      const vendorData = vendorRateDeviation.items.find(v => v.itemCode === item.itemCode);
      const vendorRate = vendorData?.vendorRate || item.quotedRate * 0.85; // Mock: 85% of quoted rate
      const baseRate = vendorData?.baseRate || item.quotedRate; // Mock: quoted rate as base

      // Quoted rate (Base Rate + AC + Taxes - Discounts)
      const quotedRate = item.quotedRate;

      // Item total
      const itemTotal = item.totalCost;

      // Calculate markup
      const markup = vendorRate > 0 ? ((baseRate - vendorRate) / vendorRate) * 100 : 0;

      // Calculate additional costs impact
      const additionalCostsPerUnit = quotedRate - baseRate;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        vendorRate,
        baseRate,
        quotedRate,
        itemTotal,
        markup,
        additionalCostsPerUnit,
        percentOfQuote: item.percentOfQuote
      };
    });
  }, [data.overall, vendorRateDeviation]);

  // Key insights
  const insights = useMemo(() => {
    const avgMarkup = itemRates.reduce((sum, item) => sum + item.markup, 0) / itemRates.length;
    const highestMarkup = Math.max(...itemRates.map(i => i.markup));
    const lowestMarkup = Math.min(...itemRates.map(i => i.markup));
    const totalAC = itemRates.reduce((sum, item) => sum + (item.additionalCostsPerUnit * item.quantity), 0);

    return { avgMarkup, highestMarkup, lowestMarkup, totalAC };
  }, [itemRates]);

  // Chart data for rate comparison
  const chartData = useMemo(() => {
    return itemRates.slice(0, 8).map(item => ({
      name: item.itemCode,
      'Vendor Rate': item.vendorRate,
      'Your Base Rate': item.baseRate,
      'Final Quoted Rate': item.quotedRate
    }));
  }, [itemRates]);

  return (
    <div className="space-y-4">
      {/* Key Insights */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Average Markup</div>
            <div className="text-2xl font-bold text-blue-600">{insights.avgMarkup.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">From vendor to your price</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Markup Range</div>
            <div className="text-lg font-bold text-green-600">
              {insights.lowestMarkup.toFixed(1)}% - {insights.highestMarkup.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Min to Max markup</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Additional Costs</div>
            <div className="text-2xl font-bold text-orange-600">${(insights.totalAC / 1000).toFixed(0)}k</div>
            <div className="text-xs text-gray-500 mt-1">Across all items</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-purple-600">{itemRates.length}</div>
            <div className="text-xs text-gray-500 mt-1">Items analyzed</div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Comparison Chart */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Rate Comparison: Vendor → Your Price → Final Price</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Vendor Rate') return [`$${value.toLocaleString()} - What vendor quoted you`, 'Vendor Rate (Reference)'];
                  if (name === 'Your Base Rate') return [`$${value.toLocaleString()} - Your selling price per unit`, 'Base Rate (Your Price)'];
                  if (name === 'Final Quoted Rate') return [`$${value.toLocaleString()} - With MOQ/Testing/Coating added`, 'Quoted Rate (Final)'];
                  return [`$${value.toLocaleString()}`, name];
                }}
                contentStyle={{ fontSize: 12, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="Vendor Rate" fill="#9ca3af" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Your Base Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Final Quoted Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Rate Table */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Complete Rate Breakdown (All Items)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-2 text-left font-bold text-gray-700">Item Code</th>
                  <th className="p-2 text-left font-bold text-gray-700">Item Name</th>
                  <th className="p-2 text-right font-bold text-gray-700">Qty</th>
                  <th className="p-2 text-right font-bold text-gray-700">Vendor Rate</th>
                  <th className="p-2 text-right font-bold text-gray-700">Your Base Rate</th>
                  <th className="p-2 text-right font-bold text-gray-700">Markup %</th>
                  <th className="p-2 text-right font-bold text-gray-700">Additional Costs</th>
                  <th className="p-2 text-right font-bold text-gray-700">Final Quoted Rate</th>
                  <th className="p-2 text-right font-bold text-gray-700">Item Total</th>
                  <th className="p-2 text-right font-bold text-gray-700">% Quote</th>
                </tr>
              </thead>
              <tbody>
                {itemRates.map((item) => (
                  <tr
                    key={item.itemCode}
                    className="border-t hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedItem(selectedItem === item.itemCode ? null : item.itemCode)}
                  >
                    <td className="p-2">
                      <span className="font-mono font-medium text-gray-900">{item.itemCode}</span>
                    </td>
                    <td className="p-2 text-gray-700">{item.itemName}</td>
                    <td className="p-2 text-right text-gray-700">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="p-2 text-right font-mono text-gray-600">
                      ${item.vendorRate.toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono font-medium text-blue-600">
                      ${item.baseRate.toLocaleString()}
                    </td>
                    <td className="p-2 text-right">
                      <Badge className={item.markup >= 15 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {item.markup.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono text-orange-600">
                      ${(item.additionalCostsPerUnit * item.quantity).toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-green-600">
                      ${item.quotedRate.toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-gray-900">
                      ${item.itemTotal.toLocaleString()}
                    </td>
                    <td className="p-2 text-right text-gray-600">
                      {item.percentOfQuote.toFixed(1)}%
                    </td>
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
