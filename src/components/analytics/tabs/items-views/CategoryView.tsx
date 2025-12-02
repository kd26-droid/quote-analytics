import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Category } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData } from '../../../../services/api';

interface CategoryViewProps {
  data: TopItemsAnalytics;
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  topCategories: Category[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CategoryView({ costViewData, currencySymbol, totalQuoteValue, navigateToTab, navigationContext }: CategoryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [minItemsPerCategory, setMinItemsPerCategory] = useState(1);
  const [topN, setTopN] = useState(10);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Auto-select category from navigation context
  useEffect(() => {
    if (navigationContext?.selectedCategory) {
      setSelectedCategory(navigationContext.selectedCategory);
    }
  }, [navigationContext]);

  // Reset page when category or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedBOMs, selectedVendors]);

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

  // Get items and filters from costViewData
  const items = costViewData.items;
  const filters = costViewData.filters;

  // Get unique tags (categories) from API filters
  const uniqueCategories = useMemo(() => {
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

  // Get unique Vendors from filters
  const uniqueVendors = useMemo(() => {
    return filters.vendor_list.map(v => v.vendor_name) || [];
  }, [filters.vendor_list]);

  // Filtered items - apply BOM and Vendor filters first
  const preFilteredItems = useMemo(() => {
    let result = [...items];

    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom || item.bom_path.includes(bom)
        )
      );
    }

    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_name && selectedVendors.includes(item.vendor_name)
      );
    }

    return result;
  }, [items, selectedBOMs, selectedVendors]);

  // Category analysis - based on pre-filtered items
  // Each item can have multiple tags, so it appears in ALL its categories
  const categoryAnalysis = useMemo(() => {
    const catMap = new Map<string, { items: number; totalCost: number }>();

    preFilteredItems.forEach(item => {
      const tags = item.tags.length > 0 ? item.tags : ['Uncategorized'];

      // Add item to EACH of its tags/categories
      tags.forEach(tag => {
        const current = catMap.get(tag) || { items: 0, totalCost: 0 };
        current.items += 1;
        current.totalCost += item.total_amount;
        catMap.set(tag, current);
      });
    });

    return Array.from(catMap.entries())
      .map(([category, stats]) => ({
        category,
        items: stats.items,
        totalCost: stats.totalCost,
        percentOfQuote: (stats.totalCost / totalQuoteValue) * 100,
        avgCostPerItem: stats.totalCost / stats.items
      }))
      .filter(c => c.items >= minItemsPerCategory)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, topN);
  }, [preFilteredItems, totalQuoteValue, minItemsPerCategory, topN]);

  // Filtered items for display (with category filter applied)
  // Show items that have the selected category in ANY of their tags
  const filteredItems = useMemo(() => {
    let result = preFilteredItems;

    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        if (selectedCategory === 'Uncategorized') {
          return item.tags.length === 0;
        }
        return item.tags.includes(selectedCategory);
      });
    }

    // Sort by total_amount descending
    result.sort((a, b) => b.total_amount - a.total_amount);
    return result;
  }, [preFilteredItems, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const selectedCategoryStats = useMemo(() => {
    if (selectedCategory === 'all') return null;

    const categoryItems = filteredItems;
    if (categoryItems.length === 0) return null;

    const totalCost = categoryItems.reduce((sum, item) => sum + item.total_amount, 0);

    return {
      category: selectedCategory,
      items: categoryItems.length,
      totalCost,
      percentOfQuote: (totalCost / totalQuoteValue) * 100,
      avgCostPerItem: totalCost / categoryItems.length
    };
  }, [filteredItems, selectedCategory, totalQuoteValue]);

  // Chart data - ONLY show selected category when filtered
  const chartCategoryData = useMemo(() => {
    if (selectedCategory !== 'all') {
      return categoryAnalysis.filter(c => c.category === selectedCategory);
    }
    return categoryAnalysis;
  }, [categoryAnalysis, selectedCategory]);

  return (
    <div className="space-y-4">
      {/* Compact Filters */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">Show Top:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={topN}
                onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                placeholder="10"
              />
              <span className="text-xs font-bold text-gray-700">categories</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">
                BOMs: {selectedBOMs.includes('all') ? 'All' : `${selectedBOMs.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">
                Vendors: {selectedVendors.includes('all') ? 'All' : `${selectedVendors.length} selected`}
              </span>
            </div>

            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {(selectedCategory !== 'all' || minItemsPerCategory !== 1 || topN !== 10 || !selectedBOMs.includes('all') || !selectedVendors.includes('all')) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setMinItemsPerCategory(1);
                  setTopN(10);
                  setSelectedBOMs(['all']);
                  setSelectedVendors(['all']);
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <div className="grid grid-cols-3 gap-4">
                {/* BOMs - Grouped by Root BOM */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 block">BOMs ({rootBOMCount}):</span>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes('all')}
                        onChange={() => setSelectedBOMs(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 font-medium">All BOMs</span>
                    </label>
                    {/* Group BOMs by root */}
                    {(() => {
                      const rootBOMsList = uniqueBOMs.filter(bom => !bom.includes(' > '));
                      return rootBOMsList.map(rootBom => {
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
                                className="rounded border-gray-300"
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
                                        className="rounded border-gray-300"
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

                {/* Vendors Multi-Select */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 block">Vendors:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes('all')}
                        onChange={() => setSelectedVendors(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 font-medium">All Vendors</span>
                    </label>
                    {uniqueVendors.slice(0, 10).map(vendor => (
                      <label key={vendor} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor)}
                          onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-600">{vendor}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Other Filters */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">Category:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 w-full"
                    >
                      <option value="all">All Categories</option>
                      {categoryAnalysis.map(cat => (
                        <option key={cat.category} value={cat.category}>
                          {cat.category} ({cat.items} items)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">Min Items:</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={minItemsPerCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setMinItemsPerCategory(1);
                        } else {
                          setMinItemsPerCategory(Math.max(1, Number(val)));
                        }
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights - Clickable Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className="border-gray-200 hover:border-blue-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => setSelectedCategory('all')}
          title="Click to show all categories"
        >
          <CardContent className="p-4">
            <div className="text-xs font-bold text-gray-800 mb-1">Total Categories</div>
            <div className="text-2xl font-bold text-blue-600">{categoryAnalysis.length}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">categories shown</div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-green-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => categoryAnalysis[0] && setSelectedCategory(categoryAnalysis[0].category)}
          title="Click to filter to top category"
        >
          <CardContent className="p-4">
            <div className="text-xs font-bold text-gray-800 mb-1">Top Category</div>
            <div className="text-sm font-bold text-green-600 truncate" title={categoryAnalysis[0]?.category}>
              {categoryAnalysis[0]?.category || 'N/A'}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">
              {currencySymbol}{(categoryAnalysis[0]?.totalCost || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {selectedCategoryStats ? (
          <>
            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-blue-800 mb-1">Selected: {selectedCategoryStats.items} Items</div>
                <div className="text-2xl font-bold text-blue-600">
                  {currencySymbol}{selectedCategoryStats.totalCost.toLocaleString()}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">
                  {selectedCategoryStats.percentOfQuote.toFixed(1)}% of quote
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-blue-800 mb-1">Avg Cost/Item</div>
                <div className="text-2xl font-bold text-blue-600">
                  {currencySymbol}{Math.floor(selectedCategoryStats.avgCostPerItem).toLocaleString()}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">in this category</div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-gray-800 mb-1">Total Items</div>
                <div className="text-2xl font-bold text-purple-600">{preFilteredItems.length}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">across all categories</div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-xs font-bold text-gray-800 mb-1">Avg Items/Category</div>
                <div className="text-2xl font-bold text-orange-600">
                  {categoryAnalysis.length > 0 ? Math.floor(preFilteredItems.length / categoryAnalysis.length) : 0}
                </div>
                <div className="text-xs font-bold text-gray-700 mt-1">items</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts - FILTERED based on selection */}
      <div className="grid grid-cols-2 gap-4">
        {/* Category Cost Ranking */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedCategory !== 'all' ? `${selectedCategory} - Item Breakdown` : 'Total Cost by Category'}
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              {selectedCategory !== 'all' ? (
                // Show items from selected category
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
                // Show all categories
                <BarChart data={chartCategoryData.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                    label={{ value: 'Total Cost', position: 'bottom', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Category', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percentOfQuote ?? 0).toFixed(1)}% of total quote - ${props.payload?.items ?? 0} items`,
                      'Total Category Cost'
                    ]}
                    labelFormatter={(label) => `Category: ${label}`}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="totalCost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution Pie */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedCategory !== 'all' ? `${selectedCategory} - Vendor Breakdown` : 'Category Share of Quote'}
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              {selectedCategory !== 'all' ? (
                // Show vendor breakdown for selected category
                <PieChart>
                  <Pie
                    data={(() => {
                      const vendorMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const vendor = item.vendor_name || 'Unknown';
                        vendorMap.set(vendor, (vendorMap.get(vendor) || 0) + item.total_amount);
                      });
                      const totalCost = filteredItems.reduce((s, i) => s + i.total_amount, 0) || 1;
                      return Array.from(vendorMap.entries()).map(([vendor, cost]) => ({
                        name: vendor.split(' ')[0],
                        vendor,
                        cost,
                        percent: (cost / totalCost) * 100
                      }));
                    })()}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {(() => {
                      const vendorMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const vendor = item.vendor_name || 'Unknown';
                        vendorMap.set(vendor, (vendorMap.get(vendor) || 0) + item.total_amount);
                      });
                      return Array.from(vendorMap.entries()).map((_, index) => (
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
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percent ?? 0).toFixed(1)}% of category total`,
                      props.payload?.vendor ?? 'Unknown'
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              ) : (
                // Show all categories
                <PieChart>
                  <Pie
                    data={chartCategoryData.slice(0, 6).map(c => ({
                      name: c.category.length > 10 ? c.category.substring(0, 10) + '...' : c.category,
                      category: c.category,
                      totalCost: c.totalCost,
                      percentOfQuote: c.percentOfQuote,
                      items: c.items,
                      avgCostPerItem: c.avgCostPerItem
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalCost"
                  >
                    {chartCategoryData.slice(0, 6).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${(entry.payload?.percentOfQuote ?? 0).toFixed(0)}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${currencySymbol}${value.toLocaleString()} - ${(props.payload?.percentOfQuote ?? 0).toFixed(1)}% of quote - ${props.payload?.items ?? 0} items`,
                      props.payload?.category ?? ''
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table - Excel-like UI */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">
              {selectedCategory === 'all' ? 'All Categories Summary' : `Items in ${selectedCategory}`}
            </h4>
          </div>
          <div className="overflow-x-auto">
            {selectedCategory === 'all' ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-400">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Category Name</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Count</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Total Cost</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Avg Cost/Item</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% of Quote</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {categoryAnalysis.map((cat, idx) => (
                    <tr key={cat.category} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCategory(cat.category)} title="Click to view items in this category">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium border-r border-gray-200">
                        {cat.category}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">{cat.items} items</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">{currencySymbol}{cat.totalCost.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">{currencySymbol}{Math.floor(cat.avgCostPerItem).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600 text-xs">{cat.percentOfQuote.toFixed(1)}%</td>
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
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor</th>
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
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this vendor">
                        <button
                          onClick={() => navigateToTab('items', { selectedVendor: item.vendor_name || undefined })}
                          className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.vendor_name || 'N/A'}
                        </button>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this BOM">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.bom_path}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">
                        {item.vendor_rate?.toLocaleString() ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view in Cost View">
                        <button
                          onClick={() => navigateToTab('items', { selectedItem: item.item_code })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                        >
                          {currencySymbol}{item.quoted_rate.toLocaleString()}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 text-xs">{currencySymbol}{item.total_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600 flex justify-between items-center">
            {selectedCategory === 'all' ? (
              <span><span className="font-medium">Note:</span> Click on any category name to view its items. Click metric cards to filter data.</span>
            ) : (
              <div className="flex items-center gap-4">
                <span><span className="font-medium">Note:</span> Click Vendor, BOM, or Quoted Rate to navigate. <button onClick={() => setSelectedCategory('all')} className="text-blue-700 hover:underline font-medium ml-2">← Back to All Categories</button></span>

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
