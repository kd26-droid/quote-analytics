import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Vendor } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData, CostViewItem } from '../../../../services/api';

interface VendorViewProps {
  data: TopItemsAnalytics;
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function VendorView({ costViewData, currencySymbol, totalQuoteValue, navigateToTab, navigationContext }: VendorViewProps) {
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [minCost, setMinCost] = useState(0);
  const [minItemCount, setMinItemCount] = useState(1);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Additional filters - Changed to arrays for multi-select
  const [topN, setTopN] = useState(50);
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);

  // Auto-select vendor from navigation context
  useEffect(() => {
    if (navigationContext?.selectedVendor) {
      setSelectedVendor(navigationContext.selectedVendor);
    }
  }, [navigationContext]);

  // Reset page when vendor or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendor, selectedTags, selectedBOMs]);

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

  // Get items from costViewData
  const items = costViewData.items;
  const filters = costViewData.filters;

  // Get unique tags (categories) from API filters
  const uniqueTags = useMemo(() => {
    return filters.tag_list || [];
  }, [filters.tag_list]);

  // Get unique BOMs from items - extract all hierarchy levels for filtering
  // Also track root BOMs separately for correct count
  const { uniqueBOMs, rootBOMCount } = useMemo(() => {
    const bomSet = new Set<string>();
    const rootBOMs = new Set<string>();

    items.forEach(item => {
      if (item.bom_path) {
        // Add full path
        bomSet.add(item.bom_path);

        // Track root BOM (first part of the path)
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);

        // Also add each level of the hierarchy for filtering
        // e.g., "QAB1 > QASB1 > QASSB1" -> ["QAB1", "QAB1 > QASB1", "QAB1 > QASB1 > QASSB1"]
        let path = '';
        parts.forEach((part, idx) => {
          path = idx === 0 ? part : `${path} > ${part}`;
          bomSet.add(path);
        });
      }
    });

    // Sort by hierarchy depth then alphabetically
    const sortedBOMs = Array.from(bomSet).sort((a, b) => {
      const depthA = a.split(' > ').length;
      const depthB = b.split(' > ').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    return { uniqueBOMs: sortedBOMs, rootBOMCount: rootBOMs.size };
  }, [items]);

  // Apply base filters first (tags, BOM, topN) - supports multiple selections
  const baseFilteredItems = useMemo(() => {
    let result = [...items];

    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.includes(bom)
        )
      );
    }

    // Sort by total_amount descending before slicing
    result.sort((a, b) => b.total_amount - a.total_amount);
    return result.slice(0, topN);
  }, [items, selectedTags, selectedBOMs, topN]);

  // Vendor analysis data from base filtered items
  const vendorAnalysis = useMemo(() => {
    const vendorMap = new Map<string, {
      vendor_id: string;
      vendor_name: string;
      items: number;
      totalCost: number;
      totalQuantity: number;
    }>();

    baseFilteredItems.forEach(item => {
      if (!item.vendor_id || !item.vendor_name) return;

      const current = vendorMap.get(item.vendor_id) || {
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        items: 0,
        totalCost: 0,
        totalQuantity: 0
      };
      current.items += 1;
      current.totalCost += item.total_amount;
      current.totalQuantity += item.quantity;
      vendorMap.set(item.vendor_id, current);
    });

    return Array.from(vendorMap.values())
      .map(stats => ({
        vendor: stats.vendor_name,
        vendor_id: stats.vendor_id,
        items: stats.items,
        totalCost: stats.totalCost,
        avgRate: stats.totalQuantity > 0 ? stats.totalCost / stats.totalQuantity : 0,
        percentOfQuote: (stats.totalCost / totalQuoteValue) * 100
      }))
      .filter(v => v.totalCost >= minCost && v.items >= minItemCount)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [baseFilteredItems, totalQuoteValue, minCost, minItemCount]);

  // Filtered items based on selected vendor AND all filters (tags, BOMs)
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply tag filter
    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Apply BOM filter - match exact path or any path containing the selected BOM
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.includes(bom)
        )
      );
    }

    // Apply vendor filter
    if (selectedVendor !== 'all') {
      result = result.filter(item => item.vendor_name === selectedVendor);
    }

    // Sort by total_amount descending
    result.sort((a, b) => b.total_amount - a.total_amount);

    return result;
  }, [items, selectedVendor, selectedTags, selectedBOMs]);

  const selectedVendorStats = useMemo(() => {
    if (selectedVendor === 'all') return null;

    // Calculate stats from filtered items (respects all filters)
    const vendorItems = filteredItems;
    if (vendorItems.length === 0) return null;

    const totalCost = vendorItems.reduce((sum, item) => sum + item.total_amount, 0);
    const totalQuantity = vendorItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      vendor: selectedVendor,
      items: vendorItems.length,
      totalCost,
      avgRate: totalQuantity > 0 ? totalCost / totalQuantity : 0,
      percentOfQuote: (totalCost / totalQuoteValue) * 100
    };
  }, [filteredItems, selectedVendor, totalQuoteValue]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Chart data - ONLY show selected vendor when filtered
  const chartVendorData = useMemo(() => {
    if (selectedVendor !== 'all') {
      // Only show the selected vendor
      return vendorAnalysis.filter(v => v.vendor === selectedVendor);
    }
    // Show all vendors
    return vendorAnalysis;
  }, [vendorAnalysis, selectedVendor]);

  return (
    <div className="space-y-4">
      {/* Compact Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Show Top:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={topN}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setTopN(1);
                  else setTopN(Math.min(50, Math.max(1, Number(val))));
                }}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                placeholder="50"
              />
              <span className="text-xs text-gray-500">items</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                Categories: {selectedTags.includes('all') ? 'All' : `${selectedTags.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                BOMs: {selectedBOMs.includes('all') ? 'All' : `${selectedBOMs.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Vendor:</span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 max-w-[150px]"
              >
                <option value="all">All</option>
                {vendorAnalysis.map(v => (
                  <option key={v.vendor_id} value={v.vendor}>
                    {v.vendor.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Min Items/Vendor:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={minItemCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setMinItemCount(1);
                  } else {
                    setMinItemCount(Math.max(1, Number(val)));
                  }
                }}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Expand/Collapse Advanced Filters */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {(selectedVendor !== 'all' || minCost !== 0 || minItemCount !== 1) && (
              <button
                onClick={() => {
                  setSelectedVendor('all');
                  setMinCost(0);
                  setMinItemCount(1);
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Advanced Filters (Collapsible) - Multi-Select Checkboxes */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {/* Multi-Select Checkboxes */}
              <div className="grid grid-cols-3 gap-4">
                {/* Tags (Categories) */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Categories:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes('all')}
                      onChange={() => setSelectedTags(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {uniqueTags.slice(0, 5).map(tag => (
                    <label key={tag} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => setSelectedTags(toggleSelection(selectedTags, tag))}
                        className="rounded"
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>

                {/* BOMs - Grouped by Root BOM */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">BOMs ({rootBOMCount}):</div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
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
                      const rootBOMs = uniqueBOMs.filter(bom => !bom.includes(' > '));
                      return rootBOMs.map(rootBom => {
                        const childBOMs = uniqueBOMs.filter(bom => bom.startsWith(rootBom + ' > '));
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

                {/* Min Cost Filter */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-800">Min Vendor Cost:</label>
                    <span className="text-xs font-bold text-blue-600">{currencySymbol}{minCost.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2000000"
                    step="50000"
                    value={minCost}
                    onChange={(e) => setMinCost(Number(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights - Clickable Cards */}
      <div className="grid grid-cols-6 gap-3">
        <Card
          className="border-gray-200 hover:border-blue-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => setSelectedVendor('all')}
          title="Click to show all vendors"
        >
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Total Vendors</div>
            <div className="text-2xl font-bold text-blue-600">{vendorAnalysis.length}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">shown</div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-green-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => vendorAnalysis[0] && setSelectedVendor(vendorAnalysis[0].vendor)}
          title="Click to filter to top vendor"
        >
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Top Vendor</div>
            <div className="text-sm font-bold text-green-600 truncate" title={vendorAnalysis[0]?.vendor}>
              {vendorAnalysis[0]?.vendor || 'N/A'}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">
              {currencySymbol}{((vendorAnalysis[0]?.totalCost || 0) / 1000).toFixed(0)}k
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Avg Cost/Vendor</div>
            <div className="text-2xl font-bold text-purple-600">
              {currencySymbol}{Math.floor(vendorAnalysis.reduce((sum, v) => sum + v.totalCost, 0) / vendorAnalysis.length / 1000) || 0}k
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">per vendor</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Avg Items/Vendor</div>
            <div className="text-2xl font-bold text-orange-600">
              {Math.floor(vendorAnalysis.reduce((sum, v) => sum + v.items, 0) / vendorAnalysis.length) || 0}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">items</div>
          </CardContent>
        </Card>

        {selectedVendorStats ? (
          <>
            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-3">
                <div className="text-xs font-bold text-blue-800 mb-1">Selected: {selectedVendorStats.items} Items</div>
                <div className="text-xl font-bold text-blue-600">
                  {currencySymbol}{(selectedVendorStats.totalCost / 1000).toFixed(0)}k
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">
                  {selectedVendorStats.percentOfQuote.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-3">
                <div className="text-xs font-bold text-blue-800 mb-1">Avg Rate</div>
                <div className="text-xl font-bold text-blue-600">
                  {currencySymbol}{selectedVendorStats.avgRate.toFixed(0)}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">per unit</div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card
              className="border-gray-200 hover:border-indigo-400 transition-all cursor-pointer hover:shadow-md"
              onClick={() => {
                // Show top and bottom vendors
                setTopN(vendorAnalysis.length);
                setSelectedVendor('all');
              }}
              title="Click to show all vendors sorted by spread"
            >
              <CardContent className="p-3">
                <div className="text-xs font-bold text-gray-800 mb-1">Vendor Spread</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {vendorAnalysis.length > 1 ? ((vendorAnalysis[0].totalCost / vendorAnalysis[vendorAnalysis.length - 1].totalCost).toFixed(1)) : '0'}x
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">top/bottom</div>
              </CardContent>
            </Card>

            <Card
              className="border-gray-200 hover:border-pink-400 transition-all cursor-pointer hover:shadow-md"
              onClick={() => {
                // Show top 3 vendors only
                setTopN(3);
                setSelectedVendor('all');
              }}
              title="Click to show top 3 vendors"
            >
              <CardContent className="p-3">
                <div className="text-xs font-bold text-gray-800 mb-1">Concentration</div>
                <div className="text-2xl font-bold text-pink-600">
                  {vendorAnalysis.length > 0 ? ((vendorAnalysis.slice(0, 3).reduce((s, v) => s + v.totalCost, 0) / vendorAnalysis.reduce((s, v) => s + v.totalCost, 0) * 100).toFixed(0)) : 0}%
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">top 3</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts - FILTERED based on selection */}
      <div className="grid grid-cols-2 gap-4">
        {/* Vendor Cost Ranking */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedVendor !== 'all' ? `${selectedVendor} - Item Breakdown` : 'Total Cost per Vendor'}
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              {selectedVendor !== 'all' ? (
                // Show items from selected vendor
                <BarChart data={filteredItems.slice(0, 8).map(item => ({
                  itemCode: item.item_code,
                  itemName: item.item_name,
                  totalCost: item.total_amount
                }))} layout="vertical" margin={{ left: 10, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                    label={{ value: 'Total Cost', position: 'bottom', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <YAxis
                    dataKey="itemCode"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Item Code', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${props.payload?.itemName ?? ''}`,
                      'Item Cost'
                    ]}
                    labelFormatter={(label) => `Item: ${label}`}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="totalCost" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                // Show all vendors
                <BarChart data={chartVendorData.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                    label={{ value: 'Total Cost', position: 'bottom', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <YAxis
                    dataKey="vendor"
                    type="category"
                    width={120}
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Vendor', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percentOfQuote ?? 0).toFixed(2)}% of total quote - ${props.payload?.items ?? 0} items from this vendor`,
                      'Total from Vendor'
                    ]}
                    labelFormatter={(label) => `Vendor: ${label}`}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="totalCost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vendor Distribution Pie */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedVendor !== 'all' ? `${selectedVendor} - Category Breakdown` : 'Vendor Share of Total Quote'}
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              {selectedVendor !== 'all' ? (
                // Show tag/category breakdown for selected vendor - count ALL tags per item
                <PieChart>
                  <Pie
                    data={(() => {
                      const tagMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        if (item.tags.length === 0) {
                          tagMap.set('Uncategorized', (tagMap.get('Uncategorized') || 0) + item.total_amount);
                        } else {
                          // Add cost to ALL tags this item belongs to
                          item.tags.forEach(tag => {
                            tagMap.set(tag, (tagMap.get(tag) || 0) + item.total_amount);
                          });
                        }
                      });
                      const totalVendorCost = filteredItems.reduce((s, i) => s + i.total_amount, 0);
                      return Array.from(tagMap.entries())
                        .sort((a, b) => b[1] - a[1]) // Sort by cost descending
                        .slice(0, 6) // Top 6 categories
                        .map(([tag, cost]) => ({
                          name: tag.length > 12 ? tag.substring(0, 12) + '...' : tag,
                          fullName: tag,
                          cost,
                          percent: totalVendorCost > 0 ? (cost / totalVendorCost) * 100 : 0
                        }));
                    })()}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {(() => {
                      const tagMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        if (item.tags.length === 0) {
                          tagMap.set('Uncategorized', (tagMap.get('Uncategorized') || 0) + item.total_amount);
                        } else {
                          item.tags.forEach(tag => {
                            tagMap.set(tag, (tagMap.get(tag) || 0) + item.total_amount);
                          });
                        }
                      });
                      return Array.from(tagMap.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ));
                    })()}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${(entry.payload?.percent ?? 0).toFixed(1)}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percent ?? 0).toFixed(1)}% of vendor total`,
                      props.payload?.name ?? ''
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              ) : (
                // Show all vendors
                <PieChart>
                  <Pie
                    data={chartVendorData.slice(0, 6).map(v => ({
                      name: v.vendor.split(' ')[0],
                      totalCost: v.totalCost,
                      percentOfQuote: v.percentOfQuote,
                      vendor: v.vendor,
                      items: v.items
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalCost"
                  >
                    {chartVendorData.slice(0, 6).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${entry.payload.percentOfQuote?.toFixed(1) || '0'}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percentOfQuote ?? 0).toFixed(1)}% of total quote cost - ${props.payload?.items ?? 0} items`,
                      props.payload?.vendor ?? ''
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Details Table - Excel-like UI */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">
              {selectedVendor === 'all' ? 'All Vendors Summary' : `Items from ${selectedVendor}`}
            </h4>
          </div>
          <div className="overflow-x-auto">
            {selectedVendor === 'all' ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-400">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor Name</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Count</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Total Cost</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Avg Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% of Quote</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {vendorAnalysis.map((vendor, idx) => (
                    <tr key={vendor.vendor_id} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedVendor(vendor.vendor)} title="Click to view items from this vendor">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium border-r border-gray-200">
                        {vendor.vendor}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">{vendor.items} items</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">{currencySymbol}{vendor.totalCost.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">{currencySymbol}{vendor.avgRate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-600 text-xs">{vendor.percentOfQuote.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-400">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Code</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Category</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Quantity</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Base Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Quoted Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedItems.map((item, idx) => (
                    <tr key={`${item.item_id}-${item.bom_path}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-900 border-r border-gray-200 font-medium">{item.item_code}</td>
                      <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-xs truncate text-xs" title={item.item_name}>
                        {item.item_name}
                      </td>

                      {/* Category (Tags) - Show count with hover for all */}
                      {/* isNearBottom: dropdown shows above for last 4 rows */}
                      <td className="px-3 py-2 border-r border-gray-200">
                        {item.tags.length === 0 ? (
                          <span className="text-xs text-gray-500">Uncategorized</span>
                        ) : item.tags.length === 1 ? (
                          <button
                            onClick={() => navigateToTab('items', { selectedCategory: item.tags[0] })}
                            className="text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium"
                          >
                            {item.tags[0]}
                          </button>
                        ) : (
                          <div className="relative group">
                            <button
                              onClick={() => navigateToTab('items', { selectedCategory: item.tags[0] })}
                              className="text-xs text-blue-700 hover:text-blue-900 hover:underline cursor-pointer font-medium"
                            >
                              {item.tags.length} categories
                            </button>
                            <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[150px] left-0 ${idx >= paginatedItems.length - 4 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                              <div className="text-xs font-bold text-gray-700 mb-1 border-b pb-1">Categories ({item.tags.length}):</div>
                              {item.tags.map((tag, tagIdx) => (
                                <button
                                  key={tagIdx}
                                  onClick={() => navigateToTab('items', { selectedCategory: tag })}
                                  className="block text-xs text-blue-700 hover:text-blue-900 hover:underline py-0.5 w-full text-left"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* BOM - Clickable */}
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this BOM">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.bom_path}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                        {item.quantity} {item.unit}
                      </td>

                      {/* Vendor Rate (in vendor's currency with symbol) */}
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">
                        {item.vendor_rate?.toLocaleString() ?? '-'}
                      </td>

                      {/* Base Rate (converted to costing sheet currency) */}
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </td>

                      {/* Quoted Rate - Clickable */}
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view in Rate View">
                        <button
                          onClick={() => navigateToTab('items', { selectedItem: item.item_code })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                        >
                          {currencySymbol}{item.quoted_rate.toLocaleString()}
                        </button>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 text-xs">
                        {currencySymbol}{item.total_amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600 flex justify-between items-center">
            {selectedVendor === 'all' ? (
              <span><span className="font-medium">Note:</span> Click on any vendor name to view their items. Click metric cards to filter data.</span>
            ) : (
              <div className="flex items-center gap-4">
                <span><span className="font-medium">Note:</span> Click Category, BOM, or Quoted Rate to navigate. <button onClick={() => setSelectedVendor('all')} className="text-blue-700 hover:underline font-medium ml-2">← Back to All Vendors</button></span>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-gray-600 font-medium">
                      Page {currentPage} of {totalPages} ({filteredItems.length} items)
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-2 py-1 rounded text-xs font-medium ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-2 py-1 rounded text-xs font-medium ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
