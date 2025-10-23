import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface AdditionalCostsViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Mock additional cost types for each item
const getItemAdditionalCosts = (itemCode: string, itemCost: number, quantity: number) => {
  const costs = [];
  const random = itemCode.charCodeAt(0) % 5;

  // MOQ - Usually OVERALL_QUANTITY (one-time setup cost)
  if (random >= 1) {
    const totalCost = Math.floor(itemCost * 0.02);
    costs.push({
      type: 'MOQ',
      costType: 'ABSOLUTE_VALUE',
      allocationType: 'OVERALL_QUANTITY',
      totalAmount: totalCost,
      perUnitAmount: totalCost / quantity
    });
  }

  // Testing - Usually PER_UNIT (test each item)
  if (random >= 2) {
    const perUnit = Math.floor((itemCost / quantity) * 0.015);
    costs.push({
      type: 'Testing',
      costType: 'ABSOLUTE_VALUE',
      allocationType: 'PER_UNIT',
      totalAmount: perUnit * quantity,
      perUnitAmount: perUnit
    });
  }

  // Coating - Usually PERCENTAGE (5% of base rate)
  if (random >= 3) {
    const percentage = 5;
    const baseRate = itemCost / quantity;
    const perUnit = (percentage / 100) * baseRate;
    costs.push({
      type: 'Coating',
      costType: 'PERCENTAGE',
      percentageValue: percentage,
      allocationType: 'PER_UNIT',
      totalAmount: perUnit * quantity,
      perUnitAmount: perUnit
    });
  }

  // Freight - Usually OVERALL_QUANTITY (ship entire batch)
  if (random >= 4) {
    const totalCost = Math.floor(itemCost * 0.025);
    costs.push({
      type: 'Freight',
      costType: 'ABSOLUTE_VALUE',
      allocationType: 'OVERALL_QUANTITY',
      totalAmount: totalCost,
      perUnitAmount: totalCost / quantity
    });
  }

  return costs;
};

export default function AdditionalCostsView({ data, totalQuoteValue, navigationContext }: AdditionalCostsViewProps) {
  const [selectedACTypes, setSelectedACTypes] = useState<string[]>(['all']); // Changed to array
  const [minACAmount, setMinACAmount] = useState(0);
  const [hasACOnly, setHasACOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']); // Changed to array
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']); // Changed to array
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']); // Changed to array
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Helper function to toggle multi-select
  const toggleSelection = (current: string[], value: string) => {
    if (value === 'all') {
      return ['all'];
    }

    let newSelection = current.filter(v => v !== 'all');

    if (newSelection.includes(value)) {
      newSelection = newSelection.filter(v => v !== value);
      if (newSelection.length === 0) {
        return ['all'];
      }
    } else {
      newSelection.push(value);
    }

    return newSelection;
  };

  // Get unique values for filters
  const uniqueCategories = useMemo(() => {
    const categories = Array.from(new Set(data.overall.map(item => item.category).filter(Boolean))).sort();
    return categories as string[];
  }, [data.overall]);

  const uniqueBOMs = useMemo(() => {
    const boms = Array.from(new Set(data.overall.map(item => item.bomPath))).sort();
    return boms;
  }, [data.overall]);

  const uniqueVendors = useMemo(() => {
    const vendors = Array.from(new Set(data.overall.map(item => item.vendor))).sort();
    return vendors;
  }, [data.overall]);

  // Calculate AC data for all items
  const itemsWithAC = useMemo(() => {
    return data.overall.map(item => {
      const acList = getItemAdditionalCosts(item.itemCode, item.totalCost, item.quantity);
      const totalAC = acList.reduce((sum, ac) => sum + ac.totalAmount, 0);
      return {
        ...item,
        additionalCosts: acList,
        totalAC,
        finalCost: item.totalCost + totalAC
      };
    });
  }, [data.overall]);

  // Filter items based on AC criteria - supports multiple selections
  const filteredItems = useMemo(() => {
    let items = itemsWithAC;

    // Filter by Categories (multiple)
    if (!selectedCategories.includes('all')) {
      items = items.filter(item =>
        selectedCategories.includes(item.category || 'Uncategorized')
      );
    }

    // Filter by BOMs (multiple)
    if (!selectedBOMs.includes('all')) {
      items = items.filter(item =>
        selectedBOMs.some(bom => item.bomPath.startsWith(bom))
      );
    }

    // Filter by Vendors (multiple)
    if (!selectedVendors.includes('all')) {
      items = items.filter(item =>
        selectedVendors.includes(item.vendor)
      );
    }

    // Filter by AC types (multiple)
    if (!selectedACTypes.includes('all')) {
      items = items.filter(item =>
        item.additionalCosts.some(ac => selectedACTypes.includes(ac.type))
      );
    }

    // Filter by min AC amount
    items = items.filter(item => item.totalAC >= minACAmount);

    // Filter has AC only
    if (hasACOnly) {
      items = items.filter(item => item.totalAC > 0);
    }

    return items;
  }, [itemsWithAC, selectedCategories, selectedBOMs, selectedVendors, selectedACTypes, minACAmount, hasACOnly]);

  // AC type breakdown - shows ONLY selected types when filtered
  const acTypeBreakdown = useMemo(() => {
    const typeMap = new Map<string, number>();
    filteredItems.forEach(item => {
      item.additionalCosts.forEach(ac => {
        // If specific AC types are selected, only count those types
        if (selectedACTypes.includes('all') || selectedACTypes.includes(ac.type)) {
          typeMap.set(ac.type, (typeMap.get(ac.type) || 0) + ac.totalAmount);
        }
      });
    });
    return Array.from(typeMap.entries()).map(([type, total]) => ({ type, total }));
  }, [filteredItems, selectedACTypes]);

  const totalAC = useMemo(() => {
    if (selectedACTypes.includes('all')) {
      return filteredItems.reduce((sum, item) => sum + item.totalAC, 0);
    }
    // Calculate total for only selected AC types
    return filteredItems.reduce((sum, item) => {
      const relevantACs = item.additionalCosts.filter(ac => selectedACTypes.includes(ac.type));
      return sum + relevantACs.reduce((s, ac) => s + ac.totalAmount, 0);
    }, 0);
  }, [filteredItems, selectedACTypes]);

  const acTypes = ['MOQ', 'Testing', 'Coating', 'Freight'];

  return (
    <div className="space-y-4">
      {/* Multi-Select Filters */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="space-y-3">
            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-gray-700">
                Filters: {selectedACTypes.includes('all') ? 'All AC Types' : `${selectedACTypes.length} AC Types`},
                {selectedCategories.includes('all') ? ' All Categories' : ` ${selectedCategories.length} Categories`},
                {selectedVendors.includes('all') ? ' All Vendors' : ` ${selectedVendors.length} Vendors`},
                {selectedBOMs.includes('all') ? ' All BOMs' : ` ${selectedBOMs.length} BOMs`}
              </span>
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {filtersExpanded ? '▲ Hide Filters' : '▼ Show Filters'}
              </button>
              {(!selectedACTypes.includes('all') || !selectedCategories.includes('all') || !selectedVendors.includes('all') || !selectedBOMs.includes('all') || minACAmount !== 0 || hasACOnly) && (
                <button
                  onClick={() => {
                    setSelectedCategories(['all']);
                    setSelectedBOMs(['all']);
                    setSelectedVendors(['all']);
                    setSelectedACTypes(['all']);
                    setMinACAmount(0);
                    setHasACOnly(false);
                  }}
                  className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Expanded Multi-Select Checkboxes */}
            {filtersExpanded && (
              <div className="pt-3 border-t grid grid-cols-4 gap-4">
                {/* AC Types */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">AC Types:</div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedACTypes.includes('all')}
                      onChange={() => setSelectedACTypes(['all'])}
                      className="rounded"
                    />
                    <span className="font-medium">All</span>
                  </label>
                  {acTypes.map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedACTypes.includes(type)}
                        onChange={() => setSelectedACTypes(toggleSelection(selectedACTypes, type))}
                        className="rounded"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>

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
                  {uniqueVendors.slice(0, 5).map(vendor => (
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
              </div>
            )}

            {/* Other Filters */}
            {filtersExpanded && (
              <div className="pt-3 border-t flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Min AC:</span>
                <span className="text-xs text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="10"
                  value={minACAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setMinACAmount(0);
                    } else {
                      setMinACAmount(Math.max(0, Number(val)));
                    }
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasACOnly}
                  onChange={(e) => setHasACOnly(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs font-semibold text-gray-600">Has AC Only</span>
              </label>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Key Insights - Clickable Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className="border-gray-200 hover:border-orange-400 transition-all cursor-pointer hover:shadow-md"
          onClick={() => setSelectedACTypes(['all'])}
          title="Click to show all AC types"
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total AC</div>
            <div className="text-2xl font-bold text-orange-600">${totalAC.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{((totalAC / totalQuoteValue) * 100).toFixed(1)}% of quote</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Items with AC</div>
            <div className="text-2xl font-bold text-blue-600">
              {itemsWithAC.filter(i => i.totalAC > 0).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">of {data.overall.length} total</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Avg AC per Item</div>
            <div className="text-2xl font-bold text-green-600">
              ${Math.floor(totalAC / (itemsWithAC.filter(i => i.totalAC > 0).length || 1)).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">for items with AC</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">AC Types</div>
            <div className="text-2xl font-bold text-purple-600">{acTypeBreakdown.length}</div>
            <div className="text-xs text-gray-500 mt-1">different types</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Dynamic based on AC Type selection */}
      <div className="grid grid-cols-2 gap-4">
        {/* AC Type Breakdown */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedACTypes.includes('all')
                ? 'Additional Cost Breakdown by Type'
                : `${selectedACTypes.join(', ')} Costs - Items Breakdown`}
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              {selectedACTypes.includes('all') || selectedACTypes.length > 1 ? (
                // Show all AC types in pie chart
                <PieChart>
                  <Pie
                    data={acTypeBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.type}: $${(entry.total / 1000).toFixed(0)}k`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="total"
                  >
                    {acTypeBreakdown.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => {
                      const totalACCalc = acTypeBreakdown.reduce((sum, item) => sum + item.total, 0) || 1;
                      const percent = (value / totalACCalc) * 100;
                      return [`$${value.toLocaleString()} in ${props.payload.type} costs - ${percent.toFixed(1)}% of all AC`, `${props.payload.type}`];
                    }}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              ) : (
                // Show top items for selected AC type in bar chart (single type only)
                <BarChart
                  data={filteredItems.slice(0, 6).map(item => ({
                    ...item,
                    selectedACAmount: item.additionalCosts.find(ac => ac.type === selectedACTypes[0])?.totalAmount || 0
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="itemCode" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${selectedACTypes[0]}: $${value.toLocaleString()} - Item Cost: $${props.payload.totalCost.toLocaleString()}`,
                      `${selectedACTypes[0]} Cost`
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="selectedACAmount" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category/Vendor Breakdown or Top Items */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">
              {selectedACTypes.includes('all')
                ? 'Top Items by Total Additional Cost'
                : `${selectedACTypes.join(', ')} Cost by Category`}
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              {selectedACTypes.includes('all') || selectedACTypes.length > 1 ? (
                // Show top items when all AC types selected
                <BarChart data={filteredItems.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="itemCode" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `Total AC: $${value.toLocaleString()} - Item Cost: $${props.payload.totalCost.toLocaleString()} - Final: $${props.payload.finalCost.toLocaleString()}`,
                      'Total Additional Costs'
                    ]}
                    labelFormatter={(label) => `Item: ${label}`}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                  <Bar dataKey="totalAC" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                // Show category breakdown when specific AC type selected
                <PieChart>
                  <Pie
                    data={(() => {
                      const categoryMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const cat = item.category || 'Uncategorized';
                        const acOfType = item.additionalCosts.find(ac => ac.type === selectedACTypes[0]);
                        if (acOfType) {
                          categoryMap.set(cat, (categoryMap.get(cat) || 0) + acOfType.totalAmount);
                        }
                      });
                      const totalACForType = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0) || 1;
                      return Array.from(categoryMap.entries()).map(([category, cost]) => ({
                        category,
                        cost,
                        percent: (cost / totalACForType) * 100
                      }));
                    })()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => {
                      if (!entry || !entry.category) return '';
                      return `${entry.category.split(' ')[0]}: ${entry.percent?.toFixed(1) || 0}%`;
                    }}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {(() => {
                      const categoryMap = new Map<string, number>();
                      filteredItems.forEach(item => {
                        const cat = item.category || 'Uncategorized';
                        const acOfType = item.additionalCosts.find(ac => ac.type === selectedACTypes[0]);
                        if (acOfType) {
                          categoryMap.set(cat, (categoryMap.get(cat) || 0) + acOfType.totalAmount);
                        }
                      });
                      return Array.from(categoryMap.entries()).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ));
                    })()}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${selectedACTypes[0]}: $${value.toLocaleString()} - ${props.payload.percent?.toFixed(1) || 0}% of ${selectedACTypes[0]} costs`,
                      props.payload.category || 'Unknown'
                    ]}
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table with Detailed Breakdown - Excel-like UI with Separate AC Columns */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">Items with Additional Costs - Detailed Breakdown</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">Item Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">Item Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">Category</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300">Vendor</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300">Item Cost</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-700 border-r border-gray-300">MOQ</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-700 border-r border-gray-300">Testing</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-700 border-r border-gray-300">Coating</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-700 border-r border-gray-300">Freight</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-700 border-r border-gray-300">Total AC</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Final Cost</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredItems.map((item, idx) => {
                  // Extract individual AC amounts
                  const moqCost = item.additionalCosts.find(ac => ac.type === 'MOQ')?.totalAmount || 0;
                  const testingCost = item.additionalCosts.find(ac => ac.type === 'Testing')?.totalAmount || 0;
                  const coatingCost = item.additionalCosts.find(ac => ac.type === 'Coating')?.totalAmount || 0;
                  const freightCost = item.additionalCosts.find(ac => ac.type === 'Freight')?.totalAmount || 0;

                  return (
                    <tr key={item.itemCode} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-200">{item.itemCode}</td>
                      <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-xs truncate" title={item.itemName}>
                        {item.itemName}
                      </td>

                      {/* Category - Clickable */}
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this category">
                        <button
                          onClick={() => navigateToTab('items', { selectedCategory: item.category || 'Uncategorized' })}
                          className="text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.category || 'Uncategorized'}
                        </button>
                      </td>

                      {/* Vendor - Clickable */}
                      <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer" title="Click to view this vendor">
                        <button
                          onClick={() => navigateToTab('items', { selectedVendor: item.vendor })}
                          className="text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.vendor}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-gray-900 border-r border-gray-200">
                        ${item.totalCost.toLocaleString()}
                      </td>

                      {/* Individual AC Columns - Clickable (Toggle) */}
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to toggle MOQ filter">
                        {moqCost > 0 ? (
                          <button
                            onClick={() => setSelectedACTypes(toggleSelection(selectedACTypes, 'MOQ'))}
                            className={`font-mono group-hover:text-orange-800 group-hover:underline font-semibold w-full text-right ${
                              selectedACTypes.includes('MOQ') && !selectedACTypes.includes('all') ? 'text-orange-800 underline' : 'text-orange-600'
                            }`}
                          >
                            ${moqCost.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to toggle Testing filter">
                        {testingCost > 0 ? (
                          <button
                            onClick={() => setSelectedACTypes(toggleSelection(selectedACTypes, 'Testing'))}
                            className={`font-mono group-hover:text-orange-800 group-hover:underline font-semibold w-full text-right ${
                              selectedACTypes.includes('Testing') && !selectedACTypes.includes('all') ? 'text-orange-800 underline' : 'text-orange-600'
                            }`}
                          >
                            ${testingCost.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to toggle Coating filter">
                        {coatingCost > 0 ? (
                          <button
                            onClick={() => setSelectedACTypes(toggleSelection(selectedACTypes, 'Coating'))}
                            className={`font-mono group-hover:text-orange-800 group-hover:underline font-semibold w-full text-right ${
                              selectedACTypes.includes('Coating') && !selectedACTypes.includes('all') ? 'text-orange-800 underline' : 'text-orange-600'
                            }`}
                          >
                            ${coatingCost.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer" title="Click to toggle Freight filter">
                        {freightCost > 0 ? (
                          <button
                            onClick={() => setSelectedACTypes(toggleSelection(selectedACTypes, 'Freight'))}
                            className={`font-mono group-hover:text-orange-800 group-hover:underline font-semibold w-full text-right ${
                              selectedACTypes.includes('Freight') && !selectedACTypes.includes('all') ? 'text-orange-800 underline' : 'text-orange-600'
                            }`}
                          >
                            ${freightCost.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right font-mono font-bold text-orange-700 border-r border-gray-200">
                        ${item.totalAC.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">
                        ${item.finalCost.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            <span className="font-medium">Note:</span> Click on any AC amount to toggle that cost type filter (supports multiple). Click Category or Vendor to navigate to respective views.
            {!selectedACTypes.includes('all') && (
              <button onClick={() => setSelectedACTypes(['all'])} className="text-blue-700 hover:underline font-medium ml-2">
                ← Show All AC Types
              </button>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
