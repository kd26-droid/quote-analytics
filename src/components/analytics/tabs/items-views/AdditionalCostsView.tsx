import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData, CostViewItem } from '../../../../services/api';

interface AdditionalCostsViewProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol?: string;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SOURCE_COLORS: Record<string, string> = {
  'PROJECT': '#3b82f6',
  'EVENT': '#10b981',
  'QUOTE': '#f59e0b'
};

const SOURCE_LABELS: Record<string, string> = {
  'PROJECT': 'Project',
  'EVENT': 'Event',
  'QUOTE': 'Quote'
};

export default function AdditionalCostsView({
  costViewData,
  currencySymbol = '₹',
  totalQuoteValue,
  navigateToTab,
  navigationContext
}: AdditionalCostsViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filters
  const [selectedACTypes, setSelectedACTypes] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [hasACOnly, setHasACOnly] = useState(true); // Default to show only items with AC
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  }, [searchQuery, selectedACTypes, selectedVendors, selectedBOMs, selectedCategories, hasACOnly]);

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

  // Get all unique AC types from items
  const allACTypes = useMemo(() => {
    const acTypeSet = new Set<string>();
    items.forEach(item => {
      item.additional_costs.forEach(ac => {
        acTypeSet.add(ac.cost_name);
      });
    });
    return Array.from(acTypeSet).sort();
  }, [items]);

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

  // Get unique vendors
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    items.forEach(item => {
      if (item.vendor_name) vendors.add(item.vendor_name);
    });
    return Array.from(vendors).sort();
  }, [items]);

  // Get unique categories
  const uniqueCategories = useMemo(() => {
    return filters?.tag_list || [];
  }, [filters]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(query) ||
        item.item_name.toLowerCase().includes(query)
      );
    }

    // Has AC only
    if (hasACOnly) {
      result = result.filter(item => item.total_additional_cost > 0);
    }

    // AC type filter
    if (!selectedACTypes.includes('all')) {
      result = result.filter(item =>
        item.additional_costs.some(ac => selectedACTypes.includes(ac.cost_name))
      );
    }

    // Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_name && selectedVendors.includes(item.vendor_name)
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

    // Category filter
    if (!selectedCategories.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedCategories.includes(tag))
      );
    }

    // Sort by total AC descending
    result.sort((a, b) => b.total_additional_cost - a.total_additional_cost);

    return result;
  }, [items, searchQuery, hasACOnly, selectedACTypes, selectedVendors, selectedBOMs, selectedCategories]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // AC type breakdown for charts
  const acTypeBreakdown = useMemo(() => {
    const typeMap = new Map<string, number>();
    filteredItems.forEach(item => {
      item.additional_costs.forEach(ac => {
        if (selectedACTypes.includes('all') || selectedACTypes.includes(ac.cost_name)) {
          typeMap.set(ac.cost_name, (typeMap.get(ac.cost_name) || 0) + ac.total_amount);
        }
      });
    });
    return Array.from(typeMap.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // Top 8 for chart
  }, [filteredItems, selectedACTypes]);

  // Key insights
  const insights = useMemo(() => {
    const totalAC = filteredItems.reduce((sum, item) => sum + item.total_additional_cost, 0);
    const itemsWithAC = filteredItems.filter(i => i.total_additional_cost > 0).length;
    const avgACPerItem = itemsWithAC > 0 ? totalAC / itemsWithAC : 0;
    const totalItemCost = filteredItems.reduce((sum, item) => sum + (item.base_rate * item.quantity), 0);
    const totalFinalCost = filteredItems.reduce((sum, item) => sum + item.total_amount, 0);

    return { totalAC, itemsWithAC, avgACPerItem, totalItemCost, totalFinalCost, acTypesCount: acTypeBreakdown.length };
  }, [filteredItems, acTypeBreakdown]);

  // Dynamic columns - get AC types present in current page items
  const dynamicACColumns = useMemo(() => {
    const acTypesInPage = new Set<string>();
    paginatedItems.forEach(item => {
      item.additional_costs.forEach(ac => {
        acTypesInPage.add(ac.cost_name);
      });
    });
    // Sort and limit to top 8 to avoid too many columns
    return Array.from(acTypesInPage).sort().slice(0, 8);
  }, [paginatedItems]);

  // Tags display helper - shows count with hover for all, clickable to navigate
  const renderTags = (tags: string[], isNearBottom: boolean = false) => {
    if (tags.length === 0) {
      return <span className="text-gray-500 text-xs">Uncategorized</span>;
    }

    if (tags.length === 1) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateToTab('items', { selectedCategory: tags[0] });
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
            navigateToTab('items', { selectedCategory: tags[0] });
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
              onClick={(e) => {
                e.stopPropagation();
                navigateToTab('items', { selectedCategory: tag });
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

  // Get AC value for an item by cost name
  const getACValue = (item: CostViewItem, costName: string) => {
    const ac = item.additional_costs.find(a => a.cost_name === costName);
    return ac ? { total: ac.total_amount, perUnit: ac.per_unit_amount, type: ac.cost_type } : null;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item code or name..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              )}
            </div>

            {/* Has AC Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasACOnly}
                onChange={(e) => setHasACOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-bold text-gray-700">Has AC Only</span>
            </label>

            {/* Filter Summary */}
            <span className="text-xs text-gray-600">
              {!selectedACTypes.includes('all') && `AC Types: ${selectedACTypes.length}`}
              {!selectedVendors.includes('all') && ` | Vendors: ${selectedVendors.length}`}
              {!selectedBOMs.includes('all') && ` | BOMs: ${selectedBOMs.length}`}
            </span>

            {/* More Filters Toggle */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {/* Reset */}
            {(searchQuery || !selectedACTypes.includes('all') || !selectedVendors.includes('all') || !selectedBOMs.includes('all') || !selectedCategories.includes('all')) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedACTypes(['all']);
                  setSelectedVendors(['all']);
                  setSelectedBOMs(['all']);
                  setSelectedCategories(['all']);
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
              >
                Reset
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-4">
              {/* AC Types */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block">AC Types ({allACTypes.length}):</span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedACTypes.includes('all')}
                      onChange={() => setSelectedACTypes(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All Types</span>
                  </label>
                  {allACTypes.slice(0, 10).map(type => (
                    <label key={type} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedACTypes.includes(type)}
                        onChange={() => setSelectedACTypes(toggleSelection(selectedACTypes, type))}
                        className="rounded"
                      />
                      <span className="truncate" title={type}>{type}</span>
                    </label>
                  ))}
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
                      className="rounded"
                    />
                    <span className="font-medium">All Vendors</span>
                  </label>
                  {uniqueVendors.slice(0, 10).map(vendor => (
                    <label key={vendor} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor)}
                        onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor))}
                        className="rounded"
                      />
                      <span className="truncate">{vendor}</span>
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
                      className="rounded"
                    />
                    <span className="font-medium">All Categories</span>
                  </label>
                  {uniqueCategories.slice(0, 10).map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => setSelectedCategories(toggleSelection(selectedCategories, cat))}
                        className="rounded"
                      />
                      <span className="truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* BOMs - Grouped */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block">BOMs ({rootBOMCount}):</span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedBOMs.includes('all')}
                      onChange={() => setSelectedBOMs(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All BOMs</span>
                  </label>
                  {(() => {
                    const rootBOMsList = uniqueBOMs.filter(bom => !bom.includes(' > '));
                    return rootBOMsList.map(rootBom => {
                      const childBOMs = uniqueBOMs.filter(bom => bom.startsWith(rootBom + ' > '));
                      const hasChildren = childBOMs.length > 0;
                      const isRootSelected = selectedBOMs.includes(rootBom);

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
                        </div>
                      );
                    });
                  })()}
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
            <div className="text-xs font-bold text-gray-800 mb-1">Total AC</div>
            <div className="text-2xl font-bold text-orange-600">{currencySymbol}{(insights.totalAC / 1000).toFixed(0)}k</div>
            <div className="text-xs font-bold text-gray-700 mt-1">{((insights.totalAC / totalQuoteValue) * 100).toFixed(1)}% of quote</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Items with AC</div>
            <div className="text-2xl font-bold text-blue-600">{insights.itemsWithAC}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">of {filteredItems.length} filtered</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Avg AC/Item</div>
            <div className="text-2xl font-bold text-green-600">{currencySymbol}{insights.avgACPerItem.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">for items with AC</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">AC Types</div>
            <div className="text-2xl font-bold text-purple-600">{insights.acTypesCount}</div>
            <div className="text-xs font-bold text-gray-700 mt-1">unique types</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-3">
            <div className="text-xs font-bold text-gray-800 mb-1">Total Final Cost</div>
            <div className="text-2xl font-bold text-indigo-600">{currencySymbol}{(insights.totalFinalCost / 1000).toFixed(0)}k</div>
            <div className="text-xs font-bold text-gray-700 mt-1">incl. all AC</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* AC Type Breakdown Pie */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-bold text-gray-900 mb-3 text-sm">AC Breakdown by Type (Top 8)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={acTypeBreakdown}
                  cx="35%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={65}
                  fill="#8884d8"
                  dataKey="total"
                  nameKey="type"
                >
                  {acTypeBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => {
                    const total = acTypeBreakdown.reduce((s, i) => s + i.total, 0);
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return [`${currencySymbol}${value.toLocaleString()} (${percent}%)`, props.payload.type];
                  }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: '10px', paddingLeft: '10px' }}
                  formatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Items by AC Bar */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-bold text-gray-900 mb-3 text-sm">Top Items by Total AC</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredItems.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${currencySymbol}${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'Total AC', position: 'bottom', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                />
                <YAxis
                  dataKey="item_code"
                  type="category"
                  width={70}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Item', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold', fill: '#374151' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Total AC']}
                  labelFormatter={(label) => `Item: ${label}`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="total_additional_cost" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic AC Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex justify-between items-center">
            <h4 className="font-bold text-gray-900 text-sm">
              Additional Costs Breakdown
              {searchQuery && <span className="ml-2 text-blue-600 font-normal">- Searching: "{searchQuery}"</span>}
            </h4>
            <div className="text-xs text-gray-700 font-medium">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-2 py-2 text-left font-bold text-gray-700 border-r border-gray-300">#</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700 border-r border-gray-300">Item Code</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700 border-r border-gray-300">Item Name</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700 border-r border-gray-300">Tags</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700 border-r border-gray-300">Vendor</th>
                  <th className="px-2 py-2 text-center font-bold text-gray-700 border-r border-gray-300">Source</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-700 border-r border-gray-300">Qty</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-700 border-r border-gray-300">Base Rate</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-700 border-r border-gray-300">Item Cost</th>
                  {/* Dynamic AC Columns */}
                  {dynamicACColumns.map(acType => (
                    <th key={acType} className="px-2 py-2 text-right font-bold text-orange-700 border-r border-gray-300" title={acType}>
                      <div className="truncate max-w-[80px]" title={acType}>
                        {acType.length > 10 ? acType.substring(0, 10) + '...' : acType}
                      </div>
                      <div className="text-[9px] text-gray-500 font-normal">(Per Unit / Total)</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-bold text-orange-700 border-r border-gray-300">Total AC</th>
                  <th className="px-2 py-2 text-right font-bold text-gray-700">Final Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedItems.map((item, idx) => {
                  const isNearBottom = idx >= paginatedItems.length - 4;
                  const itemCost = item.base_rate * item.quantity;

                  return (
                    <tr key={`${item.item_id}-${item.bom_path}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-2 py-2 text-gray-600 border-r border-gray-200">
                        {((currentPage - 1) * itemsPerPage) + idx + 1}
                      </td>
                      <td className="px-2 py-2 font-mono font-medium text-gray-900 border-r border-gray-200">
                        {item.item_code}
                      </td>
                      <td className="px-2 py-2 text-gray-700 border-r border-gray-200 max-w-[100px] truncate" title={item.item_name}>
                        {item.item_name}
                      </td>
                      <td className="px-2 py-2 border-r border-gray-200">
                        {renderTags(item.tags, isNearBottom)}
                      </td>
                      <td className="px-2 py-2 border-r border-gray-200">
                        <button
                          onClick={() => navigateToTab('items', { selectedVendor: item.vendor_name || undefined })}
                          className="text-blue-700 hover:text-blue-900 hover:underline font-medium truncate max-w-[80px] block"
                          title={item.vendor_name || 'N/A'}
                        >
                          {item.vendor_name || 'N/A'}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center border-r border-gray-200">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: SOURCE_COLORS[item.item_source] || '#6b7280' }}
                        >
                          {SOURCE_LABELS[item.item_source] || item.item_source}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-700 border-r border-gray-200">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-900 border-r border-gray-200">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-900 border-r border-gray-200">
                        {currencySymbol}{itemCost.toLocaleString()}
                      </td>
                      {/* Dynamic AC Values */}
                      {dynamicACColumns.map(acType => {
                        const acValue = getACValue(item, acType);
                        return (
                          <td key={acType} className="px-2 py-2 text-right border-r border-gray-200">
                            {acValue ? (
                              <div className="relative group">
                                <span className="font-mono text-orange-600 cursor-help">
                                  {currencySymbol}{acValue.total.toLocaleString()}
                                </span>
                                <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`} style={{ minWidth: '140px' }}>
                                  <div className="text-xs font-bold text-gray-700 mb-1 border-b pb-1">{acType}</div>
                                  <div className="text-xs text-gray-600">
                                    <div className="flex justify-between py-0.5">
                                      <span>Per Unit:</span>
                                      <span className="font-mono">{currencySymbol}{acValue.perUnit.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span>Total:</span>
                                      <span className="font-mono font-medium">{currencySymbol}{acValue.total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5 text-gray-500">
                                      <span>Type:</span>
                                      <span>{acValue.type}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right font-mono font-bold text-orange-700 border-r border-gray-200">
                        {currencySymbol}{item.total_additional_cost.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-gray-900">
                        {currencySymbol}{item.total_amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <div className="text-xs text-gray-700 font-medium">
              Page {currentPage} of {totalPages} | {dynamicACColumns.length} AC columns shown
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
