import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, Vendor } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface VendorViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function VendorView({ data, totalQuoteValue, topVendors, navigateToTab, navigationContext }: VendorViewProps) {
  const [selectedVendor, setSelectedVendor] = useState('all');

  // Auto-select vendor from navigation context
  useEffect(() => {
    if (navigationContext?.selectedVendor) {
      setSelectedVendor(navigationContext.selectedVendor);
    }
  }, [navigationContext]);
  const [minCost, setMinCost] = useState(0);
  const [minItemCount, setMinItemCount] = useState(1);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Additional filters - Changed to arrays for multi-select
  const [topN, setTopN] = useState(50);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);

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

  // Get unique categories and BOMs
  const uniqueCategories = useMemo(() => {
    const cats = new Set(data.overall.map(item => item.category || 'Uncategorized'));
    return Array.from(cats).sort();
  }, [data.overall]);

  const uniqueBOMs = useMemo(() => {
    const boms = Array.from(new Set(data.overall.map(item => item.bomPath))).sort();
    return boms;
  }, [data.overall]);

  // Apply base filters first (category, BOM, topN) - supports multiple selections
  const baseFilteredItems = useMemo(() => {
    let items = [...data.overall];

    if (!selectedCategories.includes('all')) {
      items = items.filter(item =>
        selectedCategories.includes(item.category || 'Uncategorized')
      );
    }

    if (!selectedBOMs.includes('all')) {
      items = items.filter(item =>
        selectedBOMs.some(bom => item.bomPath === bom || item.bomPath.startsWith(bom + '.'))
      );
    }

    return items.slice(0, topN);
  }, [data.overall, selectedCategories, selectedBOMs, topN]);

  // Vendor analysis data from base filtered items
  const vendorAnalysis = useMemo(() => {
    const vendorMap = new Map<string, { items: number; totalCost: number; avgRate: number }>();

    baseFilteredItems.forEach(item => {
      const current = vendorMap.get(item.vendor) || { items: 0, totalCost: 0, avgRate: 0 };
      current.items += 1;
      current.totalCost += item.totalCost;
      vendorMap.set(item.vendor, current);
    });

    // Calculate average rates
    vendorMap.forEach((stats, vendor) => {
      const items = baseFilteredItems.filter(i => i.vendor === vendor);
      stats.avgRate = stats.totalCost / items.reduce((sum, i) => sum + i.quantity, 0);
    });

    return Array.from(vendorMap.entries())
      .map(([vendor, stats]) => ({
        vendor,
        items: stats.items,
        totalCost: stats.totalCost,
        avgRate: stats.avgRate,
        percentOfQuote: (stats.totalCost / totalQuoteValue) * 100
      }))
      .filter(v => v.totalCost >= minCost && v.items >= minItemCount)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [baseFilteredItems, totalQuoteValue, minCost, minItemCount]);

  // Filtered items based on selected vendor
  const filteredItems = useMemo(() => {
    if (selectedVendor === 'all') return data.overall;
    return data.overall.filter(item => item.vendor === selectedVendor);
  }, [data.overall, selectedVendor]);

  const selectedVendorStats = useMemo(() => {
    if (selectedVendor === 'all') return null;
    return vendorAnalysis.find(v => v.vendor === selectedVendor);
  }, [vendorAnalysis, selectedVendor]);

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
                Categories: {selectedCategories.includes('all') ? 'All' : `${selectedCategories.length} selected`}
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
                  <option key={v.vendor} value={v.vendor}>
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
                {/* Categories */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Categories:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes('all')}
                      onChange={() => setSelectedCategories(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {uniqueCategories.slice(0, 5).map(cat => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => setSelectedCategories(toggleSelection(selectedCategories, cat))}
                        className="rounded"
                      />
                      <span>{cat}</span>
                    </label>
                  ))}
                </div>

                {/* BOMs */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">BOMs:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedBOMs.includes('all')}
                      onChange={() => setSelectedBOMs(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {uniqueBOMs.slice(0, 5).map(bom => (
                    <label key={bom} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes(bom)}
                        onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bom))}
                        className="rounded"
                      />
                      <span>BOM {bom}</span>
                    </label>
                  ))}
                </div>

                {/* Min Cost Filter */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-700">Min Vendor Cost:</label>
                    <span className="text-xs text-blue-600">${minCost.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="5000"
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
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Vendors</div>
            <div className="text-2xl font-bold text-blue-600">{vendorAnalysis.length}</div>
            <div className="text-xs text-gray-500 mt-1">shown</div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-green-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => vendorAnalysis[0] && setSelectedVendor(vendorAnalysis[0].vendor)}
          title="Click to filter to top vendor"
        >
          <CardContent className="p-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Top Vendor</div>
            <div className="text-sm font-bold text-green-600 truncate" title={vendorAnalysis[0]?.vendor}>
              {vendorAnalysis[0]?.vendor.split(' ')[0] || 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ${(vendorAnalysis[0]?.totalCost / 1000).toFixed(0)}k
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Avg Cost/Vendor</div>
            <div className="text-2xl font-bold text-purple-600">
              ${Math.floor(vendorAnalysis.reduce((sum, v) => sum + v.totalCost, 0) / vendorAnalysis.length / 1000)}k
            </div>
            <div className="text-xs text-gray-500 mt-1">per vendor</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Avg Items/Vendor</div>
            <div className="text-2xl font-bold text-orange-600">
              {Math.floor(vendorAnalysis.reduce((sum, v) => sum + v.items, 0) / vendorAnalysis.length)}
            </div>
            <div className="text-xs text-gray-500 mt-1">items</div>
          </CardContent>
        </Card>

        {selectedVendorStats ? (
          <>
            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-3">
                <div className="text-xs font-semibold text-blue-700 mb-1">Selected: {selectedVendorStats.items} Items</div>
                <div className="text-xl font-bold text-blue-600">
                  ${(selectedVendorStats.totalCost / 1000).toFixed(0)}k
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {selectedVendorStats.percentOfQuote.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 border-blue-300 bg-blue-50">
              <CardContent className="p-3">
                <div className="text-xs font-semibold text-blue-700 mb-1">Avg Rate</div>
                <div className="text-xl font-bold text-blue-600">
                  ${selectedVendorStats.avgRate.toFixed(0)}
                </div>
                <div className="text-xs text-blue-600 mt-1">per unit</div>
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
                <div className="text-xs font-semibold text-gray-600 mb-1">Vendor Spread</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {vendorAnalysis.length > 0 ? ((vendorAnalysis[0].totalCost / vendorAnalysis[vendorAnalysis.length - 1].totalCost).toFixed(1)) : '0'}x
                </div>
                <div className="text-xs text-gray-500 mt-1">top/bottom</div>
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
                <div className="text-xs font-semibold text-gray-600 mb-1">Concentration</div>
                <div className="text-2xl font-bold text-pink-600">
                  {vendorAnalysis.length > 0 ? ((vendorAnalysis.slice(0, 3).reduce((s, v) => s + v.totalCost, 0) / vendorAnalysis.reduce((s, v) => s + v.totalCost, 0) * 100).toFixed(0)) : 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">top 3</div>
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
                // Show all vendors
                <BarChart data={chartVendorData.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="vendor" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `$${value.toLocaleString()} - ${props.payload.percentOfQuote.toFixed(2)}% of total quote - ${props.payload.items} items from this vendor`,
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
                // Show category breakdown for selected vendor
                <PieChart>
                  <Pie
                    data={(() => {
                      const categoryMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const cat = item.category || 'Uncategorized';
                        categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.totalCost);
                      });
                      return Array.from(categoryMap.entries()).map(([category, cost]) => ({
                        name: category,
                        cost,
                        percent: (cost / filteredItems.reduce((s, i) => s + i.totalCost, 0)) * 100
                      }));
                    })()}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {(() => {
                      const categoryMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const cat = item.category || 'Uncategorized';
                        categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.totalCost);
                      });
                      return Array.from(categoryMap.entries()).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ));
                    })()}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${entry.payload.percent.toFixed(1)}%)`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `$${value.toLocaleString()} - ${props.payload.percent.toFixed(1)}% of vendor total`,
                      props.payload.name
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
                      `$${value.toLocaleString()} - ${props.payload.percentOfQuote.toFixed(1)}% of total quote cost - ${props.payload.items} items`,
                      props.payload.vendor
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
                    <tr key={vendor.vendor} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedVendor(vendor.vendor)} title="Click to view items from this vendor">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium border-r border-gray-200">
                        {vendor.vendor}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">{vendor.items} items</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">${vendor.totalCost.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">${vendor.avgRate.toFixed(2)}</td>
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

                      {/* Category - Clickable */}
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this category">
                        <button
                          onClick={() => navigateToTab('items', { selectedCategory: item.category || 'Uncategorized' })}
                          className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.category || 'Uncategorized'}
                        </button>
                      </td>

                      {/* BOM - Clickable */}
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this BOM">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bomPath })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.bomPath}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                        {item.quantity} {item.unit}
                      </td>

                      {/* Rate - Clickable */}
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view in Rate View">
                        <button
                          onClick={() => navigateToTab('items', { selectedItem: item.itemCode })}
                          className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                        >
                          ${item.quotedRate.toLocaleString()}
                        </button>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 text-xs">
                        ${item.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            {selectedVendor === 'all' ? (
              <span><span className="font-medium">Note:</span> Click on any vendor name to view their items. Click metric cards to filter data.</span>
            ) : (
              <span><span className="font-medium">Note:</span> Click Category, BOM, or Rate to navigate to respective views. <button onClick={() => setSelectedVendor('all')} className="text-blue-700 hover:underline font-medium ml-2">← Back to All Vendors</button></span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
