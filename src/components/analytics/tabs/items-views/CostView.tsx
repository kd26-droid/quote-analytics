import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { ItemViewType } from '../ItemsTab';
import type { CostViewData, CostViewItem } from '../../../../services/api';

interface CostViewProps {
  data: TopItemsAnalytics;
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  totalItems: number;
  navigationContext?: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  setSelectedView?: (view: ItemViewType) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SOURCE_COLORS: Record<string, string> = {
  'PROJECT': '#3b82f6',
  'EVENT': '#8b5cf6',
  'QUOTE': '#10b981'
};

const SOURCE_LABELS: Record<string, string> = {
  'PROJECT': 'Project',
  'EVENT': 'Event',
  'QUOTE': 'Quote'
};

export default function CostView({
  costViewData,
  currencySymbol,
  totalQuoteValue,
  totalItems,
  navigationContext,
  navigateToTab,
  setSelectedView
}: CostViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
  const [costRange, setCostRange] = useState<[number, number]>([0, 100000000]);
  const [sortMode, setSortMode] = useState<'total' | 'base-rate'>('total');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);

  // Calculate max cost for range slider
  const maxCostInData = useMemo(() => {
    return Math.max(...costViewData.items.map(item => item.total_amount), 100000);
  }, [costViewData.items]);

  // Use real API data
  const items = costViewData.items;
  const filters = costViewData.filters;

  // Get all unique BOM paths from data - builds full hierarchy
  // e.g., "BOM-A", "BOM-A > SUB-1", "BOM-A > SUB-1 > CHILD-1"
  // Also track root BOMs separately for correct count
  const { allUniqueBOMPaths, rootBOMCount } = useMemo(() => {
    const bomPathSet = new Set<string>();
    const rootBOMs = new Set<string>();

    items.forEach(item => {
      if (item.bom_path) {
        bomPathSet.add(item.bom_path);

        // Track root BOM (first part of the path)
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);

        // Also add parent paths for hierarchy display
        for (let i = 1; i < parts.length; i++) {
          bomPathSet.add(parts.slice(0, i).join(' > '));
        }
      }
    });

    // Sort by hierarchy depth then alphabetically
    const sortedPaths = Array.from(bomPathSet).sort((a, b) => {
      const depthA = a.split(' > ').length;
      const depthB = b.split(' > ').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    return { allUniqueBOMPaths: sortedPaths, rootBOMCount: rootBOMs.size };
  }, [items]);

  // Auto-select BOM from navigation context
  React.useEffect(() => {
    if (navigationContext?.selectedBOM) {
      setSelectedBOMs([navigationContext.selectedBOM]);
      setFiltersExpanded(true);
    }
  }, [navigationContext]);

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

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply BOM filter - supports hierarchy paths like "BOM-A > SUB-1"
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.startsWith(bom + ' > ') ||
          item.bom_code === bom
        )
      );
    }

    // Apply Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_id && selectedVendors.includes(item.vendor_id)
      );
    }

    // Apply Tags filter
    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Apply Cost Range filter
    result = result.filter(item =>
      item.total_amount >= costRange[0] && item.total_amount <= costRange[1]
    );

    // Apply single item filter (from clicking Highest Cost Item card)
    // Uses item_code so user can see same item from different vendors/BOMs
    if (selectedItemCode) {
      result = result.filter(item => item.item_code === selectedItemCode);
    }

    // Sort based on mode
    if (sortMode === 'total') {
      result.sort((a, b) => b.total_amount - a.total_amount);
    } else {
      result.sort((a, b) => b.base_rate - a.base_rate);
    }

    return result;
  }, [items, selectedBOMs, selectedVendors, selectedTags, costRange, selectedItemCode, sortMode]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedBOMs, selectedVendors, selectedTags, costRange, selectedItemCode, sortMode, pageSize]);

  // Calculate the highest cost item from ALL items (before single item filter)
  // This is used for the clickable card
  const highestCostItem = useMemo(() => {
    const sortedItems = [...items].sort((a, b) => b.total_amount - a.total_amount);
    return sortedItems.length > 0 ? sortedItems[0] : null;
  }, [items]);

  // Calculate insights from filtered data
  const insights = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + item.total_amount, 0);
    const totalAC = filteredItems.reduce((sum, item) => sum + item.total_additional_cost, 0);
    const avgCost = total / filteredItems.length || 0;
    const maxItem = filteredItems.length > 0 ? filteredItems[0] : null;

    return {
      total,
      totalAC,
      percent: (total / totalQuoteValue) * 100,
      avgCost,
      maxCost: highestCostItem?.total_amount || 0,
      maxItemCode: highestCostItem?.item_code || '-',
      count: filteredItems.length
    };
  }, [filteredItems, totalQuoteValue, highestCostItem]);

  // Chart data for cost distribution (top 6 items)
  const costDistributionData = useMemo(() => {
    return filteredItems.slice(0, 6).map(item => ({
      name: item.item_code,
      cost: item.total_amount,
      itemCost: item.total_item_cost,
      ac: item.total_additional_cost,
      percent: item.percent_of_quote
    }));
  }, [filteredItems]);

  // BOM breakdown pie chart data
  const bomBreakdownData = useMemo(() => {
    const bomTotals = new Map<string, number>();
    filteredItems.forEach(item => {
      const bomKey = item.bom_code || 'No BOM';
      bomTotals.set(bomKey, (bomTotals.get(bomKey) || 0) + item.total_amount);
    });

    return Array.from(bomTotals.entries()).map(([bom, cost]) => ({
      name: bom,
      value: cost
    }));
  }, [filteredItems]);

  // Tags display helper - shows count with hover for all, clickable to navigate
  // isNearBottom: for last 4 rows, show dropdown above to prevent cutoff
  const renderTags = (tags: string[], isNearBottom: boolean = false) => {
    if (tags.length === 0) {
      return <span className="text-gray-500 text-xs">Uncategorized</span>;
    }

    if (tags.length === 1) {
      return (
        <button
          onClick={() => {
            if (setSelectedView) {
              setSelectedView('category');
              navigateToTab('items', { selectedCategory: tags[0] });
            }
          }}
          className="text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium"
        >
          {tags[0]}
        </button>
      );
    }

    return (
      <div className="relative group">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Click on "X categories" redirects to Category View
            if (setSelectedView) {
              setSelectedView('category');
            }
          }}
          className="text-xs text-blue-700 hover:text-blue-900 hover:underline cursor-pointer font-medium"
        >
          {tags.length} categories
        </button>
        <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[150px] left-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="text-xs font-bold text-gray-700 mb-1 border-b pb-1">Categories ({tags.length}):</div>
          {tags.map((tag, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (setSelectedView) {
                  setSelectedView('category');
                  navigateToTab('items', { selectedCategory: tag });
                }
              }}
              className="block text-xs text-blue-700 hover:text-blue-900 hover:underline py-0.5 w-full text-left"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Additional costs display helper - show top 5 on hover, click for full view
  // isNearBottom: for last 4 rows, show dropdown above to prevent cutoff
  const renderAdditionalCosts = (item: CostViewItem, isNearBottom: boolean = false) => {
    if (item.additional_costs.length === 0) {
      return <span className="text-gray-700 text-xs">-</span>;
    }

    const maxToShow = 5;
    const costsToShow = item.additional_costs.slice(0, maxToShow);
    const remainingCount = item.additional_costs.length - maxToShow;

    return (
      <div className="relative group">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (setSelectedView) {
              setSelectedView('additional-costs');
              navigateToTab('items', { selectedItem: item.item_code });
            }
          }}
          className="font-mono text-xs text-orange-700 group-hover:text-orange-900 hover:underline font-semibold"
        >
          {currencySymbol}{item.total_additional_cost.toLocaleString()}
        </button>
        <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-xl right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`} style={{ minWidth: '220px' }}>
          <div className="bg-gray-100 px-3 py-2 border-b border-gray-300 text-xs font-semibold text-gray-800">
            Item Additional Costs ({item.additional_costs.length})
          </div>
          <table className="w-full text-xs">
            <tbody>
              {costsToShow.map((ac, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-1.5 text-gray-800">{ac.cost_name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-900">{currencySymbol}{ac.total_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {remainingCount > 0 && (
            <div className="px-3 py-1.5 text-xs text-blue-600 border-b border-gray-200">
              +{remainingCount} more (click to view all)
            </div>
          )}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-300 flex justify-between text-xs font-semibold">
            <span>Total</span>
            <span className="font-mono">{currencySymbol}{item.total_additional_cost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Compact Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Page Size */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-gray-800">per page</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800">
                BOMs: {selectedBOMs.includes('all') ? 'All' : selectedBOMs.join(', ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800">
                Vendors: {selectedVendors.includes('all') ? 'All' : `${selectedVendors.length} selected`}
              </span>
            </div>

            {/* Sort Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs font-semibold text-blue-900">Sort By:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortMode('total')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    sortMode === 'total'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-blue-100'
                  }`}
                >
                  Total Amount
                </button>
                <button
                  onClick={() => setSortMode('base-rate')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    sortMode === 'base-rate'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-blue-100'
                  }`}
                >
                  Base Rate
                </button>
              </div>
            </div>

            {/* Expand/Collapse Advanced Filters */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {(!selectedBOMs.includes('all') || !selectedVendors.includes('all') || !selectedTags.includes('all') || costRange[0] > 0 || costRange[1] < maxCostInData || selectedItemCode) && (
              <button
                onClick={() => {
                  setSelectedBOMs(['all']);
                  setSelectedVendors(['all']);
                  setSelectedTags(['all']);
                  setCostRange([0, maxCostInData]);
                  setSelectedItemCode(null);
                  setSortMode('total');
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Advanced Filters (Collapsible) */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {/* Cost Range Slider */}
              <div className="space-y-2 pb-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700">Cost Range:</label>
                  <span className="text-sm font-medium text-blue-600">
                    {currencySymbol}{costRange[0].toLocaleString()} - {currencySymbol}{costRange[1].toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <label className="text-xs text-gray-800 block mb-1">Min</label>
                    <input
                      type="range"
                      min="0"
                      max={maxCostInData}
                      step={Math.max(1, Math.floor(maxCostInData / 100))}
                      value={costRange[0]}
                      onChange={(e) => setCostRange([Number(e.target.value), costRange[1]])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-800 block mb-1">Max</label>
                    <input
                      type="range"
                      min="0"
                      max={maxCostInData}
                      step={Math.max(1, Math.floor(maxCostInData / 100))}
                      value={costRange[1]}
                      onChange={(e) => setCostRange([costRange[0], Number(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                {/* BOMs - Grouped by Root BOM */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">BOMs ({rootBOMCount}):</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs p-1 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes('all')}
                        onChange={() => setSelectedBOMs(['all'])}
                        className="rounded"
                      />
                      <span className="font-medium">All BOMs</span>
                    </label>
                    {/* Group BOMs by root */}
                    {(() => {
                      const rootBOMs = allUniqueBOMPaths.filter(bom => !bom.includes(' > '));
                      return rootBOMs.map(rootBom => {
                        const childBOMs = allUniqueBOMPaths.filter(bom => bom.startsWith(rootBom + ' > '));
                        const hasChildren = childBOMs.length > 0;
                        const isRootSelected = selectedBOMs.includes(rootBom);
                        const hasSelectedChildren = childBOMs.some(child => selectedBOMs.includes(child));

                        return (
                          <div key={rootBom} className="border border-gray-200 rounded mb-1">
                            <div className="flex items-center gap-2 p-1.5 bg-gray-50 hover:bg-gray-100 rounded-t">
                              <input
                                type="checkbox"
                                checked={isRootSelected}
                                onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, rootBom))}
                                className="rounded"
                              />
                              <span className="text-xs font-medium text-gray-800 flex-1">{rootBom}</span>
                              {hasChildren && (
                                <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                  {childBOMs.length} sub
                                </span>
                              )}
                            </div>
                            {hasChildren && (isRootSelected || hasSelectedChildren || selectedBOMs.includes('all')) && (
                              <div className="pl-4 py-1 border-t border-gray-100 bg-white">
                                {childBOMs.map(child => {
                                  const depth = child.split(' > ').length - 1;
                                  const displayName = child.split(' > ').pop() || child;
                                  return (
                                    <label key={child} className="flex items-center gap-2 cursor-pointer text-xs py-0.5 hover:bg-gray-50 rounded" style={{ paddingLeft: `${(depth - 1) * 10}px` }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedBOMs.includes(child)}
                                        onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, child))}
                                        className="rounded"
                                      />
                                      <span className="text-gray-600">{depth > 1 ? `└ ${displayName}` : displayName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Vendors */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Vendors:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedVendors.includes('all')}
                      onChange={() => setSelectedVendors(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {filters.vendor_list.slice(0, 8).map(vendor => (
                    <label key={vendor.vendor_id} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor.vendor_id)}
                        onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor.vendor_id))}
                        className="rounded"
                      />
                      <span className="truncate">{vendor.vendor_name}</span>
                    </label>
                  ))}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Tags:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes('all')}
                      onChange={() => setSelectedTags(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {filters.tag_list.slice(0, 8).map(tag => (
                    <label key={tag} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => setSelectedTags(toggleSelection(selectedTags, tag))}
                        className="rounded"
                      />
                      <span className="truncate">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Cost Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-gray-700 mb-2">Total Amount</div>
            <div className="text-3xl font-bold text-blue-600">{currencySymbol}{insights.total.toLocaleString()}</div>
            <div className="text-sm text-gray-800 mt-2">{insights.percent.toFixed(1)}% of quote</div>
            <div className="text-sm text-gray-800">{insights.count} items</div>
          </CardContent>
        </Card>

        {/* Item AC Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-gray-700 mb-2">Item Additional Costs</div>
            <div className="text-3xl font-bold text-orange-600">{currencySymbol}{insights.totalAC.toLocaleString()}</div>
            <div className="text-sm text-gray-800 mt-2">
              {insights.total > 0 ? ((insights.totalAC / insights.total) * 100).toFixed(1) : 0}% of total
            </div>
          </CardContent>
        </Card>

        {/* Max Cost Card - Clickable - Shows all instances of this item code across vendors/BOMs */}
        <Card
          className={`border-gray-200 cursor-pointer transition-all hover:shadow-md hover:border-green-400 ${selectedItemCode === highestCostItem?.item_code ? 'ring-2 ring-green-500 border-green-500' : ''}`}
          onClick={() => {
            if (selectedItemCode === highestCostItem?.item_code) {
              setSelectedItemCode(null); // Toggle off
            } else if (highestCostItem) {
              setSelectedItemCode(highestCostItem.item_code);
            }
          }}
        >
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Highest Cost Item
              {selectedItemCode === highestCostItem?.item_code && <span className="ml-2 text-green-600">(Click to clear)</span>}
            </div>
            <div className="text-3xl font-bold text-green-600">{currencySymbol}{insights.maxCost.toLocaleString()}</div>
            <div className="text-sm text-gray-800 mt-2">{insights.maxItemCode}</div>
          </CardContent>
        </Card>

        {/* Item Count Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-gray-700 mb-2">Items Shown</div>
            <div className="text-3xl font-bold text-purple-600">{insights.count}</div>
            <div className="text-sm text-gray-800 mt-2">of {items.length} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost Distribution Bar Chart */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-bold text-gray-900 mb-1 text-base">Top 6 Most Expensive Items</h4>
            <p className="text-sm text-gray-700 mb-3">Compare the highest cost items in your quote</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costDistributionData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#374151' }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={{ stroke: '#374151' }}
                  label={{ value: 'Item Code', position: 'bottom', offset: 5, fontSize: 12, fill: '#374151', fontWeight: 600 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#374151' }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={{ stroke: '#374151' }}
                  tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                  label={{ value: 'Total Amount', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#374151', fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `${currencySymbol}${value.toLocaleString()}`,
                    'Total Amount'
                  ]}
                  labelFormatter={(label) => `Item: ${label}`}
                  contentStyle={{ fontSize: 12, backgroundColor: '#fff', border: '1px solid #374151', borderRadius: '4px', padding: '10px' }}
                />
                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* BOM Breakdown Pie Chart */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-bold text-gray-900 mb-1 text-base">Cost Distribution by BOM</h4>
            <p className="text-sm text-gray-700 mb-3">How much each BOM contributes to total cost</p>
            <div className="flex">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={bomBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {bomBreakdownData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => {
                      const percent = (value / insights.total) * 100;
                      return [`${currencySymbol}${value.toLocaleString()} (${percent.toFixed(1)}%)`, 'Cost'];
                    }}
                    contentStyle={{ fontSize: 12, backgroundColor: '#fff', border: '1px solid #374151', borderRadius: '4px', padding: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="w-[40%] pl-2 flex flex-col justify-center">
                <div className="text-xs font-bold text-gray-800 mb-2">BOM Legend:</div>
                {bomBreakdownData.map((entry, index) => {
                  const percent = (entry.value / insights.total) * 100;
                  return (
                    <div key={entry.name} className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-gray-800 truncate" title={entry.name}>
                        {entry.name}: {percent.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Excel-like Table with Pagination */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex justify-between items-center">
            <h4 className="font-semibold text-gray-900 text-sm">
              Item Details - Sorted by {sortMode === 'total' ? 'Total Amount' : 'Base Rate'}
              {selectedItemCode && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  Filtered: {selectedItemCode}
                </span>
              )}
            </h4>
            <div className="text-xs text-gray-800">
              Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Tags</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-xs">Source</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Base Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Quoted Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs" title="Item Additional Costs (Total)">Item AC (Total)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% Quote</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedItems.map((item, idx) => (
                  <tr key={`${item.item_id}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 border-r border-gray-200 text-xs">
                      {((currentPage - 1) * pageSize) + idx + 1}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-900 border-r border-gray-200 font-medium">
                      {item.item_code}
                    </td>
                    <td className="px-3 py-2 text-gray-900 border-r border-gray-200 max-w-xs truncate text-xs" title={item.item_name}>
                      {item.item_name}
                    </td>

                    {/* Tags - isNearBottom for last 4 items in page */}
                    <td className="px-3 py-2 border-r border-gray-200">
                      {renderTags(item.tags, idx >= paginatedItems.length - 4)}
                    </td>

                    {/* Vendor - Clickable */}
                    <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer">
                      {item.vendor_name ? (
                        <button
                          onClick={() => {
                            if (setSelectedView) {
                              setSelectedView('vendor');
                              navigateToTab('items', { selectedVendor: item.vendor_name || undefined, selectedItem: item.item_code });
                            }
                          }}
                          className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.vendor_name}
                        </button>
                      ) : (
                        <span className="text-gray-700 text-xs">-</span>
                      )}
                    </td>

                    {/* BOM - Clickable - Shows full hierarchy path */}
                    <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title={`Path: ${item.bom_path}`}>
                      <button
                        onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                        className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                      >
                        {item.bom_path || item.bom_code}
                      </button>
                    </td>

                    {/* Source */}
                    <td className="px-3 py-2 text-center border-r border-gray-200">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('item-source');
                            navigateToTab('items', { selectedSource: item.item_source, selectedItem: item.item_code });
                          }
                        }}
                        className="inline-block px-2 py-1 rounded text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: SOURCE_COLORS[item.item_source] || '#6b7280' }}
                      >
                        {SOURCE_LABELS[item.item_source] || item.item_source}
                      </button>
                    </td>

                    <td className="px-3 py-2 text-right text-gray-900 border-r border-gray-200 text-xs">
                      {item.quantity} {item.unit}
                    </td>

                    {/* Base Rate */}
                    <td className="px-3 py-2 text-right border-r border-gray-200">
                      <span className="font-mono text-xs text-gray-900">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </span>
                    </td>

                    {/* Quoted Rate - Clickable */}
                    <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('rate');
                            navigateToTab('items', { selectedItem: item.item_code });
                          }
                        }}
                        className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                      >
                        {currencySymbol}{item.quoted_rate.toLocaleString()}
                      </button>
                    </td>

                    {/* Item AC - Clickable with hover - isNearBottom for last 4 items */}
                    <td className="px-3 py-2 text-right border-r border-gray-200">
                      {renderAdditionalCosts(item, idx >= paginatedItems.length - 4)}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">
                      {currencySymbol}{item.total_amount.toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-900 text-xs">{item.percent_of_quote.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <div className="text-xs text-gray-800">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Last
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
