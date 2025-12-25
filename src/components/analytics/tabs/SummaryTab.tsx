import { useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import type { TopItemsAnalytics, Category, Vendor } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';
import type { CostViewData, BOMDetailData } from '../../../services/api';

interface SummaryTabProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  bomDetailData?: BOMDetailData | null;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  currencySymbol?: string;
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2'];

export default function SummaryTab({
  data,
  costViewData,
  bomDetailData,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  navigateToTab,
  currencySymbol = '₹'
}: SummaryTabProps) {

  // Top 10 items from real API data (costViewData)
  // % of Quote calculated same as CostView: total_amount / totalQuoteValue
  const top10Items = useMemo(() => {
    if (costViewData?.items) {
      // Sort by total_amount descending and take top 10
      return [...costViewData.items]
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 10)
        .map(item => ({
          itemCode: item.item_code,
          itemName: item.item_name,
          cost: item.total_item_cost - item.total_additional_cost, // Base cost without AC
          additionalCost: item.total_additional_cost,
          totalCost: item.total_amount, // Use total_amount same as CostView
          percent: totalQuoteValue > 0 ? (item.total_amount / totalQuoteValue) * 100 : 0, // Same formula as CostView
          vendor: item.vendor_name || 'Unknown',
          category: item.tags?.[0] || 'Uncategorized'
        }));
    }
    // Fallback to old data if costViewData not available
    return data.overall.slice(0, 10).map(item => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      cost: item.totalCost,
      additionalCost: 0,
      totalCost: item.totalCost,
      percent: totalQuoteValue > 0 ? (item.totalCost / totalQuoteValue) * 100 : 0,
      vendor: item.vendor,
      category: item.category || 'Uncategorized'
    }));
  }, [costViewData, data.overall, totalQuoteValue]);

  // Vendor breakdown from costViewData (same logic as VendorView)
  const vendorBreakdown = useMemo(() => {
    if (costViewData?.items) {
      const vendorMap = new Map<string, { vendor_id: string; vendor_name: string; items: number; totalCost: number }>();

      costViewData.items.forEach(item => {
        if (!item.vendor_id || !item.vendor_name) return;
        const current = vendorMap.get(item.vendor_id) || {
          vendor_id: item.vendor_id,
          vendor_name: item.vendor_name,
          items: 0,
          totalCost: 0
        };
        current.items += 1;
        current.totalCost += item.total_amount;
        vendorMap.set(item.vendor_id, current);
      });

      const totalCostSum = Array.from(vendorMap.values()).reduce((sum, v) => sum + v.totalCost, 0);

      return Array.from(vendorMap.values())
        .map(stats => ({
          name: stats.vendor_name,
          value: stats.totalCost,
          percent: totalCostSum > 0 ? (stats.totalCost / totalCostSum) * 100 : 0,
          items: stats.items
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }
    // Fallback
    return topVendors.slice(0, 5).map(v => ({
      name: v.vendorName,
      value: v.totalValue,
      percent: v.percentOfQuote,
      items: v.itemCount
    }));
  }, [costViewData, topVendors]);

  // Category breakdown from costViewData (same logic as CategoryView)
  const categoryBreakdown = useMemo(() => {
    if (costViewData?.items) {
      const catMap = new Map<string, { items: number; totalCost: number }>();

      costViewData.items.forEach(item => {
        const tags = item.tags.length > 0 ? item.tags : ['Uncategorized'];
        tags.forEach(tag => {
          const current = catMap.get(tag) || { items: 0, totalCost: 0 };
          current.items += 1;
          current.totalCost += item.total_amount;
          catMap.set(tag, current);
        });
      });

      const totalCostSum = Array.from(catMap.values()).reduce((sum, c) => sum + c.totalCost, 0);

      return Array.from(catMap.entries())
        .map(([category, stats]) => ({
          name: category,
          value: stats.totalCost,
          percent: totalCostSum > 0 ? (stats.totalCost / totalCostSum) * 100 : 0,
          items: stats.items
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }
    // Fallback
    return topCategories.slice(0, 5).map(c => ({
      name: c.category,
      value: c.totalCost,
      percent: c.percentOfQuote,
      items: c.itemCount
    }));
  }, [costViewData, topCategories]);

  // BOM breakdown from bomDetailData (same logic as BOMComparisonView)
  // Shows main BOMs (level 0) from each instance
  const bomBreakdown = useMemo(() => {
    if (bomDetailData?.bom_instances) {
      return bomDetailData.bom_instances.map((instance, idx) => {
        // Get the main BOM (level 0) from hierarchy
        const mainBOM = instance.hierarchy.find(h => h.bom_level === 0);
        if (!mainBOM) return null;

        const instanceLabel = bomDetailData.bom_instances.length > 1 ? ` (#${instance.instance_index})` : '';

        return {
          code: mainBOM.bom_code + instanceLabel,
          name: mainBOM.bom_name,
          quantity: mainBOM.bom_quantity,
          itemsSubtotal: mainBOM.total_item_cost,
          bomAdditionalCost: mainBOM.total_bom_ac_quoted,
          total: mainBOM.total_quoted_amount,
          percent: totalQuoteValue > 0 ? (mainBOM.total_quoted_amount / totalQuoteValue) * 100 : 0
        };
      }).filter(Boolean) as Array<{
        code: string;
        name: string;
        quantity: number;
        itemsSubtotal: number;
        bomAdditionalCost: number;
        total: number;
        percent: number;
      }>;
    }
    return [];
  }, [bomDetailData, totalQuoteValue]);

  // Check if there are volume scenarios (multiple BOM instances)
  const hasVolumeScenarios = useMemo(() => {
    return (bomDetailData?.bom_instances?.length || 0) > 1;
  }, [bomDetailData]);

  // Additional Costs breakdown from real API data
  const additionalCostsData = useMemo(() => {
    // Item Level AC - from costViewData.items
    const itemLevelBreakdown = new Map<string, { total: number; count: number }>();
    let itemLevelTotal = 0;

    if (costViewData?.items) {
      costViewData.items.forEach(item => {
        if (item.total_additional_cost > 0) {
          itemLevelTotal += item.total_additional_cost;
          item.additional_costs.forEach(ac => {
            const existing = itemLevelBreakdown.get(ac.cost_name) || { total: 0, count: 0 };
            existing.total += ac.total_amount;
            existing.count += 1;
            itemLevelBreakdown.set(ac.cost_name, existing);
          });
        }
      });
    }

    const itemLevel = {
      total: itemLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (itemLevelTotal / totalQuoteValue) * 100 : 0,
      breakdown: Array.from(itemLevelBreakdown.entries())
        .map(([costName, data]) => ({ costName, total: data.total, count: data.count }))
        .sort((a, b) => b.total - a.total)
    };

    // BOM Level AC - sum from bomBreakdown
    const bomLevelTotal = bomBreakdown.reduce((sum, bom) => sum + bom.bomAdditionalCost, 0);
    const bomLevel = {
      total: bomLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (bomLevelTotal / totalQuoteValue) * 100 : 0
    };

    // Overall Level AC - from costViewData.overall_additional_costs
    const overallBreakdown: Array<{ costName: string; original: number; agreed: number }> = [];
    let overallLevelTotal = 0;

    if (costViewData?.overall_additional_costs) {
      costViewData.overall_additional_costs.forEach(ac => {
        overallBreakdown.push({
          costName: ac.cost_name,
          original: ac.calculated_amount,
          agreed: ac.quoted_amount
        });
        overallLevelTotal += ac.quoted_amount;
      });
    }

    const overallLevel = {
      total: overallLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (overallLevelTotal / totalQuoteValue) * 100 : 0,
      breakdown: overallBreakdown
    };

    // Total
    const totalAdditionalCosts = itemLevelTotal + bomLevelTotal + overallLevelTotal;

    return {
      totalAdditionalCosts,
      percentOfBaseQuote: totalQuoteValue > 0 ? (totalAdditionalCosts / totalQuoteValue) * 100 : 0,
      itemLevel,
      bomLevel,
      overallLevel
    };
  }, [costViewData, bomBreakdown, totalQuoteValue]);

  return (
    <div className="space-y-6">
      {/* Section 1: Quote Overview */}
      <Card className="border-gray-300">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quote Overview</h3>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Quote Value</div>
              <div className="text-3xl font-bold text-gray-900">{currencySymbol}{totalQuoteValue.toLocaleString()}</div>
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
              onClick={() => navigateToTab('items', { targetView: 'cost' })}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Items in Cost View →
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
                    <td className="px-3 py-2.5 text-right text-gray-700">{currencySymbol}{item.cost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-purple-700">{currencySymbol}{item.additionalCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{currencySymbol}{item.totalCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{item.percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={5} className="px-3 py-2.5 text-gray-900">Top 10 Subtotal:</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {currencySymbol}{top10Items.reduce((sum, item) => sum + item.cost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-purple-700">
                    {currencySymbol}{top10Items.reduce((sum, item) => sum + item.additionalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {currencySymbol}{top10Items.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString()}
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
                onClick={() => navigateToTab('items', { targetView: 'vendor' })}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Vendor Analysis →
              </button>
            </div>

            <div className="space-y-3">
              {vendorBreakdown.map((vendor, idx) => (
                <div
                  key={vendor.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigateToTab('items', { targetView: 'vendor', selectedVendor: vendor.name })}
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
                    <div className="font-bold text-gray-900">{currencySymbol}{vendor.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{vendor.percent.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-gray-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
              <button
                onClick={() => navigateToTab('items', { targetView: 'category' })}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Category Analysis →
              </button>
            </div>

            <div className="space-y-3">
              {categoryBreakdown.map((category, idx) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigateToTab('items', { targetView: 'category', selectedCategory: category.name })}
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
                    <div className="font-bold text-gray-900">{currencySymbol}{category.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">{category.percent.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <td className="px-3 py-2.5 text-right text-gray-700">{currencySymbol}{bom.itemsSubtotal.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{currencySymbol}{bom.bomAdditionalCost.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{currencySymbol}{bom.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{bom.percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-gray-900">Total:</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {currencySymbol}{bomBreakdown.reduce((sum, bom) => sum + bom.itemsSubtotal, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {currencySymbol}{bomBreakdown.reduce((sum, bom) => sum + bom.bomAdditionalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {currencySymbol}{bomBreakdown.reduce((sum, bom) => sum + bom.total, 0).toLocaleString()}
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
              <div className="text-2xl font-bold text-gray-900">{currencySymbol}{additionalCostsData.totalAdditionalCosts.toLocaleString()}</div>
              <div className="text-xs text-gray-600">{additionalCostsData.percentOfBaseQuote.toFixed(2)}% of quote</div>
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
                  <div className="text-xl font-bold text-gray-900">{currencySymbol}{additionalCostsData.itemLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCostsData.itemLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('items', { targetView: 'additional-costs' })}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View Additional Costs →
                  </button>
                </div>
              </div>
              {additionalCostsData.itemLevel.breakdown.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {additionalCostsData.itemLevel.breakdown.map((ac) => (
                    <div key={ac.costName} className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-600">{ac.costName}</div>
                      <div className="text-lg font-bold text-gray-900">{currencySymbol}{ac.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">{ac.count} items</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BOM Level Additional Costs */}
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">BOM Level Additional Costs</h4>
                  <p className="text-xs text-gray-600">Costs added at BOM level</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{currencySymbol}{additionalCostsData.bomLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCostsData.bomLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('bom', { targetView: 'comparison' })}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View BOM Analysis →
                  </button>
                </div>
              </div>
              {bomBreakdown.filter(bom => bom.bomAdditionalCost > 0).length > 0 && (
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
                        <div className="font-bold text-gray-900">{currencySymbol}{bom.bomAdditionalCost.toLocaleString()}</div>
                        <div className="text-xs text-gray-600">{bom.total > 0 ? ((bom.bomAdditionalCost / bom.total) * 100).toFixed(2) : 0}% of BOM total</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overall Level Additional Costs */}
            <div className="border-l-4 border-pink-500 pl-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">Overall Level Additional Costs</h4>
                  <p className="text-xs text-gray-600">Costs added at quote level</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{currencySymbol}{additionalCostsData.overallLevel.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{additionalCostsData.overallLevel.percentOfQuote.toFixed(2)}% of quote</div>
                  <button
                    onClick={() => navigateToTab('overall', {})}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                  >
                    View Overall Tab →
                  </button>
                </div>
              </div>
              {additionalCostsData.overallLevel.breakdown.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {additionalCostsData.overallLevel.breakdown.map((ac) => (
                    <div key={ac.costName} className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-600">{ac.costName}</div>
                      <div className="flex justify-between items-end mt-1">
                        <div>
                          <div className="text-xs text-gray-500">Original:</div>
                          <div className="font-bold text-gray-700">{currencySymbol}{ac.original.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Agreed:</div>
                          <div className="font-bold text-gray-900">{currencySymbol}{ac.agreed.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
