import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, VendorRateDeviation } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData } from '../../../../services/api';

interface RateViewProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol?: string;
  totalQuoteValue: number;
  vendorRateDeviation: VendorRateDeviation;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

// Currency code to symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'INR': '₹',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CNY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'CHF',
  'SGD': 'S$',
  'AED': 'AED',
  'SAR': 'SAR',
};

const getCurrencySymbol = (code: string | null | undefined): string => {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code + ' ';
};

export default function RateView({ costViewData, currencySymbol = '₹', totalQuoteValue, navigateToTab, navigationContext }: RateViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'markup' | 'total' | 'rate'>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get items from costViewData
  const items = costViewData?.items || [];
  const filters = costViewData?.filters;

  // Auto-select from navigation context
  useEffect(() => {
    if (navigationContext?.selectedItem) {
      setSearchQuery(navigationContext.selectedItem);
    }
  }, [navigationContext]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBOMs, selectedVendors, selectedCategories, sortBy, sortOrder]);

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

  // Get unique BOMs with hierarchy
  const { uniqueBOMs, rootBOMCount } = useMemo(() => {
    const bomSet = new Set<string>();
    const rootBOMs = new Set<string>();

    items.forEach(item => {
      if (item.bom_path) {
        bomSet.add(item.bom_path);
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);
        let path = '';
        parts.forEach((part, idx) => {
          path = idx === 0 ? part : `${path} > ${part}`;
          bomSet.add(path);
        });
      }
    });

    const sortedBOMs = Array.from(bomSet).sort((a, b) => {
      const depthA = a.split(' > ').length;
      const depthB = b.split(' > ').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    return { uniqueBOMs: sortedBOMs, rootBOMCount: rootBOMs.size };
  }, [items]);

  // Calculate rates for each item
  const itemRates = useMemo(() => {
    return items.map(item => {
      const vendorRate = item.vendor_rate || 0;
      const baseRate = item.base_rate || 0;
      const quotedRate = item.quoted_rate || 0;
      const additionalCostsPerUnit = item.additional_cost_per_unit || 0;
      const totalAC = item.total_additional_cost || 0;
      const itemTotal = item.total_amount || 0;

      // Calculate markup from vendor rate to base rate
      const markup = vendorRate > 0 ? ((baseRate - vendorRate) / vendorRate) * 100 : 0;

      // Get vendor currency symbol from code
      const vendorCurrencySymbol = getCurrencySymbol(item.vendor_currency);

      return {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        vendor_name: item.vendor_name,
        vendor_currency_code: item.vendor_currency || 'INR',
        vendor_currency_symbol: vendorCurrencySymbol || currencySymbol,
        bom_path: item.bom_path,
        tags: item.tags,
        vendor_rate: vendorRate,
        base_rate: baseRate,
        quoted_rate: quotedRate,
        additional_cost_per_unit: additionalCostsPerUnit,
        total_ac: totalAC,
        item_total: itemTotal,
        markup,
        percent_of_quote: item.percent_of_quote || 0
      };
    });
  }, [items, currencySymbol]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = [...itemRates];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(query) ||
        item.item_name.toLowerCase().includes(query)
      );
    }

    // BOM filter
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom || item.bom_path?.startsWith(bom + ' > ')
        )
      );
    }

    // Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_name && selectedVendors.includes(item.vendor_name)
      );
    }

    // Category filter
    if (!selectedCategories.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedCategories.includes(tag))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortBy === 'markup') {
        aVal = a.markup;
        bVal = b.markup;
      } else if (sortBy === 'total') {
        aVal = a.item_total;
        bVal = b.item_total;
      } else if (sortBy === 'rate') {
        aVal = a.quoted_rate;
        bVal = b.quoted_rate;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [itemRates, searchQuery, selectedBOMs, selectedVendors, selectedCategories, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Key insights from filtered items
  const insights = useMemo(() => {
    if (filteredItems.length === 0) {
      return { avgMarkup: 0, highestMarkup: 0, lowestMarkup: 0, totalAC: 0, totalValue: 0 };
    }

    const avgMarkup = filteredItems.reduce((sum, item) => sum + item.markup, 0) / filteredItems.length;
    const highestMarkup = Math.max(...filteredItems.map(i => i.markup));
    const lowestMarkup = Math.min(...filteredItems.map(i => i.markup));
    const totalAC = filteredItems.reduce((sum, item) => sum + item.total_ac, 0);
    const totalValue = filteredItems.reduce((sum, item) => sum + item.item_total, 0);

    return { avgMarkup, highestMarkup, lowestMarkup, totalAC, totalValue };
  }, [filteredItems]);

  // Chart data - show top 10 by current sort, or filtered items if less than 10
  // Each item+vendor combination is unique
  const chartData = useMemo(() => {
    const dataToShow = filteredItems.slice(0, 10);
    return dataToShow.map((item, idx) => {
      // Create unique display name: ItemCode (Vendor short name)
      const vendorShort = item.vendor_name ? item.vendor_name.split(' ')[0] : 'N/A';
      const itemCodeShort = item.item_code.length > 6 ? item.item_code.substring(0, 6) + '..' : item.item_code;
      const displayName = `${itemCodeShort} (${vendorShort})`;

      return {
        name: displayName,
        fullName: item.item_code,
        itemName: item.item_name,
        vendorName: item.vendor_name || 'N/A',
        vendorCurrency: item.vendor_currency_symbol,
        'Vendor Rate': item.vendor_rate,
        'Base Rate': item.base_rate,
        'Quoted Rate': item.quoted_rate,
        markup: item.markup,
        uniqueKey: `${item.item_code}-${item.vendor_name}-${idx}`
      };
    });
  }, [filteredItems]);

  // Get unique vendors
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    items.forEach(item => {
      if (item.vendor_name) vendors.add(item.vendor_name);
    });
    return Array.from(vendors);
  }, [items]);

  // Get unique categories
  const uniqueCategories = useMemo(() => {
    return filters?.tag_list || [];
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[250px]">
              <span className="text-xs font-bold text-gray-800">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item code or name..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'markup' | 'total' | 'rate')}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="total">Total Amount</option>
                <option value="markup">Markup %</option>
                <option value="rate">Quoted Rate</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-100"
                title={sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
              >
                {sortOrder === 'desc' ? '↓ High' : '↑ Low'}
              </button>
            </div>

            {/* Filter Summary */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">
                {!selectedBOMs.includes('all') && `BOMs: ${selectedBOMs.length}`}
                {!selectedVendors.includes('all') && ` | Vendors: ${selectedVendors.length}`}
                {!selectedCategories.includes('all') && ` | Categories: ${selectedCategories.length}`}
              </span>
            </div>

            {/* More Filters Toggle */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {/* Reset */}
            {(searchQuery || !selectedBOMs.includes('all') || !selectedVendors.includes('all') || !selectedCategories.includes('all')) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBOMs(['all']);
                  setSelectedVendors(['all']);
                  setSelectedCategories(['all']);
                  setSortBy('total');
                  setSortOrder('desc');
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4">
              {/* BOMs - Grouped */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block">BOMs ({rootBOMCount}):</span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedBOMs.includes('all')}
                      onChange={() => setSelectedBOMs(['all'])}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">All BOMs</span>
                  </label>
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

              {/* Vendors */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block">Vendors:</span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
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
                      <span className="text-gray-600 truncate">{vendor}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block">Categories:</span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes('all')}
                      onChange={() => setSelectedCategories(['all'])}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 font-medium">All Categories</span>
                  </label>
                  {uniqueCategories.slice(0, 10).map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => setSelectedCategories(toggleSelection(selectedCategories, cat))}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600 truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Filtered Items</div>
            <div className="text-2xl font-bold text-blue-600">{filteredItems.length}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">of {itemRates.length} total</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Avg Markup</div>
            <div className="text-2xl font-bold text-green-600">{insights.avgMarkup.toFixed(1)}%</div>
            <div className="text-xs font-bold text-gray-700 mt-1">vendor → base</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Markup Range</div>
            <div className="text-lg font-bold text-purple-600">
              {insights.lowestMarkup.toFixed(0)}% - {insights.highestMarkup.toFixed(0)}%
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">min to max</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Total AC</div>
            <div className="text-2xl font-bold text-orange-600">
              {currencySymbol}{(insights.totalAC / 1000).toFixed(0)}k
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">additional costs</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Filtered Value</div>
            <div className="text-2xl font-bold text-indigo-600">
              {currencySymbol}{(insights.totalValue / 1000).toFixed(0)}k
            </div>
            <div className="text-xs font-bold text-gray-700 mt-1">
              {((insights.totalValue / totalQuoteValue) * 100).toFixed(1)}% of quote
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Comparison Chart */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Rate Comparison: Vendor → Base → Quoted</h4>
              <p className="text-xs text-gray-600">
                Showing top {Math.min(10, filteredItems.length)} items by {sortBy === 'markup' ? 'markup %' : sortBy === 'total' ? 'total amount' : 'quoted rate'}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#374151' }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                label={{ value: 'Item Code', position: 'bottom', offset: 45, fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#374151' }}
                tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                label={{ value: 'Rate per Unit', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const item = props.payload;
                  if (name === 'Vendor Rate') {
                    const vendorCurr = item.vendorCurrency || currencySymbol;
                    return [`${vendorCurr}${value.toLocaleString()}`, 'Vendor Rate'];
                  }
                  if (name === 'Base Rate') return [`${currencySymbol}${value.toLocaleString()} (${item.markup > 0 ? item.markup.toFixed(1) + '% markup' : 'N/A'})`, 'Base Rate'];
                  if (name === 'Quoted Rate') return [`${currencySymbol}${value.toLocaleString()}`, 'Quoted Rate'];
                  return [`${currencySymbol}${value.toLocaleString()}`, name];
                }}
                labelFormatter={(_label, payload) => {
                  const item = payload?.[0]?.payload;
                  return `${item?.fullName || ''} | ${item?.itemName || ''}\nVendor: ${item?.vendorName || 'N/A'}`;
                }}
                contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', whiteSpace: 'pre-line' }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="Vendor Rate" fill="#9ca3af" radius={[4, 4, 0, 0]} name="Vendor Rate" />
              <Bar dataKey="Base Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Base Rate" />
              <Bar dataKey="Quoted Rate" fill="#10b981" radius={[4, 4, 0, 0]} name="Quoted Rate" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Rate Table with Pagination */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex justify-between items-center">
            <h4 className="font-bold text-gray-900 text-sm">
              Complete Rate Breakdown
              {searchQuery && <span className="ml-2 text-blue-600 font-normal">- Searching: "{searchQuery}"</span>}
            </h4>
            <div className="text-xs text-gray-700 font-medium">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-xs">#</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-xs">Item Code</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-xs">Vendor</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">Qty</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">Vendor Rate</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">Base Rate</th>
                  <th className="px-3 py-2 text-center font-bold text-gray-700 border-r border-gray-300 text-xs">Markup</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">AC/Unit</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">Quoted Rate</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-r border-gray-300 text-xs">Total</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 text-xs">% Quote</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedItems.map((item, idx) => (
                  <tr
                    key={`${item.item_id}-${item.bom_path}-${idx}`}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">
                      {((currentPage - 1) * itemsPerPage) + idx + 1}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      <span className="font-mono font-medium text-gray-900 text-xs">{item.item_code}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-[150px] truncate text-xs" title={item.item_name}>
                      {item.item_name}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      <button
                        onClick={() => navigateToTab('items', { selectedVendor: item.vendor_name || undefined })}
                        className="text-xs text-blue-700 hover:text-blue-900 hover:underline font-medium"
                      >
                        {item.vendor_name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600 border-r border-gray-200 text-xs">
                      {item.vendor_rate > 0
                        ? `${item.vendor_currency_symbol}${item.vendor_rate.toLocaleString()}`
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-blue-600 border-r border-gray-200 text-xs">
                      {currencySymbol}{item.base_rate.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-200">
                      {item.vendor_rate > 0 ? (
                        <Badge className={`text-xs ${item.markup >= 15 ? 'bg-green-100 text-green-800' : item.markup >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {item.markup.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600 border-r border-gray-200 text-xs">
                      {currencySymbol}{item.additional_cost_per_unit.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-green-600 border-r border-gray-200 text-xs">
                      {currencySymbol}{item.quoted_rate.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">
                      {currencySymbol}{item.item_total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 text-xs">
                      {item.percent_of_quote.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <div className="text-xs text-gray-700 font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium"
              >
                Next →
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium"
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
