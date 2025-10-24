import { useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Category, Vendor, BOMCostComparison, AdditionalCostsBreakdown } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';

interface SummaryTabProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  bomCostComparison: BOMCostComparison[];
  additionalCosts: AdditionalCostsBreakdown;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2'];

export default function SummaryTab({
  data,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  bomCostComparison,
  additionalCosts,
  navigateToTab
}: SummaryTabProps) {

  // Helper function to calculate item-level additional costs
  const getItemAdditionalCosts = (itemCode: string, itemCost: number) => {
    const random = itemCode.charCodeAt(0) % 5;
    let totalAdditionalCost = 0;

    if (random >= 1) totalAdditionalCost += Math.floor(itemCost * 0.02); // MOQ
    if (random >= 2) totalAdditionalCost += Math.floor(itemCost * 0.03); // Markup
    if (random >= 3) totalAdditionalCost += Math.floor(itemCost * 0.015); // Tax
    if (random === 4) totalAdditionalCost += Math.floor(itemCost * 0.01); // Shipping

    return totalAdditionalCost;
  };

  // Top 10 items
  const top10Items = useMemo(() => {
    return data.overall.slice(0, 10).map(item => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      cost: item.totalCost,
      additionalCost: getItemAdditionalCosts(item.itemCode, item.totalCost),
      percent: item.percentOfQuote,
      vendor: item.vendor,
      category: item.category || 'Uncategorized'
    }));
  }, [data.overall]);

  // Vendor breakdown (all vendors)
  const vendorBreakdown = useMemo(() => {
    return topVendors.slice(0, 5).map(v => ({
      name: v.vendorName,
      value: v.totalValue,
      percent: v.percentOfQuote,
      items: v.itemCount
    }));
  }, [topVendors]);

  // Category breakdown (all categories)
  const categoryBreakdown = useMemo(() => {
    return topCategories.slice(0, 5).map(c => ({
      name: c.category,
      value: c.totalCost,
      percent: c.percentOfQuote,
      items: c.itemCount
    }));
  }, [topCategories]);

  // BOM breakdown
  const bomBreakdown = useMemo(() => {
    return bomCostComparison.map(bom => ({
      code: bom.bomCode,
      name: bom.bomName,
      quantity: bom.bomQuantity,
      itemsSubtotal: bom.itemsSubtotal,
      bomAdditionalCost: bom.bomAdditionalCosts,
      total: bom.bomTotalWithAC,
      percent: bom.percentOfQuote
    }));
  }, [bomCostComparison]);

  // Check if there are volume scenarios (duplicate BOMs with different quantities)
  const hasVolumeScenarios = useMemo(() => {
    const bomCodeCounts = new Map<string, number>();
    bomCostComparison.forEach(bom => {
      const count = bomCodeCounts.get(bom.bomCode) || 0;
      bomCodeCounts.set(bom.bomCode, count + 1);
    });
    return Array.from(bomCodeCounts.values()).some(count => count > 1);
  }, [bomCostComparison]);

  // Item Source data (mock - based on item code)
  const itemSourceSummary = useMemo(() => {
    const sources = {
      event: 0,
      project: 0,
      quote: 0,
      removed: 0
    };

    data.overall.forEach(item => {
      const random = item.itemCode.charCodeAt(0) % 10;
      if (random >= 7) sources.event++;
      else if (random >= 4) sources.project++;
      else sources.quote++;

      if (random === 0 || random === 1) sources.removed++;
    });

    return sources;
  }, [data.overall]);

  return (
    <div className="space-y-6">
      {/* Section 1: Quote Overview */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quote Overview</h3>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Quote Value</div>
              <div className="text-3xl font-bold text-gray-900">${totalQuoteValue.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Items</div>
              <div className="text-3xl font-bold text-gray-900">{totalItems}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Unique Vendors</div>
              <div className="text-3xl font-bold text-gray-900">{topVendors.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Categories</div>
              <div className="text-3xl font-bold text-gray-900">{topCategories.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Top 10 Items - Detailed Table */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Top 10 Most Expensive Items</h3>
            <button
              onClick={() => navigateToTab('items', {})}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Items →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Item Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Item Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Vendor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Category</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Item Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Additional Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">% of Quote</th>
                </tr>
              </thead>
              <tbody>
                {top10Items.map((item, idx) => (
                  <tr
                    key={item.itemCode}
                    className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer"
                    onClick={() => navigateToTab('items', { selectedItem: item.itemCode })}
                  >
                    <td className="px-3 py-2.5 text-gray-600">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-900 font-medium">{item.itemCode}</td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate" title={item.itemName}>{item.itemName}</td>
                    <td className="px-3 py-2.5 text-gray-700">{item.vendor}</td>
                    <td className="px-3 py-2.5 text-gray-700">{item.category}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">${item.cost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-purple-700">${item.additionalCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">${(item.cost + item.additionalCost).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{item.percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={5} className="px-3 py-2.5 text-gray-900">Top 10 Subtotal:</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    ${top10Items.reduce((sum, item) => sum + item.cost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-purple-700">
                    ${top10Items.reduce((sum, item) => sum + item.additionalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    ${top10Items.reduce((sum, item) => sum + item.cost + item.additionalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {top10Items.reduce((sum, item) => sum + item.percent, 0).toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Vendor & Category Analysis - Side by Side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Vendor Breakdown */}
        <Card className="border-gray-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Vendor Breakdown</h3>
              <button
                onClick={() => navigateToTab('items', {})}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Details →
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {vendorBreakdown.map((vendor, idx) => (
                <div
                  key={vendor.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigateToTab('items', { selectedVendor: vendor.name })}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{vendor.name}</div>
                      <div className="text-xs text-gray-600">{vendor.items} items</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">${vendor.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{vendor.percent.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={vendorBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  dataKey="value"
                >
                  {vendorBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `$${value.toLocaleString()}`,
                    props.payload.name
                  ]}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-gray-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
              <button
                onClick={() => navigateToTab('items', {})}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Details →
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {categoryBreakdown.map((category, idx) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigateToTab('items', { selectedCategory: category.name })}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{category.name}</div>
                      <div className="text-xs text-gray-600">{category.items} items</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">${category.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{category.percent.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  dataKey="value"
                >
                  {categoryBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `$${value.toLocaleString()}`,
                    props.payload.name
                  ]}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Section 3.5: Item Source Summary */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Item Source Tracking</h3>
            <button
              onClick={() => navigateToTab('items', {})}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View Item Source Details →
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-xs text-purple-700 mb-1 font-semibold">From Event</div>
              <div className="text-3xl font-bold text-purple-900">{itemSourceSummary.event}</div>
              <div className="text-xs text-purple-600 mt-1">items originated from events</div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-xs text-blue-700 mb-1 font-semibold">From Project</div>
              <div className="text-3xl font-bold text-blue-900">{itemSourceSummary.project}</div>
              <div className="text-xs text-blue-600 mt-1">items originated from projects</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-xs text-green-700 mb-1 font-semibold">From Quote</div>
              <div className="text-3xl font-bold text-green-900">{itemSourceSummary.quote}</div>
              <div className="text-xs text-green-600 mt-1">items originated from quotes</div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-xs text-red-700 mb-1 font-semibold">Removed Items</div>
              <div className="text-3xl font-bold text-red-900">{itemSourceSummary.removed}</div>
              <div className="text-xs text-red-600 mt-1">items removed from quote</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-600 bg-gray-50 p-3 rounded">
            💡 <span className="font-semibold">Item Source Tracking</span> shows the origin of items in your quote.
            Items can come from Events, Projects, or be directly added to Quotes.
            Track which items were removed and understand your quote composition.
          </div>
        </CardContent>
      </Card>

      {/* Section 4: BOM Breakdown - Detailed Table */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">BOM Cost Breakdown</h3>
              {hasVolumeScenarios && (
                <button
                  onClick={() => navigateToTab('bom', {})}
                  className="mt-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 inline-block px-2 py-1 rounded cursor-pointer transition-colors"
                  title="Click to view Volume Analysis in BOM tab"
                >
                  📈 Volume Analysis Available - Multiple quantities for same BOMs
                </button>
              )}
            </div>
            <button
              onClick={() => navigateToTab('bom', {})}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View BOM Analysis →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">BOM Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">BOM Name</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Items Subtotal</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">BOM Additional Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total (with Additional Cost)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">% of Quote</th>
                </tr>
              </thead>
              <tbody>
                {bomBreakdown.map((bom, idx) => (
                  <tr
                    key={`bom-${bom.code}-${bom.quantity || 'default'}-${idx}`}
                    className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer"
                    onClick={() => navigateToTab('bom', { selectedBOM: bom.code })}
                  >
                    <td className="px-3 py-2.5 font-mono text-gray-900 font-medium">{bom.code}</td>
                    <td className="px-3 py-2.5 text-gray-700">{bom.name}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{bom.quantity || '-'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">${bom.itemsSubtotal.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">${bom.bomAdditionalCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">${bom.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{bom.percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-gray-900">Total:</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    ${bomBreakdown.reduce((sum, bom) => sum + bom.itemsSubtotal, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    ${bomBreakdown.reduce((sum, bom) => sum + bom.bomAdditionalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    ${bomBreakdown.reduce((sum, bom) => sum + bom.total, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {bomBreakdown.reduce((sum, bom) => sum + bom.percent, 0).toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Additional Costs - Detailed Breakdown */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Additional Costs Breakdown</h3>
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Additional Costs</div>
              <div className="text-2xl font-bold text-gray-900">${additionalCosts.totalAdditionalCosts.toLocaleString()}</div>
              <div className="text-xs text-gray-600">{additionalCosts.percentOfBaseQuote.toFixed(2)}% of quote</div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Item Level Additional Costs */}
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">Item Level Additional Costs</h4>
                  <p className="text-xs text-gray-600">Costs added at individual item level</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${additionalCosts.itemLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCosts.itemLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('items', {})}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View in Items Tab →
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {additionalCosts.itemLevel.breakdown.map((ac) => (
                  <div key={ac.costName} className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">{ac.costName}</div>
                    <div className="text-lg font-bold text-gray-900">${ac.total.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{ac.count} items</div>
                  </div>
                ))}
              </div>
            </div>

            {/* BOM Level Additional Costs */}
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">BOM Level Additional Costs</h4>
                  <p className="text-xs text-gray-600">Costs added at BOM level (showing all volume options)</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${additionalCosts.bomLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCosts.bomLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('bom', {})}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View in BOM Tab →
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {bomBreakdown.filter(bom => bom.bomAdditionalCost > 0).map((bom, idx) => (
                  <div
                    key={`bom-additional-cost-${bom.code}-${bom.quantity || 'default'}-${idx}`}
                    className="bg-gray-50 p-3 rounded flex justify-between items-center hover:bg-blue-50 cursor-pointer"
                    onClick={() => navigateToTab('bom', { selectedBOM: bom.code })}
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        BOM {bom.code}
                        {bom.quantity && <span className="ml-2 text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Qty: {bom.quantity}</span>}
                      </div>
                      <div className="text-xs text-gray-600">{bom.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">${bom.bomAdditionalCost.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">{((bom.bomAdditionalCost / bom.total) * 100).toFixed(2)}% of BOM total</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Level Additional Costs */}
            <div className="border-l-4 border-pink-500 pl-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">Overall Level Additional Costs</h4>
                  <p className="text-xs text-gray-600">Costs added at quote level</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">${additionalCosts.overallLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCosts.overallLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('overall', {})}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View in Overall Tab →
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {additionalCosts.overallLevel.breakdown.map((ac) => (
                  <div key={ac.costName} className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">{ac.costName}</div>
                    <div className="flex justify-between items-end mt-1">
                      <div>
                        <div className="text-xs text-gray-500">Original:</div>
                        <div className="font-bold text-gray-700">${ac.original.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Agreed:</div>
                        <div className="font-bold text-gray-900">${ac.agreed.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
