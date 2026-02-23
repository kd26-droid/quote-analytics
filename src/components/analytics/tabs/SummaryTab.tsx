import { useMemo, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import type { TopItemsAnalytics, Category, Vendor } from '../../../types/quote.types';
import type { TabType, NavigationContext } from '../QuoteAnalyticsDashboard';
import type { CostViewData, BOMDetailData, OverallACData } from '../../../services/api';
import { AttributeTooltip } from '../../ui/attribute-tooltip';

interface SummaryTabProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  bomDetailData?: BOMDetailData | null;
  overallACData?: OverallACData | null;
  totalQuoteValue: number;
  totalItems: number;
  topCategories: Category[];
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  currencySymbol?: string;
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2'];

// Shared AC cost row component
function ACCostRow({ ac, currencySymbol }: {
  ac: { costName: string; total: number; count?: number; isCalculated: boolean; costCategory?: 'RECURRING' | 'ONE_TIME'; isHiddenFromCustomer?: boolean };
  currencySymbol: string;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded ${ac.isCalculated ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-medium truncate ${ac.isCalculated ? 'text-gray-900' : 'text-gray-400'}`}>
          {ac.costName}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {ac.isCalculated ? (
            <span title="Included in final calculation" className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded cursor-help">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Included
            </span>
          ) : (
            <span title="Not included in final calculation (input only)" className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded cursor-help">
              Input only
            </span>
          )}
          {ac.costCategory === 'RECURRING' && (
            <span title="Recurring cost — applied per unit" className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded cursor-help">
              Recurring
            </span>
          )}
          {ac.costCategory === 'ONE_TIME' && (
            <span title="One-time cost — applied once" className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded cursor-help">
              One-time
            </span>
          )}
          {ac.isHiddenFromCustomer && (
            <span title="Hidden from customer" className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded cursor-help">
              Hidden
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {ac.count !== undefined && (
          <span className="text-xs text-gray-400">{ac.count} items</span>
        )}
        <span className={`text-sm font-bold font-mono ${ac.isCalculated ? 'text-gray-900' : 'text-gray-400'}`}>
          {currencySymbol}{ac.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// Accordion component for each AC level
function ACAccordion({ title, subtitle, total, percentOfQuote, breakdown, currencySymbol, borderColor, bgColor, onNavigate, navigateLabel }: {
  title: string;
  subtitle: string;
  total: number;
  percentOfQuote: number;
  breakdown: Array<{ costName: string; total: number; count?: number; isCalculated: boolean; costCategory?: 'RECURRING' | 'ONE_TIME'; isHiddenFromCustomer?: boolean }>;
  currencySymbol: string;
  borderColor: string;
  bgColor: string;
  onNavigate: () => void;
  navigateLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const includedCount = breakdown.filter(b => b.isCalculated).length;
  const inputCount = breakdown.length - includedCount;

  return (
    <div className={`border-l-4 ${borderColor} rounded-r-lg overflow-hidden`}>
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 ${bgColor} hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="text-left">
            <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
            <p className="text-xs text-gray-500">{subtitle} — {includedCount} included{inputCount > 0 ? `, ${inputCount} input only` : ''}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{currencySymbol}{total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{percentOfQuote.toFixed(2)}% of quote</div>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="bg-white border-t border-gray-200">
          {breakdown.length > 0 ? (
            <div className="divide-y divide-gray-100 px-2 py-1">
              {breakdown.map((ac) => (
                <ACCostRow key={ac.costName} ac={ac} currencySymbol={currencySymbol} />
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">No additional costs at this level</div>
          )}
          <div className="px-4 py-2 border-t border-gray-100">
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {navigateLabel} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SummaryTab({
  data,
  costViewData,
  bomDetailData,
  overallACData,
  totalQuoteValue,
  totalItems,
  topCategories,
  topVendors,
  navigateToTab,
  currencySymbol = '₹'
}: SummaryTabProps) {

  // Top 10 items from real API data (costViewData)
  // % of Quote uses backend-computed percent_of_quote field
  const top10Items = useMemo(() => {
    if (costViewData?.items) {
      // Sort by total_amount descending and take top 10
      return [...costViewData.items]
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 10)
        .map(item => ({
          itemCode: item.item_code,
          itemName: item.item_name,
          cost: item.base_rate * item.quantity, // Base cost = base_rate × quantity (before AC)
          additionalCost: item.total_additional_cost,
          totalCost: item.total_amount,
          percent: item.percent_of_quote,
          vendor: item.vendor_name || 'Unknown',
          category: item.tags?.[0] || 'Uncategorized',
          attributes: item.attributes
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
      category: item.category || 'Uncategorized',
      attributes: undefined as Array<{ spec_name: string; spec_value: string }> | undefined
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

  // Unique vendor count from real API data
  const uniqueVendorCount = useMemo(() => {
    if (costViewData?.filters?.vendor_list) {
      return costViewData.filters.vendor_list.length;
    }
    if (costViewData?.items) {
      const vendorIds = new Set<string>();
      costViewData.items.forEach(item => {
        if (item.vendor_id) {
          vendorIds.add(item.vendor_id);
        }
      });
      return vendorIds.size;
    }
    return topVendors.length;
  }, [costViewData, topVendors]);

  // Unique category count from real API data
  const uniqueCategoryCount = useMemo(() => {
    if (costViewData?.filters?.tag_list) {
      return costViewData.filters.tag_list.length;
    }
    if (costViewData?.items) {
      const tags = new Set<string>();
      costViewData.items.forEach(item => {
        if (item.tags.length > 0) {
          item.tags.forEach(tag => tags.add(tag));
        }
      });
      return tags.size;
    }
    return topCategories.length;
  }, [costViewData, topCategories]);

  // BOM breakdown from bomDetailData — includes all sub-BOM costs rolled up
  const bomBreakdown = useMemo(() => {
    if (bomDetailData?.bom_instances) {
      return bomDetailData.bom_instances.map((instance) => {
        const mainBOM = instance.hierarchy.find(h => h.bom_level === 0);
        if (!mainBOM) return null;

        const instanceLabel = bomDetailData.bom_instances.length > 1 ? ` (#${instance.instance_index})` : '';

        // Sum across ALL hierarchy levels (main + sub + sub-sub)
        const itemsSubtotal = instance.hierarchy.reduce((sum, h) => sum + h.total_item_cost, 0);
        const bomAdditionalCost = instance.hierarchy.reduce((sum, h) => sum + h.total_bom_ac_quoted, 0);
        const total = itemsSubtotal + bomAdditionalCost;

        return {
          code: mainBOM.bom_code + instanceLabel,
          name: mainBOM.bom_name,
          quantity: mainBOM.bom_quantity,
          itemsSubtotal,
          bomAdditionalCost,
          total,
          percent: totalQuoteValue > 0 ? (total / totalQuoteValue) * 100 : 0
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

  // Shared type for AC breakdown entries
  type ACBreakdownEntry = {
    costName: string;
    total: number;
    count?: number;
    isCalculated: boolean;
    costCategory?: 'RECURRING' | 'ONE_TIME';
    isHiddenFromCustomer?: boolean;
  };

  // Additional Costs breakdown from real API data
  const additionalCostsData = useMemo(() => {
    // Item Level AC - from costViewData.items
    const itemLevelBreakdown = new Map<string, ACBreakdownEntry>();
    let itemLevelTotal = 0;

    if (costViewData?.items) {
      costViewData.items.forEach(item => {
        itemLevelTotal += item.total_additional_cost;
        item.additional_costs.forEach(ac => {
          const existing = itemLevelBreakdown.get(ac.cost_name) || {
            costName: ac.cost_name, total: 0, count: 0,
            isCalculated: ac.is_calculated,
            costCategory: ac.cost_category,
            isHiddenFromCustomer: ac.is_hidden_from_customer,
          };
          existing.total += ac.total_amount;
          existing.count = (existing.count || 0) + 1;
          itemLevelBreakdown.set(ac.cost_name, existing);
        });
      });
    }

    const itemLevel = {
      total: itemLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (itemLevelTotal / totalQuoteValue) * 100 : 0,
      breakdown: Array.from(itemLevelBreakdown.values())
        .sort((a, b) => {
          if (a.isCalculated !== b.isCalculated) return a.isCalculated ? -1 : 1;
          return b.total - a.total;
        })
    };

    // BOM Level AC - break down by individual cost names from recurring_costs
    const bomCostBreakdown = new Map<string, ACBreakdownEntry>();
    let bomLevelTotal = 0;

    if (bomDetailData?.bom_instances) {
      bomDetailData.bom_instances.forEach(instance => {
        instance.hierarchy.forEach(level => {
          level.recurring_costs.forEach(rc => {
            const existing = bomCostBreakdown.get(rc.cost_name) || {
              costName: rc.cost_name, total: 0,
              isCalculated: rc.is_calculated,
              costCategory: rc.cost_category,
              isHiddenFromCustomer: rc.is_hidden_from_customer,
            };
            existing.total += rc.quoted_amount;
            bomCostBreakdown.set(rc.cost_name, existing);
          });
          bomLevelTotal += level.total_bom_ac_quoted;
        });
      });
    }

    const bomLevel = {
      total: bomLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (bomLevelTotal / totalQuoteValue) * 100 : 0,
      breakdown: Array.from(bomCostBreakdown.values())
        .sort((a, b) => {
          if (a.isCalculated !== b.isCalculated) return a.isCalculated ? -1 : 1;
          return b.total - a.total;
        })
    };

    // Overall Level AC - from overallACData (separate API, has is_calculated)
    const overallBreakdown: ACBreakdownEntry[] = [];
    let overallLevelTotal = 0;

    if (overallACData?.overall_additional_costs) {
      const allCosts = [
        ...(overallACData.overall_additional_costs.included_in_total?.costs || []),
        ...(overallACData.overall_additional_costs.display_only?.costs || []),
      ];
      allCosts.forEach(ac => {
        overallBreakdown.push({
          costName: ac.cost_name,
          total: ac.quoted_amount,
          isCalculated: ac.is_calculated,
          costCategory: ac.cost_category,
          isHiddenFromCustomer: ac.is_hidden_from_customer,
        });
        if (ac.is_calculated) {
          overallLevelTotal += ac.quoted_amount;
        }
      });
    } else if (costViewData?.overall_additional_costs) {
      costViewData.overall_additional_costs.forEach(ac => {
        overallBreakdown.push({
          costName: ac.cost_name,
          total: ac.cost_total,
          isCalculated: true,
        });
        overallLevelTotal += ac.cost_total;
      });
    }

    overallBreakdown.sort((a, b) => {
      if (a.isCalculated !== b.isCalculated) return a.isCalculated ? -1 : 1;
      return b.total - a.total;
    });

    const overallLevel = {
      total: overallLevelTotal,
      percentOfQuote: totalQuoteValue > 0 ? (overallLevelTotal / totalQuoteValue) * 100 : 0,
      breakdown: overallBreakdown
    };

    const totalAdditionalCosts = itemLevelTotal + bomLevelTotal + overallLevelTotal;

    return {
      totalAdditionalCosts,
      percentOfBaseQuote: totalQuoteValue > 0 ? (totalAdditionalCosts / totalQuoteValue) * 100 : 0,
      itemLevel,
      bomLevel,
      overallLevel
    };
  }, [costViewData, bomDetailData, overallACData, totalQuoteValue]);

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
              <div className="text-3xl font-bold text-gray-900">{uniqueVendorCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Categories</div>
              <div className="text-3xl font-bold text-gray-900">{uniqueCategoryCount}</div>
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
                    <td className="px-3 py-2.5 font-mono text-gray-900 font-medium">
                      <AttributeTooltip attributes={item.attributes}>
                        {item.itemCode}
                      </AttributeTooltip>
                    </td>
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

      {/* Section 5: Additional Costs - Accordion Breakdown */}
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

          <div className="space-y-3">
            {/* Item Level Accordion */}
            <ACAccordion
              title="Item Level Additional Costs"
              subtitle="Costs added at individual item level"
              total={additionalCostsData.itemLevel.total}
              percentOfQuote={additionalCostsData.itemLevel.percentOfQuote}
              breakdown={additionalCostsData.itemLevel.breakdown}
              currencySymbol={currencySymbol}
              borderColor="border-blue-500"
              bgColor="bg-blue-50"
              onNavigate={() => navigateToTab('items', { targetView: 'additional-costs' })}
              navigateLabel="View Additional Costs"
            />

            {/* BOM Level Accordion */}
            <ACAccordion
              title="BOM Level Additional Costs"
              subtitle="Costs added at BOM level (all BOMs + sub-BOMs)"
              total={additionalCostsData.bomLevel.total}
              percentOfQuote={additionalCostsData.bomLevel.percentOfQuote}
              breakdown={additionalCostsData.bomLevel.breakdown}
              currencySymbol={currencySymbol}
              borderColor="border-purple-500"
              bgColor="bg-purple-50"
              onNavigate={() => navigateToTab('bom', { targetView: 'comparison' })}
              navigateLabel="View BOM Analysis"
            />

            {/* Overall Level Accordion */}
            <ACAccordion
              title="Overall Level Additional Costs"
              subtitle="Costs added at quote level"
              total={additionalCostsData.overallLevel.total}
              percentOfQuote={additionalCostsData.overallLevel.percentOfQuote}
              breakdown={additionalCostsData.overallLevel.breakdown}
              currencySymbol={currencySymbol}
              borderColor="border-pink-500"
              bgColor="bg-pink-50"
              onNavigate={() => navigateToTab('overall', {})}
              navigateLabel="View Overall Tab"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
