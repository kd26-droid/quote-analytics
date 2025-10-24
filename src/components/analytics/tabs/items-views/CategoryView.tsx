import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Category } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface CategoryViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  topCategories: Category[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CategoryView({ data, totalQuoteValue, topCategories, navigateToTab, navigationContext }: CategoryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Auto-select category from navigation context
  useEffect(() => {
    if (navigationContext?.selectedCategory) {
      setSelectedCategory(navigationContext.selectedCategory);
    }
  }, [navigationContext]);
  const [minItemsPerCategory, setMinItemsPerCategory] = useState(1);
  const [topN, setTopN] = useState(10);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']); // Changed to array
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']); // Changed to array
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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

  // Get unique BOMs and Vendors
  const uniqueBOMs = useMemo(() => {
    const boms = Array.from(new Set(data.overall.map(item => item.bomPath))).sort();
    return boms;
  }, [data.overall]);

  const uniqueVendors = useMemo(() => {
    const vendors = Array.from(new Set(data.overall.map(item => item.vendor))).sort();
    return vendors;
  }, [data.overall]);

  // Filtered items - apply BOM and Vendor filters first - supports multiple selections
  const preFilteredItems = useMemo(() => {
    let items = data.overall;

    if (!selectedBOMs.includes('all')) {
      items = items.filter(item =>
        selectedBOMs.some(bom => item.bomPath === bom || item.bomPath.startsWith(bom + '.'))
      );
    }

    if (!selectedVendors.includes('all')) {
      items = items.filter(item => selectedVendors.includes(item.vendor));
    }

    return items;
  }, [data.overall, selectedBOMs, selectedVendors]);

  // Category analysis - based on pre-filtered items
  const categoryAnalysis = useMemo(() => {
    const catMap = new Map<string, { items: number; totalCost: number }>();

    preFilteredItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      const current = catMap.get(category) || { items: 0, totalCost: 0 };
      current.items += 1;
      current.totalCost += item.totalCost;
      catMap.set(category, current);
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

  // Filtered items for display
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return preFilteredItems;
    return preFilteredItems.filter(item => (item.category || 'Uncategorized') === selectedCategory);
  }, [preFilteredItems, selectedCategory]);

  const selectedCategoryStats = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return categoryAnalysis.find(c => c.category === selectedCategory);
  }, [categoryAnalysis, selectedCategory]);

  // Chart data - ONLY show selected category when filtered
  const chartCategoryData = useMemo(() => {
    if (selectedCategory !== 'all') {
      // Only show the selected category
      return categoryAnalysis.filter(c => c.category === selectedCategory);
    }
    // Show all categories
    return categoryAnalysis;
  }, [categoryAnalysis, selectedCategory]);

  return (
    <div className="space-y-4">
      {/* Compact Filters */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Show Top:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={topN}
                onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                placeholder="10"
              />
              <span className="text-xs text-gray-500">items</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                BOMs: {selectedBOMs.includes('all') ? 'All' : `${selectedBOMs.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
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
                {/* BOMs Multi-Select */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-600 block">BOMs:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes('all')}
                        onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, 'all'))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 font-medium">All BOMs</span>
                    </label>
                    {uniqueBOMs.map(bom => (
                      <label key={bom} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedBOMs.includes(bom)}
                          onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bom))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-600">{bom}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Vendors Multi-Select */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-600 block">Vendors:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes('all')}
                        onChange={() => setSelectedVendors(toggleSelection(selectedVendors, 'all'))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 font-medium">All Vendors</span>
                    </label>
                    {uniqueVendors.map(vendor => (
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
                    <span className="text-xs font-semibold text-gray-600">Category:</span>
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
                    <span className="text-xs font-semibold text-gray-600">Min Items:</span>
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
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Categories</div>
            <div className="text-2xl font-bold text-blue-600">{categoryAnalysis.length}</div>
            <div className="text-xs text-gray-500 mt-1">categories shown</div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-green-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => categoryAnalysis[0] && setSelectedCategory(categoryAnalysis[0].category)}
          title="Click to filter to top category"
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Top Category</div>
            <div className="text-sm font-bold text-green-600 truncate" title={categoryAnalysis[0]?.category}>
              {categoryAnalysis[0]?.category || 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ${(categoryAnalysis[0]?.totalCost || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {selectedCategoryStats && (
          <>
            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-blue-700 mb-1">Selected: {selectedCategoryStats.items} Items</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${selectedCategoryStats.totalCost.toLocaleString()}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {selectedCategoryStats.percentOfQuote.toFixed(1)}% of quote
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-blue-700 mb-1">Avg Cost/Item</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${Math.floor(selectedCategoryStats.avgCostPerItem).toLocaleString()}
                </div>
                <div className="text-xs text-blue-600 mt-1">in this category</div>
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
                <BarChart data={filteredItems.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="itemCode" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `$${value.toLocaleString()} - ${props.payload.itemName}`,
                      'Item Cost'
                    ]}
                    labelFormatter={(label) => `Item: ${label}`}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="totalCost" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                // Show all categories
                <BarChart data={chartCategoryData.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                    `$${value.toLocaleString()} - ${props.payload.percentOfQuote.toFixed(1)}% of total quote - ${props.payload.items} items in ${props.payload.category} (excludes MOQ/Testing/Coating)`,
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
                        vendorMap.set(item.vendor, (vendorMap.get(item.vendor) || 0) + item.totalCost);
                      });
                      const totalCost = filteredItems.reduce((s, i) => s + i.totalCost, 0) || 1;
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
                        vendorMap.set(item.vendor, (vendorMap.get(item.vendor) || 0) + item.totalCost);
                      });
                      return Array.from(vendorMap.entries()).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ));
                    })()}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${entry.payload.percent?.toFixed(1) || 0}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `$${value.toLocaleString()} - ${props.payload.percent?.toFixed(1) || 0}% of category total`,
                      props.payload.vendor || 'Unknown'
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              ) : (
                // Show all categories
                <PieChart>
                  <Pie
                    data={chartCategoryData.slice(0, 6).map(c => ({
                      name: c.category.split(' ')[0],
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
                    formatter={(value, entry: any) => `${value} (${entry.payload.percentOfQuote?.toFixed(0) || 0}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `$${value.toLocaleString()} - ${props.payload.percentOfQuote.toFixed(1)}% of quote - ${props.payload.items} items - Average $${props.payload.avgCostPerItem.toLocaleString()} per item`,
                      props.payload.category
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
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">${cat.totalCost.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">${Math.floor(cat.avgCostPerItem).toLocaleString()}</td>
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
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredItems.map((item, idx) => (
                    <tr key={item.itemCode} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-900 border-r border-gray-200 font-medium">{item.itemCode}</td>
                      <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-xs truncate text-xs" title={item.itemName}>
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this vendor">
                        <button
                          onClick={() => navigateToTab('items', { selectedVendor: item.vendor })}
                          className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.vendor}
                        </button>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this BOM">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bomPath })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.bomPath}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view in Rate View">
                        <button
                          onClick={() => navigateToTab('items', { selectedItem: item.itemCode })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                        >
                          ${item.quotedRate.toLocaleString()}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 text-xs">${item.totalCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            {selectedCategory === 'all' ? (
              <span><span className="font-medium">Note:</span> Click on any category name to view its items. Click metric cards to filter data.</span>
            ) : (
              <span><span className="font-medium">Note:</span> Click Vendor, BOM, or Rate to navigate to respective views. <button onClick={() => setSelectedCategory('all')} className="text-blue-700 hover:underline font-medium ml-2">← Back to All Categories</button></span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
