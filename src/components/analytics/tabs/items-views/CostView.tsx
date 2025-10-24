import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { ItemViewType } from '../ItemsTab';

interface CostViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  totalItems: number;
  navigationContext?: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  setSelectedView?: (view: ItemViewType) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type SourceType = 'Event' | 'Project' | 'Quote';

const STAGE_COLORS: Record<SourceType, string> = {
  'Event': '#8b5cf6',
  'Project': '#3b82f6',
  'Quote': '#10b981'
};

// Mock function to determine item source (matches ItemSourceView logic)
const getItemSource = (itemCode: string): SourceType => {
  // Use itemCode to deterministically generate source
  const hash = itemCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = (hash % 100) / 100;

  if (rand < 0.7) {
    // 70% from full pipeline (Project → Event → Quote)
    return 'Project';
  } else if (rand < 0.9) {
    // 20% from Event → Quote (no Project)
    return 'Event';
  } else {
    // 10% added directly in Quote
    return 'Quote';
  }
};

// Mock function to calculate item additional costs (same logic as in AdditionalCostsView)
const getItemAdditionalCosts = (itemCode: string, itemCost: number, quantity: number) => {
  const costs = [];
  const random = itemCode.charCodeAt(0) % 5;

  if (random >= 1) {
    const totalCost = Math.floor(itemCost * 0.02);
    costs.push({ type: 'MOQ', totalAmount: totalCost, perUnitAmount: totalCost / quantity });
  }
  if (random >= 2) {
    const perUnit = Math.floor((itemCost / quantity) * 0.015);
    costs.push({ type: 'Testing', totalAmount: perUnit * quantity, perUnitAmount: perUnit });
  }
  if (random >= 3) {
    const percentage = 5;
    const baseRate = itemCost / quantity;
    const perUnit = (percentage / 100) * baseRate;
    costs.push({ type: 'Coating', totalAmount: perUnit * quantity, perUnitAmount: perUnit });
  }
  if (random >= 4) {
    const totalCost = Math.floor(itemCost * 0.025);
    costs.push({ type: 'Freight', totalAmount: totalCost, perUnitAmount: totalCost / quantity });
  }

  return costs;
};

export default function CostView({ data, totalQuoteValue, totalItems, navigationContext, navigateToTab, setSelectedView }: CostViewProps) {
  // Filters
  const [topN, setTopN] = useState(10);
  const [costRange, setCostRange] = useState<[number, number]>([0, 50000]);
  const [percentThreshold, setPercentThreshold] = useState(0);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']); // Changed to array
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']); // Changed to array
  const [sortMode, setSortMode] = useState<'with-ac' | 'rate-only'>('with-ac'); // Default: With AC
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Auto-select BOM from navigation context
  React.useEffect(() => {
    if (navigationContext?.selectedBOM) {
      // Use the full BOM path (e.g., "A.1.1" for sub-sub-BOM)
      // This allows filtering to specific sub-BOMs
      setSelectedBOMs([navigationContext.selectedBOM]);
      setFiltersExpanded(true); // Expand filters to show what's selected
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

  // Get unique BOMs and Vendors
  const uniqueBOMs = useMemo(() => {
    const boms = Array.from(new Set(data.overall.map(item => item.bomPath))).sort();
    return boms;
  }, [data.overall]);

  const uniqueVendors = useMemo(() => {
    const vendors = new Set(data.overall.map(item => item.vendor));
    return Array.from(vendors).sort();
  }, [data.overall]);

  // Calculate items with AC data
  const itemsWithACData = useMemo(() => {
    return data.overall.map(item => {
      const acList = getItemAdditionalCosts(item.itemCode, item.totalCost, item.quantity);
      const totalItemAC = acList.reduce((sum, ac) => sum + ac.totalAmount, 0);
      const itemACPerUnit = totalItemAC / item.quantity;

      return {
        ...item,
        itemAdditionalCosts: acList,
        totalItemAC,
        itemACPerUnit,
        finalTotalCost: item.totalCost + totalItemAC,
        rateOnly: item.quotedRate,
        rateWithAC: item.quotedRate + itemACPerUnit
      };
    });
  }, [data.overall]);

  // Filter and sort items based on mode - supports multiple selections
  const filteredItems = useMemo(() => {
    let items = [...itemsWithACData];

    // Apply BOM filter (multiple)
    if (!selectedBOMs.includes('all')) {
      items = items.filter(item =>
        selectedBOMs.some(bom => item.bomPath === bom || item.bomPath.startsWith(bom + '.'))
      );
    }

    // Apply Vendor filter (multiple)
    if (!selectedVendors.includes('all')) {
      items = items.filter(item =>
        selectedVendors.includes(item.vendor)
      );
    }

    // Sort based on mode
    if (sortMode === 'with-ac') {
      items.sort((a, b) => b.finalTotalCost - a.finalTotalCost);
    } else {
      items.sort((a, b) => b.totalCost - a.totalCost);
    }

    // Apply cost range filter (based on mode)
    const costToCheck = sortMode === 'with-ac' ? 'finalTotalCost' : 'totalCost';
    items = items.filter(item => item[costToCheck] >= costRange[0] && item[costToCheck] <= costRange[1]);

    // Apply percent threshold filter
    items = items.filter(item => item.percentOfQuote >= percentThreshold);

    // Apply Top N
    return items.slice(0, topN);
  }, [itemsWithACData, selectedBOMs, selectedVendors, costRange, percentThreshold, topN, sortMode]);

  // Calculate insights from filtered data
  const insights = useMemo(() => {
    const costField = sortMode === 'with-ac' ? 'finalTotalCost' : 'totalCost';
    const total = filteredItems.reduce((sum, item) => sum + item[costField], 0);
    const totalAC = filteredItems.reduce((sum, item) => sum + item.totalItemAC, 0);
    const avgCost = total / filteredItems.length || 0;
    const maxCost = Math.max(...filteredItems.map(i => i[costField]), 0);

    return {
      total,
      totalAC,
      percent: (total / totalQuoteValue) * 100,
      avgCost,
      maxCost,
      count: filteredItems.length
    };
  }, [filteredItems, totalQuoteValue, sortMode]);

  // Chart data for cost distribution
  const costDistributionData = useMemo(() => {
    const costField = sortMode === 'with-ac' ? 'finalTotalCost' : 'totalCost';
    return filteredItems.slice(0, 6).map(item => ({
      name: item.itemCode,
      cost: item[costField],
      itemCost: item.totalCost,
      ac: item.totalItemAC,
      percent: item.percentOfQuote
    }));
  }, [filteredItems, sortMode]);

  // BOM breakdown pie chart data
  const bomBreakdownData = useMemo(() => {
    const bomTotals = new Map<string, number>();
    const costField = sortMode === 'with-ac' ? 'finalTotalCost' : 'totalCost';
    filteredItems.forEach(item => {
      const mainBom = item.bomPath.split('.')[0];
      bomTotals.set(mainBom, (bomTotals.get(mainBom) || 0) + item[costField]);
    });

    return Array.from(bomTotals.entries()).map(([bom, cost]) => ({
      name: `BOM ${bom}`,
      value: cost
    }));
  }, [filteredItems, sortMode]);

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
                  if (val === '') {
                    setTopN(1);
                  } else {
                    setTopN(Math.min(50, Math.max(1, Number(val))));
                  }
                }}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                placeholder="10"
              />
              <span className="text-xs text-gray-500">items</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                BOMs: {selectedBOMs.includes('all') ? 'All' : selectedBOMs.join(', ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                Vendors: {selectedVendors.includes('all') ? 'All' : `${selectedVendors.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Min % Quote:</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={percentThreshold === 0 ? '' : percentThreshold}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '-') {
                    setPercentThreshold(0);
                  } else {
                    const num = Number(val);
                    if (!isNaN(num)) {
                      setPercentThreshold(Math.min(100, Math.max(0, num)));
                    }
                  }
                }}
                placeholder="0"
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>

            {/* Sort Mode Toggle: With AC vs Rate Only */}
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs font-semibold text-blue-900">Sort By:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortMode('with-ac')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    sortMode === 'with-ac'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-blue-100'
                  }`}
                  title="Show most expensive items INCLUDING item additional costs (Default)"
                >
                  💰 With Item AC
                </button>
                <button
                  onClick={() => setSortMode('rate-only')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    sortMode === 'rate-only'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-blue-100'
                  }`}
                  title="Show most expensive items by Rate only (excluding item additional costs)"
                >
                  📊 Rate Only
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

            {(topN !== 10 || !selectedBOMs.includes('all') || !selectedVendors.includes('all') || percentThreshold !== 0 || sortMode !== 'with-ac') && (
              <button
                onClick={() => {
                  setTopN(10);
                  setCostRange([0, 50000]);
                  setPercentThreshold(0);
                  setSelectedBOMs(['all']);
                  setSelectedVendors(['all']);
                  setSortMode('with-ac');
                }}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Advanced Filters (Collapsible) - Multi-Select Checkboxes */}
          {filtersExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {/* Multi-Select Checkboxes */}
              <div className="grid grid-cols-3 gap-4">
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
                  {uniqueBOMs.map(bom => (
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
                  {uniqueVendors.slice(0, 6).map(vendor => (
                    <label key={vendor} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor)}
                        onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor))}
                        className="rounded"
                      />
                      <span className="truncate">{vendor.split(' ')[0]}</span>
                    </label>
                  ))}
                </div>

                {/* Cost Range */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-700">Cost Range:</label>
                    <span className="text-xs text-blue-600">
                      ${costRange[0].toLocaleString()} - ${costRange[1].toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50000"
                      step="1000"
                      value={costRange[0]}
                      onChange={(e) => setCostRange([Number(e.target.value), costRange[1]])}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="range"
                      min="0"
                      max="50000"
                      step="1000"
                      value={costRange[1]}
                      onChange={(e) => setCostRange([costRange[0], Number(e.target.value)])}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights - Small Charts */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Cost Card */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">
              {sortMode === 'with-ac' ? 'Total (With Item AC)' : 'Total (Rate Only)'}
            </div>
            <div className="text-2xl font-bold text-blue-600">${insights.total.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{insights.percent.toFixed(1)}% of quote</div>
            <div className="text-xs text-gray-500">{insights.count} items</div>
          </CardContent>
        </Card>

        {/* Item AC Card */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Item Additional Costs</div>
            <div className="text-2xl font-bold text-orange-600">${insights.totalAC.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {insights.total > 0 ? ((insights.totalAC / insights.total) * 100).toFixed(1) : 0}% of {sortMode === 'with-ac' ? 'total' : 'items cost'}
            </div>
          </CardContent>
        </Card>

        {/* Max Cost Card */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Highest Cost</div>
            <div className="text-2xl font-bold text-green-600">${insights.maxCost.toLocaleString()}</div>
            {filteredItems.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">{filteredItems[0].itemCode}</div>
            )}
          </CardContent>
        </Card>

        {/* Item Count Card */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Items Shown</div>
            <div className="text-2xl font-bold text-purple-600">{insights.count}</div>
            <div className="text-xs text-gray-500 mt-1">of {totalItems} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost Distribution Bar Chart */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              Top Items by {sortMode === 'with-ac' ? 'Total Cost (With Item AC)' : 'Item Cost (Rate Only)'}
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => {
                    if (sortMode === 'with-ac') {
                      return [
                        `Total: $${value.toLocaleString()} | Item Cost: $${props.payload.itemCost.toLocaleString()} | Item AC: $${props.payload.ac.toLocaleString()} (${props.payload.percent.toFixed(2)}% of quote)`,
                        'Total Cost (Item + Item Additional Costs)'
                      ];
                    } else {
                      return [
                        `Item Cost: $${value.toLocaleString()} | Item AC: $${props.payload.ac.toLocaleString()} (${props.payload.percent.toFixed(2)}% of quote)`,
                        'Item Cost Only (Qty × Rate)'
                      ];
                    }
                  }}
                  labelFormatter={(label) => `Item: ${label}`}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* BOM Breakdown Pie Chart */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {sortMode === 'with-ac' ? 'Total Cost' : 'Item Cost'} Split by BOM
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={bomBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${(entry.value / 1000).toFixed(0)}k`}
                  outerRadius={70}
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
                    if (sortMode === 'with-ac') {
                      return [`$${value.toLocaleString()} - ${percent.toFixed(1)}% of displayed items (includes Item Additional Costs)`, 'Total Cost in this BOM'];
                    } else {
                      return [`$${value.toLocaleString()} - ${percent.toFixed(1)}% of displayed items (excludes Item Additional Costs)`, 'Item Cost in this BOM'];
                    }
                  }}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Excel-like Table with Interlinks */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">
              Item Details - {sortMode === 'with-ac' ? 'Sorted by Total (With Item AC)' : 'Sorted by Rate Only'}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Category</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-xs">Source</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Quantity</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Additional Cost</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% of Quote</th>
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
                    <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this category in Category View">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('category');
                            // Pass context through parent component
                            navigateToTab('items', { selectedCategory: item.category || 'Uncategorized', selectedItem: item.itemCode });
                          }
                        }}
                        className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                      >
                        {item.category || 'Uncategorized'}
                      </button>
                    </td>

                    {/* Vendor - Clickable */}
                    <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this vendor in Vendor View">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('vendor');
                            // Pass context through parent component
                            navigateToTab('items', { selectedVendor: item.vendor, selectedItem: item.itemCode });
                          }
                        }}
                        className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                      >
                        {item.vendor}
                      </button>
                    </td>

                    {/* BOM - Clickable */}
                    <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this BOM in BOM Tab">
                      <button
                        onClick={() => navigateToTab('bom', { selectedBOM: item.bomPath })}
                        className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                      >
                        {item.bomPath}
                      </button>
                    </td>

                    {/* Source - Clickable */}
                    <td className="px-3 py-2 text-center border-r border-gray-200 group cursor-pointer" title="Click to view source details in Item Source View">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('item-source');
                            const itemSource = getItemSource(item.itemCode);
                            navigateToTab('items', { selectedSource: itemSource, selectedItem: item.itemCode });
                          }
                        }}
                        className="inline-block px-2 py-1 rounded text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: STAGE_COLORS[getItemSource(item.itemCode)] }}
                      >
                        {getItemSource(item.itemCode)}
                      </button>
                    </td>

                    <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                      {item.quantity} {item.unit}
                    </td>

                    {/* Rate - Clickable */}
                    <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view this item in Rate View">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('rate');
                            navigateToTab('items', { selectedItem: item.itemCode });
                          }
                        }}
                        className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                      >
                        ${item.quotedRate.toLocaleString()}
                      </button>
                    </td>

                    {/* Item AC - Clickable */}
                    <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to view this item's additional costs">
                      <button
                        onClick={() => {
                          if (setSelectedView) {
                            setSelectedView('additional-costs');
                            navigateToTab('items', { selectedItem: item.itemCode });
                          }
                        }}
                        className="font-mono text-xs text-orange-700 group-hover:text-orange-900 group-hover:underline font-semibold block w-full text-right"
                      >
                        ${item.totalItemAC.toLocaleString()}
                      </button>
                      {item.totalItemAC > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5 italic">
                          {item.itemAdditionalCosts.map(ac => ac.type).join(', ')}
                        </div>
                      )}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">
                      ${item.finalTotalCost.toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-right text-gray-600 text-xs">{item.percentOfQuote.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            <span className="font-medium">Note:</span> Click on Category, Vendor, BOM, Source, Rate, or Additional Cost values to navigate to respective views.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
