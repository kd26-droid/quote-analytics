import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { SearchableSelect } from '../../ui/searchable-select';
import type { TopItemsAnalytics } from '../../../types/quote.types';

interface TopItemsChartProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  totalItems: number;
  topCategories?: Array<{ category: string; itemCount: number; totalCost: number; percentOfQuote: number }>;
  topVendors?: Array<{ vendorName: string; itemCount: number; totalValue: number; percentOfQuote: number }>;
  additionalCosts?: {
    itemLevel: { total: number; percentOfQuote: number; breakdown: Array<{ costName: string; total: number; count: number }> };
    bomLevel: { total: number; percentOfQuote: number; breakdown: Array<{ bomCode: string; bomName: string; total: number; percentOfBom: number }> };
    overallLevel: { total: number; percentOfQuote: number; breakdown: Array<{ costName: string; original: number; agreed: number }> };
    totalAdditionalCosts: number;
    percentOfBaseQuote: number;
  };
  bomCostComparison?: Array<{
    bomCode: string;
    bomName: string;
    itemsSubtotal: number;
    bomAdditionalCosts: number;
    bomTotalWithAC: number;
    percentOfQuote: number;
  }>;
  vendorRateDeviation?: {
    averageMarkup: number;
    items: Array<{
      itemCode: string;
      vendorRate: number;
      baseRate: number;
      markup: number;
      markupAmount: number;
    }>;
    highestMarkupItem: { itemCode: string; markup: number };
    lowestMarkupItem: { itemCode: string; markup: number };
    itemsAbove20Percent: number;
    itemsBelow10Percent: number;
  };
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'];

// Helper function to get mock item-level additional costs
const getItemAdditionalCost = (itemCode: string, totalCost: number): number => {
  // Mock: Some items have additional costs (coating, testing, installation, etc.)
  const hasAdditionalCost = itemCode.includes('MOTOR') || itemCode.includes('PUMP') || itemCode.includes('VALVE');
  if (hasAdditionalCost) {
    // Generate a deterministic percentage based on item code (5-15%)
    let hash = 0;
    for (let i = 0; i < itemCode.length; i++) {
      hash = ((hash << 5) - hash) + itemCode.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const percentage = 0.05 + (Math.abs(hash) % 100) / 1000; // 5% to 15%
    return Math.round(totalCost * percentage);
  }
  return 0;
};

// Calculate BOM summary with item counts
const getBOMSummary = (items: TopItemsAnalytics['overall']) => {
  const summary: Record<string, { count: number; total: number; items: typeof items }> = {};

  items.forEach(item => {
    const mainBom = item.bomPath.split('.')[0];
    if (!summary[mainBom]) {
      summary[mainBom] = { count: 0, total: 0, items: [] };
    }
    summary[mainBom].count++;
    summary[mainBom].total += item.totalCost;
    summary[mainBom].items.push(item);

    // Also track sub-BOMs
    if (!summary[item.bomPath]) {
      summary[item.bomPath] = { count: 0, total: 0, items: [] };
    }
    summary[item.bomPath].count++;
    summary[item.bomPath].total += item.totalCost;
    summary[item.bomPath].items.push(item);
  });

  return summary;
};

export default function TopItemsChart({ data, totalQuoteValue, totalItems, topCategories, topVendors, additionalCosts, bomCostComparison, vendorRateDeviation }: TopItemsChartProps) {
  const [selectedBOM, setSelectedBOM] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'total' | 'perUnit'>('total');
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null);
  const [keyFindingsCollapsed, setKeyFindingsCollapsed] = useState(false);
  const [expandedBOMCosts, setExpandedBOMCosts] = useState<string | null>(null);
  const [keyFindingFilter, setKeyFindingFilter] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const bomSummary = useMemo(() => getBOMSummary(data.overall), [data.overall]);

  // Check if quote has BOMs or just flat items
  const hasBOMs = useMemo(() => {
    return data.overall.some(item => item.bomPath && item.bomPath !== '');
  }, [data.overall]);

  // Build BOM hierarchy with counts - filtered by vendor/category
  const bomHierarchy = useMemo(() => {
    // First, filter items by vendor and category
    let relevantItems = data.overall;

    if (selectedVendor !== 'all') {
      relevantItems = relevantItems.filter(item => item.vendor === selectedVendor);
    }

    if (selectedCategory !== 'all' && topCategories) {
      // Filter by category if applicable
    }

    // Build BOM summary from relevant items only
    const filteredBomSummary = getBOMSummary(relevantItems);

    const hierarchy: { value: string; label: string; count: number; total: number }[] = [
      { value: 'all', label: 'All BOMs', count: relevantItems.length, total: relevantItems.reduce((sum, item) => sum + item.totalCost, 0) }
    ];

    Object.keys(filteredBomSummary).sort().forEach(bomPath => {
      const level = bomPath.split('.').length;
      hierarchy.push({
        value: bomPath,
        label: `BOM ${bomPath}`,
        count: filteredBomSummary[bomPath].count,
        total: filteredBomSummary[bomPath].total
      });
    });

    return hierarchy;
  }, [data.overall, selectedVendor, selectedCategory, topCategories]);

  // Get unique vendors and categories from the data
  const uniqueVendors = useMemo(() => {
    const vendors = Array.from(new Set(data.overall.map(item => item.vendor))).sort();
    return vendors;
  }, [data.overall]);

  // Get all items for item filter dropdown
  const allItems = useMemo(() => {
    return data.overall.map(item => ({
      code: item.itemCode,
      name: item.itemName
    })).sort((a, b) => a.code.localeCompare(b.code));
  }, [data.overall]);

  // Filter items based on BOM, Vendor, Category, and Key Finding
  const filteredItems = useMemo(() => {
    let items = data.overall;

    // Filter by BOM
    if (selectedBOM !== 'all') {
      items = bomSummary[selectedBOM]?.items || [];
    }

    // Filter by Vendor
    if (selectedVendor !== 'all') {
      items = items.filter(item => item.vendor === selectedVendor);
    }

    // Filter by Category (if categories data exists)
    if (selectedCategory !== 'all' && topCategories) {
      // Note: The actual items don't have category field in mock data
      // This would need to be mapped based on item names/codes
      // For now, we'll keep this placeholder
    }

    // Filter by specific Item
    if (selectedItem !== 'all') {
      items = items.filter(item => item.itemCode === selectedItem);
    }

    // Filter by Key Finding
    if (keyFindingFilter) {
      if (keyFindingFilter === 'top3') {
        items = items.slice(0, 3);
      } else if (keyFindingFilter === 'top1') {
        items = items.slice(0, 1);
      }
    }

    // Always sort by cost descending
    return [...items].sort((a, b) => b.totalCost - a.totalCost);
  }, [selectedBOM, selectedVendor, selectedCategory, selectedItem, keyFindingFilter, data.overall, bomSummary, topCategories]);

  // Calculate totals and insights for filtered data
  const filteredInsights = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + item.totalCost, 0);
    const percent = ((total / totalQuoteValue) * 100).toFixed(1);
    const top3 = filteredItems.slice(0, 3).reduce((sum, item) => sum + item.totalCost, 0);
    const top3Percent = ((top3 / totalQuoteValue) * 100).toFixed(1);

    return {
      total,
      percent,
      top3Total: top3,
      top3Percent,
      count: filteredItems.length,
      mostExpensive: filteredItems[0]?.itemCode || '',
      mostExpensiveName: filteredItems[0]?.itemName || '',
      mostExpensiveCost: filteredItems[0]?.totalCost || 0
    };
  }, [filteredItems, totalQuoteValue]);

  // Remaining items calculation
  const restOfQuote = totalQuoteValue - data.insights.top10Total;
  const restPercent = ((restOfQuote / totalQuoteValue) * 100).toFixed(1);

  // Calculate filtered additional costs based on selected BOM
  const filteredAdditionalCosts = useMemo(() => {
    if (!additionalCosts) return null;

    if (selectedBOM === 'all') {
      return additionalCosts;
    }

    const mainBOM = selectedBOM.split('.')[0];

    // Filter BOM-level costs for selected BOM
    const filteredBomLevel = additionalCosts.bomLevel.breakdown.filter(b => b.bomCode === mainBOM);
    const bomLevelTotal = filteredBomLevel.reduce((sum, b) => sum + b.total, 0);

    // Estimate item-level costs for this BOM (proportional to items in this BOM)
    const bomItemCount = filteredItems.length;
    const totalItemCount = data.overall.length;
    const itemLevelTotal = (additionalCosts.itemLevel.total * bomItemCount) / totalItemCount;

    // Overall costs don't change per BOM (they're quote-wide)
    const totalFiltered = itemLevelTotal + bomLevelTotal + additionalCosts.overallLevel.total;

    return {
      totalAdditionalCosts: totalFiltered,
      percentOfBaseQuote: ((totalFiltered / totalQuoteValue) * 100).toFixed(1),
      itemLevel: {
        total: itemLevelTotal,
        percentOfQuote: ((itemLevelTotal / totalQuoteValue) * 100).toFixed(1),
        breakdown: additionalCosts.itemLevel.breakdown
      },
      bomLevel: {
        total: bomLevelTotal,
        percentOfQuote: ((bomLevelTotal / totalQuoteValue) * 100).toFixed(1),
        breakdown: filteredBomLevel
      },
      overallLevel: additionalCosts.overallLevel
    };
  }, [additionalCosts, selectedBOM, filteredItems.length, data.overall.length, totalQuoteValue]);

  // Scroll to table and highlight item
  const scrollToItem = (itemCode: string) => {
    setHighlightedItem(itemCode);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    setTimeout(() => setHighlightedItem(null), 3000);
  };

  // Chart data
  const chartData = filteredItems.map(item => ({
    ...item,
    displayValue: displayMode === 'total' ? item.totalCost : item.quotedRate
  }));

  return (
    <div className="space-y-6">
      {/* Summary Card - Shows Total Quote Context - Hide when filtering by specific item */}
      {selectedItem === 'all' && (
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">Total Quote Value</div>
              <div className="text-3xl font-bold text-gray-900">${totalQuoteValue.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Sum of all {totalItems} items</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-600 mb-1">10 Costliest Items</div>
              <div className="text-3xl font-bold text-blue-600">${data.insights.top10Total.toLocaleString()}</div>
              <div className="text-xs text-blue-600 mt-1">{data.insights.top10Percent}% of total quote</div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${data.insights.top10Percent}%` }}></div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">Other {totalItems - 10} Items</div>
              <div className="text-3xl font-bold text-gray-900">${restOfQuote.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{restPercent}% of total quote</div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${restPercent}%` }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          {keyFindingFilter && (
            <button
              onClick={() => setKeyFindingFilter(null)}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
            >
              ✕ Clear Key Finding Filter
            </button>
          )}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">BOM:</label>
            <SearchableSelect
              value={selectedBOM}
              onChange={setSelectedBOM}
              options={bomHierarchy.map(bom => ({
                value: bom.value,
                label: `${bom.label} (${bom.count} items - $${(bom.total / 1000).toFixed(0)}k)`
              }))}
              placeholder="Search BOMs..."
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Vendor:</label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
            >
              <option value="all">All Vendors</option>
              {uniqueVendors.map(vendor => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </div>

          {topCategories && topCategories.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
              >
                <option value="all">All Categories</option>
                {topCategories.map(cat => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Item:</label>
            <SearchableSelect
              value={selectedItem}
              onChange={setSelectedItem}
              options={[
                { value: 'all', label: `All Items (${allItems.length} total)` },
                ...allItems.map(item => ({
                  value: item.code,
                  label: `${item.code} - ${item.name}`
                }))
              ]}
              placeholder="Search items..."
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[280px]"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <label className="text-sm font-semibold text-gray-700">View:</label>
            <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
              <button
                onClick={() => setDisplayMode('total')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  displayMode === 'total'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Total Cost
              </button>
              <button
                onClick={() => setDisplayMode('perUnit')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  displayMode === 'perUnit'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Quoted Rate (per unit)
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedBOM !== 'all' || selectedVendor !== 'all' || selectedCategory !== 'all' || selectedItem !== 'all') && (
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
            <span className="text-xs font-semibold text-gray-600">Active Filters:</span>
            {selectedBOM !== 'all' && (
              <Badge variant="outline" className="bg-blue-50">
                BOM: {selectedBOM}
                <button onClick={() => setSelectedBOM('all')} className="ml-1 hover:text-red-600">×</button>
              </Badge>
            )}
            {selectedVendor !== 'all' && (
              <Badge variant="outline" className="bg-indigo-50">
                Vendor: {selectedVendor}
                <button onClick={() => setSelectedVendor('all')} className="ml-1 hover:text-red-600">×</button>
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge variant="outline" className="bg-teal-50">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory('all')} className="ml-1 hover:text-red-600">×</button>
              </Badge>
            )}
            {selectedItem !== 'all' && (
              <Badge variant="outline" className="bg-orange-50">
                Item: {selectedItem}
                <button onClick={() => setSelectedItem('all')} className="ml-1 hover:text-red-600">×</button>
              </Badge>
            )}
            <button
              onClick={() => {
                setSelectedBOM('all');
                setSelectedVendor('all');
                setSelectedCategory('all');
                setSelectedItem('all');
              }}
              className="text-xs text-gray-600 hover:text-gray-900 underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Key Insights Section */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setKeyFindingsCollapsed(!keyFindingsCollapsed)}
          >
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
              <span>{keyFindingsCollapsed ? '▶' : '▼'}</span>
              <span>Key Findings</span>
              {selectedBOM !== 'all' && (
                <Badge variant="outline" className="bg-blue-50 font-mono text-xs">BOM {selectedBOM}</Badge>
              )}
              {selectedVendor !== 'all' && (
                <Badge variant="outline" className="bg-indigo-50 text-xs">{selectedVendor}</Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="outline" className="bg-teal-50 text-xs">{selectedCategory}</Badge>
              )}
            </h4>
            <span className="text-xs text-gray-500">{keyFindingsCollapsed ? 'Click to expand' : 'Click to collapse'}</span>
          </div>
          {!keyFindingsCollapsed && (
          <div className="space-y-2 text-xs mt-3">
            {selectedItem !== 'all' ? (
              // Single Item View - Show specific item details
              <>
                {filteredItems.length > 0 && (() => {
                  const item = filteredItems[0];
                  return (
                    <>
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded">
                        <div className="font-bold text-blue-900">Item Details</div>
                        <div className="text-blue-800 mt-1">
                          <span className="font-bold font-mono">{item.itemCode}</span> - {item.itemName}
                        </div>
                        <div className="text-blue-700 text-xs mt-1 flex items-center gap-2 flex-wrap">
                          <span>BOM: <Badge variant="outline" className="font-mono text-xs">{item.bomPath}</Badge></span>
                          {item.category && (
                            <span>Category: <Badge variant="outline" className="bg-teal-100 text-xs">{item.category}</Badge></span>
                          )}
                        </div>
                      </div>

                      <div className="bg-purple-50 border-l-4 border-purple-500 p-2 rounded">
                        <div className="font-bold text-purple-900">Cost Information</div>
                        <div className="text-purple-800 mt-1">
                          Total cost: <span className="font-bold">${item.totalCost.toLocaleString()}</span>
                        </div>
                        <div className="text-purple-700 text-xs mt-1">
                          {item.quantity} {item.unit} @ ${item.quotedRate.toFixed(2)}/{item.unit}
                        </div>
                      </div>

                      <div className="bg-green-50 border-l-4 border-green-500 p-2 rounded">
                        <div className="font-bold text-green-900">Quote Impact</div>
                        <div className="text-green-800 mt-1">
                          Represents <span className="font-bold">{item.percentOfQuote.toFixed(1)}%</span> of total quote
                        </div>
                        <div className="text-green-700 text-xs mt-1">
                          Ranked #{item.rank} by cost out of {totalItems} items
                        </div>
                      </div>

                      <div className="bg-orange-50 border-l-4 border-orange-500 p-2 rounded">
                        <div className="font-bold text-orange-900">Vendor</div>
                        <div className="text-orange-800 mt-1">{item.vendor}</div>
                        <div className="text-orange-700 text-xs mt-1">
                          Category: {item.category}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              // Multiple Items View - Show aggregate insights
              <>
                {/* Finding 1: Total Items View */}
                <div
                  onClick={() => {
                    setKeyFindingFilter(keyFindingFilter === 'all' ? null : 'all');
                    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                  }}
                  className={`bg-blue-50 border-l-4 p-2 rounded hover:bg-blue-100 transition-colors cursor-pointer ${
                    keyFindingFilter === 'all' ? 'border-blue-700 ring-2 ring-blue-300' : 'border-blue-500'
                  }`}
                >
                  <div className="font-bold text-blue-900">
                    {filteredInsights.count} {filteredInsights.count === 1 ? 'Item' : 'Items'}
                    {selectedVendor !== 'all' && ` from ${selectedVendor}`}
                    {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                    {selectedBOM !== 'all' && ` (BOM ${selectedBOM})`}
                  </div>
                  <div className="text-blue-800 mt-1">
                    Total cost: <span className="font-bold">${filteredInsights.total.toLocaleString()}</span>
                  </div>
                  <div className="text-blue-700 text-xs mt-1">
                    Represents {filteredInsights.percent}% of total quote value (${totalQuoteValue.toLocaleString()})
                  </div>
                </div>

                {/* Finding 2: Top 3 Items */}
                {data.overall.length >= 3 && (
                  <div
                    onClick={() => {
                      setKeyFindingFilter(keyFindingFilter === 'top3' ? null : 'top3');
                      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                    }}
                    className={`bg-purple-50 border-l-4 p-2 rounded hover:bg-purple-100 transition-colors cursor-pointer ${
                      keyFindingFilter === 'top3' ? 'border-purple-700 ring-2 ring-purple-300' : 'border-purple-500'
                    }`}
                  >
                    <div className="font-bold text-purple-900">
                      Top 3 Most Expensive
                      {selectedVendor !== 'all' && ` from ${selectedVendor}`}
                      {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                    </div>
                    <div className="text-purple-800 mt-1">
                      Combined cost: <span className="font-bold">${filteredInsights.top3Total.toLocaleString()}</span>
                    </div>
                    <div className="text-purple-700 text-xs mt-1">
                      Represents {filteredInsights.top3Percent}% of total quote value
                    </div>
                  </div>
                )}

                {/* Finding 3: Single Most Expensive */}
                {data.overall.length > 0 && (
                  <div
                    onClick={() => {
                      setKeyFindingFilter(keyFindingFilter === 'top1' ? null : 'top1');
                      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                    }}
                    className={`bg-green-50 border-l-4 p-2 rounded hover:bg-green-100 transition-colors cursor-pointer ${
                      keyFindingFilter === 'top1' ? 'border-green-700 ring-2 ring-green-300' : 'border-green-500'
                    }`}
                  >
                    <div className="font-bold text-green-900">
                      Most Expensive Item
                      {selectedVendor !== 'all' && ` from ${selectedVendor}`}
                      {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                      {selectedBOM !== 'all' && ` (BOM ${selectedBOM})`}
                    </div>
                    <div className="text-green-800 mt-1">
                      <span className="font-bold font-mono">{filteredInsights.mostExpensive}</span> -{' '}
                      <span className="font-bold">${filteredInsights.mostExpensiveCost.toLocaleString()}</span>
                    </div>
                    <div className="text-green-700 text-xs mt-1 truncate">
                      {filteredInsights.mostExpensiveName}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Finding 4: BOM Context (only when viewing all) */}
            {selectedBOM === 'all' && (
              <div className="bg-orange-50 border-l-4 border-orange-500 p-2 rounded hover:bg-orange-100 transition-colors cursor-pointer">
                <div className="font-bold text-orange-900">BOM Distribution</div>
                <div className="text-orange-800 mt-1">
                  Highest concentration: <span className="font-bold">{data.insights.highestConcentration}</span>
                </div>
                <div className="text-orange-700 text-xs mt-1">
                  This BOM path contains {data.insights.itemsInBomA} of the 10 costliest items
                </div>
              </div>
            )}

            {/* Finding 5: Top Vendor */}
            {topVendors && topVendors.length > 0 && (
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-2 rounded hover:bg-indigo-100 transition-colors cursor-pointer">
                <div className="font-bold text-indigo-900">Top Vendor</div>
                <div className="text-indigo-800 mt-1">
                  <span className="font-bold">{topVendors[0].vendorName}</span> - ${(topVendors[0].totalValue / 1000).toFixed(0)}k
                </div>
                <div className="text-indigo-700 text-xs mt-1">
                  {topVendors[0].itemCount} items ({topVendors[0].percentOfQuote}% of total quote)
                </div>
              </div>
            )}

            {/* Finding 6: Top Category */}
            {topCategories && topCategories.length > 0 && (
              <div className="bg-teal-50 border-l-4 border-teal-500 p-2 rounded hover:bg-teal-100 transition-colors cursor-pointer">
                <div className="font-bold text-teal-900">Costliest Category</div>
                <div className="text-teal-800 mt-1">
                  <span className="font-bold">{topCategories[0].category}</span> - ${(topCategories[0].totalCost / 1000).toFixed(0)}k
                </div>
                <div className="text-teal-700 text-xs mt-1">
                  {topCategories[0].itemCount} items ({topCategories[0].percentOfQuote}% of total quote)
                </div>
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart - Full Width */}
      {filteredItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">
              {keyFindingFilter === 'top3' ? '3 Most Expensive Items' :
               keyFindingFilter === 'top1' ? 'Most Expensive Item' :
               selectedBOM === 'all' ? `${filteredItems.length} Costliest Items` : `Items in BOM ${selectedBOM}`}
              {' - '}{displayMode === 'total' ? 'Total Cost' : 'Quoted Rate per Unit'}
            </h4>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="itemCode"
                  type="category"
                  width={120}
                  style={{ fontSize: '12px', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      const itemAdditionalCost = getItemAdditionalCost(item.itemCode, item.totalCost);
                      return (
                        <div className="bg-white p-4 border-2 border-gray-300 rounded-lg shadow-xl max-w-sm">
                          <p className="font-bold text-gray-900 text-base mb-2">{item.itemName}</p>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">Item Code:</span>
                              <span className="font-mono font-semibold">{item.itemCode}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">BOM Path:</span>
                              <Badge variant="outline" className="font-mono">{item.bomPath}</Badge>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">Quantity:</span>
                              <span className="font-semibold">{item.quantity} {item.unit}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">Quoted Rate:</span>
                              <span className="font-semibold">${item.quotedRate.toFixed(2)}/{item.unit}</span>
                            </div>
                            <div className="border-t pt-1.5 mt-1.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-900 font-semibold">Total Cost:</span>
                                <span className="font-bold text-green-600 text-base">${item.totalCost.toLocaleString()}</span>
                              </div>
                            </div>
                            {itemAdditionalCost > 0 && (
                              <div className="flex justify-between gap-4 bg-orange-50 -mx-2 px-2 py-1 rounded">
                                <span className="text-orange-700 font-semibold">+ Item Additional Costs:</span>
                                <span className="font-bold text-orange-600">${itemAdditionalCost.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600">% of Quote:</span>
                              <span className="font-semibold">{item.percentOfQuote.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs">
                              <span className="text-gray-500">Vendor:</span>
                              <span className="text-gray-700">{item.vendor}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="displayValue" name={displayMode === 'total' ? 'Total Cost ($)' : 'Quoted Rate ($/unit)'}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Vendor Rate Deviation Analysis */}
      {vendorRateDeviation && filteredItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Vendor Rate vs Base Rate Analysis</h3>
              <p className="text-sm text-gray-600">
                Understand pricing strategy and profit margins by comparing vendor rates to base rates
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700 mb-1">AVERAGE MARKUP</div>
                <div className="text-2xl font-bold text-emerald-900">{vendorRateDeviation.averageMarkup}%</div>
                <div className="text-xs text-emerald-600 mt-1">Across all items</div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                <div className="text-xs font-semibold text-red-700 mb-1">HIGHEST MARKUP</div>
                <div className="text-2xl font-bold text-red-900">{vendorRateDeviation.highestMarkupItem.markup}%</div>
                <div className="text-xs text-red-600 mt-1">{vendorRateDeviation.highestMarkupItem.itemCode}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-xs font-semibold text-blue-700 mb-1">LOWEST MARKUP</div>
                <div className="text-2xl font-bold text-blue-900">{vendorRateDeviation.lowestMarkupItem.markup}%</div>
                <div className="text-xs text-blue-600 mt-1">{vendorRateDeviation.lowestMarkupItem.itemCode}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                <div className="text-xs font-semibold text-amber-700 mb-1">HIGH MARGIN ITEMS</div>
                <div className="text-2xl font-bold text-amber-900">{vendorRateDeviation.itemsAbove20Percent}</div>
                <div className="text-xs text-amber-600 mt-1">Items with &gt;20% markup</div>
              </div>
            </div>

            {/* Grouped Bar Chart - Vendor Rate vs Base Rate */}
            <Card>
              <CardContent className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Vendor Rate vs Base Rate Comparison</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={filteredItems.map(item => {
                      const vendorItem = vendorRateDeviation.items.find(v => v.itemCode === item.itemCode);
                      const vendorRate = vendorItem?.vendorRate || item.quotedRate * 0.85;
                      const baseRate = vendorItem?.baseRate || item.quotedRate;
                      const markupPercent = vendorItem?.markup || 15;
                      return {
                        itemCode: item.itemCode,
                        itemName: item.itemName,
                        vendorRate: vendorRate,
                        baseRate: baseRate,
                        markupPercent: markupPercent
                      };
                    })}
                    margin={{ top: 30, right: 30, left: 40, bottom: 60 }}
                    barGap={1}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="itemCode"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      tick={{ fontSize: 11, fontFamily: 'monospace' }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const markupAmount = item.baseRate - item.vendorRate;
                          return (
                            <div className="bg-white p-3 border-2 border-gray-300 rounded-lg shadow-xl">
                              <p className="font-bold text-gray-900 text-sm mb-2">{item.itemName}</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between gap-4">
                                  <span className="text-blue-600">Vendor Rate:</span>
                                  <span className="font-bold">${item.vendorRate.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-emerald-600">Base Rate:</span>
                                  <span className="font-bold">${item.baseRate.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-1 flex justify-between gap-4">
                                  <span className="text-orange-600 font-semibold">Markup:</span>
                                  <span className="font-bold">${markupAmount.toFixed(2)} ({item.markupPercent.toFixed(1)}%)</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="vendorRate" name="Vendor Rate (Cost)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="baseRate" name="Base Rate (Price)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Additional Costs Analysis - Only show when quote has BOMs and viewing multiple items */}
      {filteredAdditionalCosts && hasBOMs && !keyFindingFilter && filteredItems.length > 1 && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Complete Additional Costs Analysis
                {selectedBOM !== 'all' && <span className="ml-2 text-blue-600">- BOM {selectedBOM}</span>}
              </h3>
              <p className="text-sm text-gray-600">
                {selectedBOM === 'all'
                  ? 'Breakdown of all additional costs across item-level, BOM-level, and overall project costs'
                  : `Additional costs specific to BOM ${selectedBOM} and its items`
                }
              </p>
            </div>

            {/* Summary Cards - Show only relevant cards based on whether quote has BOMs */}
            <div className={`grid grid-cols-1 gap-4 mb-6 ${hasBOMs ? 'md:grid-cols-4' : 'md:grid-cols-2 max-w-3xl mx-auto'}`}>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="text-xs font-semibold text-orange-700 mb-1">TOTAL ADDITIONAL COSTS</div>
                <div className="text-2xl font-bold text-orange-900">${(filteredAdditionalCosts.totalAdditionalCosts / 1000).toFixed(0)}k</div>
                <div className="text-xs text-orange-600 mt-1">{filteredAdditionalCosts.percentOfBaseQuote}% of base quote</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-xs font-semibold text-blue-700 mb-1">ITEM-LEVEL COSTS</div>
                <div className="text-2xl font-bold text-blue-900">${(filteredAdditionalCosts.itemLevel.total / 1000).toFixed(0)}k</div>
                <div className="text-xs text-blue-600 mt-1">{filteredAdditionalCosts.itemLevel.percentOfQuote}% of quote</div>
              </div>
              {hasBOMs && (
                <>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="text-xs font-semibold text-green-700 mb-1">BOM-LEVEL COSTS</div>
                    <div className="text-2xl font-bold text-green-900">${(filteredAdditionalCosts.bomLevel.total / 1000).toFixed(0)}k</div>
                    <div className="text-xs text-green-600 mt-1">{filteredAdditionalCosts.bomLevel.percentOfQuote}% of quote</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="text-xs font-semibold text-purple-700 mb-1">OVERALL-LEVEL COSTS</div>
                    <div className="text-2xl font-bold text-purple-900">${(filteredAdditionalCosts.overallLevel.total / 1000).toFixed(1)}k</div>
                    <div className="text-xs text-purple-600 mt-1">{filteredAdditionalCosts.overallLevel.percentOfQuote}% of quote</div>
                  </div>
                </>
              )}
            </div>

            {/* Detailed Breakdown - Show only Item-Level if no BOMs, otherwise all three */}
            <div className={`grid grid-cols-1 gap-6 ${hasBOMs ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-2xl mx-auto'}`}>
              {/* Column 1: Item-Level Costs */}
              <div className="border border-blue-200 rounded-lg bg-blue-50 p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-blue-300">
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">1. ITEM-LEVEL COSTS</h4>
                    <p className="text-xs text-blue-700 mt-1">Costs applied to individual items</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-900">${(filteredAdditionalCosts.itemLevel.total / 1000).toFixed(0)}k</div>
                    <div className="text-xs text-blue-600">{filteredAdditionalCosts.itemLevel.percentOfQuote}%</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredAdditionalCosts.itemLevel.breakdown.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-sm">{item.costName}</div>
                          <div className="text-xs text-gray-600 mt-1">Applied to {item.count} items</div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-bold text-blue-700 text-sm">${(item.total / 1000).toFixed(1)}k</div>
                          <div className="text-xs text-gray-500">${(item.total / item.count).toFixed(0)}/item</div>
                        </div>
                      </div>
                      <div className="w-full bg-blue-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(item.total / filteredAdditionalCosts.itemLevel.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-blue-600 mt-1 text-right">
                        {((item.total / filteredAdditionalCosts.itemLevel.total) * 100).toFixed(1)}% of item-level
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: BOM-Level Costs - Only show if quote has BOMs */}
              {hasBOMs && (
              <div className="border border-green-200 rounded-lg bg-green-50 p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-green-300">
                  <div>
                    <h4 className="font-bold text-green-900 text-sm">2. BOM-LEVEL COSTS</h4>
                    <p className="text-xs text-green-700 mt-1">Assembly, QC & testing costs</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-900">${(filteredAdditionalCosts.bomLevel.total / 1000).toFixed(0)}k</div>
                    <div className="text-xs text-green-600">{filteredAdditionalCosts.bomLevel.percentOfQuote}%</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Assembly Labor */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-green-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">Assembly Labor</div>
                        <div className="text-xs text-gray-600 mt-1">Labor for assembling all BOMs</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="font-bold text-green-700 text-sm">${((filteredAdditionalCosts.bomLevel.total * 0.4) / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-gray-500">40% of BOM costs</div>
                      </div>
                    </div>
                    <div className="w-full bg-green-100 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '40%' }}></div>
                    </div>
                    <div className="text-xs text-green-600 mt-1 text-right">40.0% of BOM-level</div>
                  </div>

                  {/* Quality Inspection */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-green-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">Quality Inspection</div>
                        <div className="text-xs text-gray-600 mt-1">QC checks per BOM</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="font-bold text-green-700 text-sm">${((filteredAdditionalCosts.bomLevel.total * 0.3) / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-gray-500">30% of BOM costs</div>
                      </div>
                    </div>
                    <div className="w-full bg-green-100 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                    </div>
                    <div className="text-xs text-green-600 mt-1 text-right">30.0% of BOM-level</div>
                  </div>

                  {/* Testing & Validation */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-green-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">Testing & Validation</div>
                        <div className="text-xs text-gray-600 mt-1">Functional testing of assemblies</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="font-bold text-green-700 text-sm">${((filteredAdditionalCosts.bomLevel.total * 0.3) / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-gray-500">30% of BOM costs</div>
                      </div>
                    </div>
                    <div className="w-full bg-green-100 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                    </div>
                    <div className="text-xs text-green-600 mt-1 text-right">30.0% of BOM-level</div>
                  </div>
                </div>
              </div>
              )}

              {/* Column 3: Overall-Level Costs - Only show if quote has BOMs */}
              {hasBOMs && (
              <div className="border border-purple-200 rounded-lg bg-purple-50 p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-purple-300">
                  <div>
                    <h4 className="font-bold text-purple-900 text-sm">3. OVERALL-LEVEL COSTS</h4>
                    <p className="text-xs text-purple-700 mt-1">Project-wide costs</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-900">${(filteredAdditionalCosts.overallLevel.total / 1000).toFixed(1)}k</div>
                    <div className="text-xs text-purple-600">{filteredAdditionalCosts.overallLevel.percentOfQuote}%</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredAdditionalCosts.overallLevel.breakdown.map((cost, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-purple-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-sm">{cost.costName}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Original: ${(cost.original / 1000).toFixed(1)}k
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-bold text-purple-700 text-sm">${(cost.agreed / 1000).toFixed(1)}k</div>
                          <div className="text-xs text-gray-500">Agreed</div>
                        </div>
                      </div>
                      <div className="w-full bg-purple-100 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${(cost.agreed / filteredAdditionalCosts.overallLevel.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-purple-600 mt-1 text-right">
                        {((cost.agreed / filteredAdditionalCosts.overallLevel.total) * 100).toFixed(1)}% of overall-level
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {/* BOM Cost Summary - Only show when quote has BOMs, viewing all BOMs and not filtered */}
      {bomCostComparison && hasBOMs && selectedBOM === 'all' && !keyFindingFilter && (
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">BOM Cost Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="p-3 text-left font-bold text-gray-700">BOM</th>
                    <th className="p-3 text-right font-bold text-gray-700">Base Cost</th>
                    <th className="p-3 text-right font-bold text-gray-700">Additional Cost</th>
                    <th className="p-3 text-right font-bold text-gray-700">Final Cost</th>
                    <th className="p-3 text-right font-bold text-gray-700">% of Quote</th>
                    <th className="p-3 text-center font-bold text-gray-700">Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {bomCostComparison
                    .filter(bom => {
                      if (selectedBOM === 'all') return true;
                      const mainBOM = selectedBOM.split('.')[0];
                      return bom.bomCode === mainBOM;
                    })
                    .map((bom, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="p-3">
                            <div className="font-bold text-gray-900">BOM {bom.bomCode}</div>
                            <div className="text-xs text-gray-600">{bom.bomName}</div>
                          </td>
                          <td className="p-3 text-right font-semibold text-blue-700">${(bom.itemsSubtotal / 1000).toFixed(0)}k</td>
                          <td className="p-3 text-right font-semibold text-orange-600">+${(bom.bomAdditionalCosts / 1000).toFixed(0)}k</td>
                          <td className="p-3 text-right font-bold text-green-700 text-base">${(bom.bomTotalWithAC / 1000).toFixed(0)}k</td>
                          <td className="p-3 text-right font-semibold text-gray-900">{bom.percentOfQuote}%</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setExpandedBOMCosts(expandedBOMCosts === bom.bomCode ? null : bom.bomCode)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold"
                            >
                              {expandedBOMCosts === bom.bomCode ? 'Hide ▲' : 'View ▼'}
                            </button>
                          </td>
                        </tr>
                        {expandedBOMCosts === bom.bomCode && additionalCosts && (
                          <tr className="bg-orange-50 border-t">
                            <td colSpan={6} className="p-5">
                              <div className="font-bold text-orange-900 mb-4 text-sm">Additional Cost Breakdown:</div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-orange-200">
                                  <div className="text-xs text-gray-600 mb-1">Assembly Labor</div>
                                  <div className="text-xl font-bold text-orange-700">${((bom.bomAdditionalCosts * 0.4) / 1000).toFixed(1)}k</div>
                                  <div className="text-xs text-gray-500 mt-1">40% of additional</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-orange-200">
                                  <div className="text-xs text-gray-600 mb-1">Quality Inspection</div>
                                  <div className="text-xl font-bold text-orange-700">${((bom.bomAdditionalCosts * 0.3) / 1000).toFixed(1)}k</div>
                                  <div className="text-xs text-gray-500 mt-1">30% of additional</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-orange-200">
                                  <div className="text-xs text-gray-600 mb-1">Testing & Validation</div>
                                  <div className="text-xl font-bold text-orange-700">${((bom.bomAdditionalCosts * 0.3) / 1000).toFixed(1)}k</div>
                                  <div className="text-xs text-gray-500 mt-1">30% of additional</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      {filteredItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">
              {keyFindingFilter ? 'Filtered ' : ''}Item Details
              {keyFindingFilter && <span className="ml-2 text-sm text-gray-600">({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})</span>}
            </h4>
            <div className="overflow-x-auto" ref={tableRef}>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="p-3 text-left font-bold text-gray-700">Rank</th>
                    <th className="p-3 text-left font-bold text-gray-700">Item Code</th>
                    <th className="p-3 text-left font-bold text-gray-700">Item Name</th>
                    <th className="p-3 text-left font-bold text-gray-700">BOM</th>
                    <th className="p-3 text-right font-bold text-gray-700">Quantity</th>
                    <th className="p-3 text-left font-bold text-gray-700">Unit</th>
                    <th className="p-3 text-right font-bold text-gray-700">Quoted Rate<br/><span className="text-xs font-normal text-gray-500">(per unit)</span></th>
                    <th className="p-3 text-right font-bold text-gray-700">Total Cost</th>
                    <th className="p-3 text-right font-bold text-gray-700">Additional<br/><span className="text-xs font-normal text-gray-500">Costs</span></th>
                    <th className="p-3 text-right font-bold text-gray-700">% of Total<br/><span className="text-xs font-normal text-gray-500">Quote</span></th>
                    <th className="p-3 text-left font-bold text-gray-700">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const additionalCost = getItemAdditionalCost(item.itemCode, item.totalCost);
                    return (
                    <tr
                      key={item.rank}
                      className={`border-t transition-all duration-500 ${
                        highlightedItem === item.itemCode
                          ? 'bg-yellow-200 ring-2 ring-yellow-400'
                          : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-blue-50`}
                    >
                      <td className="p-3">
                        <span className="text-gray-600 font-medium">#{item.rank}</span>
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold text-blue-700">{item.itemCode}</td>
                      <td className="p-3 max-w-xs">
                        <div className="font-medium text-gray-900" title={item.itemName}>{item.itemName}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs font-semibold">{item.bomPath}</Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-900">{item.quantity}</td>
                      <td className="p-3 text-gray-600 font-medium">{item.unit}</td>
                      <td className="p-3 text-right font-mono text-sm font-semibold text-gray-900">${item.quotedRate.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-green-700 text-base">${item.totalCost.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        {additionalCost > 0 ? (
                          <span className="font-semibold text-orange-600">${additionalCost.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold text-gray-900">{item.percentOfQuote.toFixed(1)}%</div>
                        <div className="mt-1 bg-gray-200 rounded-full h-1.5 w-16 ml-auto">
                          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(item.percentOfQuote * 10, 100)}%` }}></div>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-gray-600 max-w-xs truncate" title={item.vendor}>{item.vendor}</td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
