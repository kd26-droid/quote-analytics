import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { BOMCostComparison, TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { BOMViewType } from '../BOMTab';

interface BOMComparisonViewProps {
  bomCostComparison: BOMCostComparison[];
  totalQuoteValue: number;
  data: TopItemsAnalytics;
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  setSelectedView: (view: BOMViewType) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface BOMNode {
  path: string;
  code: string;
  name: string;
  level: number;
  items: typeof data.overall[0][];
  children: BOMNode[];
  totalCost: number;
  itemsSubtotal: number;
  bomAC: number;
  parentBomCode: string;
  bomQuantity: number; // Quantity of this BOM assembly (same for all sub-BOMs)
}

export default function BOMComparisonView({
  bomCostComparison,
  totalQuoteValue,
  data,
  navigationContext,
  navigateToTab,
  setSelectedView
}: BOMComparisonViewProps) {
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [sortBy, setSortBy] = useState<'total' | 'ac-burden' | 'item-count' | 'percent'>('total');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Auto-select BOM from navigation context
  useEffect(() => {
    if (navigationContext?.selectedBOM) {
      const bomCode = navigationContext.selectedBOM.split('.')[0]; // Get main BOM code
      setSelectedBOMs([bomCode]);
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

  // HARDCODED BOM structure with both D entries
  const bomTree = useMemo(() => {
    // Instead of building from items, hardcode the structure based on bomCostComparison
    const tree: BOMNode[] = bomCostComparison.map(bom => {
      // Create unique key for each BOM entry
      const bomKey = bom.bomQuantity ? `${bom.bomCode}-${bom.bomQuantity}` : bom.bomCode;

      // Find items belonging to this BOM (matching code AND quantity if applicable)
      const bomItems = data.overall.filter(item => {
        const itemBomCode = item.bomPath.split('.')[0];
        if (itemBomCode !== bom.bomCode) return false;
        // If this BOM has a specific quantity, match items with that quantity
        if (bom.bomQuantity) {
          return item.quantity === bom.bomQuantity;
        }
        return true;
      });

      // Build sub-BOM structure
      const subBOMs = new Map<string, BOMNode>();

      bomItems.forEach(item => {
        const parts = item.bomPath.split('.');
        if (parts.length > 1) {
          // This item belongs to a sub-BOM
          const subBomPath = parts.slice(0, 2).join('.');
          if (!subBOMs.has(subBomPath)) {
            subBOMs.set(subBomPath, {
              path: `${bomKey}/${subBomPath}`,
              code: parts[1],
              name: `Sub-BOM ${subBomPath}`,
              level: 1,
              items: [],
              children: [],
              totalCost: 0,
              itemsSubtotal: 0,
              bomAC: 0,
              parentBomCode: bom.bomCode,
              bomQuantity: bom.bomQuantity || 1
            });
          }
        }
      });

      // Assign items to nodes
      const children = Array.from(subBOMs.values());
      bomItems.forEach(item => {
        const parts = item.bomPath.split('.');
        if (parts.length === 1) {
          // Direct item of root BOM - we don't track these
        } else {
          const subBomPath = parts.slice(0, 2).join('.');
          const subNode = subBOMs.get(subBomPath);
          if (subNode) {
            subNode.items.push(item);
            subNode.itemsSubtotal += item.totalCost;
          }
        }
      });

      // Calculate costs for children
      children.forEach(child => {
        child.bomAC = Math.floor(child.itemsSubtotal * 0.03); // Mock 3% AC
        child.totalCost = child.itemsSubtotal + child.bomAC;
      });

      return {
        path: bomKey,
        code: bom.bomCode,
        name: bom.bomName,
        level: 0,
        items: bomItems.filter(item => item.bomPath.split('.').length === 1),
        children,
        totalCost: bom.bomTotalWithAC,
        itemsSubtotal: bom.itemsSubtotal,
        bomAC: bom.bomAdditionalCosts,
        parentBomCode: bom.bomCode,
        bomQuantity: bom.bomQuantity || 1
      };
    });

    return tree;
  }, [data.overall, bomCostComparison]);

  // Get all available BOMs (including hierarchy)
  const availableBOMs = useMemo(() => {
    const allPaths = new Set<string>();

    const collectPaths = (node: BOMNode) => {
      allPaths.add(node.path);
      node.children.forEach(collectPaths);
    };

    bomTree.forEach(collectPaths);
    return Array.from(allPaths).sort();
  }, [bomTree]);

  // Get all categories and vendors from items
  const { availableCategories, availableVendors } = useMemo(() => {
    const categories = new Set<string>();
    const vendors = new Set<string>();

    data.overall.forEach(item => {
      if (item.category) categories.add(item.category);
      if (item.vendor) vendors.add(item.vendor);
    });

    return {
      availableCategories: Array.from(categories).sort(),
      availableVendors: Array.from(vendors).sort()
    };
  }, [data.overall]);

  // Calculate item count per BOM path (aggregated - direct + all children)
  const bomItemCounts = useMemo(() => {
    const counts = new Map<string, number>();

    const countItems = (node: BOMNode): number => {
      // Count direct items
      const directCount = node.items.length;
      // Count all children's items recursively
      const childrenCount = node.children.reduce((sum, child) => sum + countItems(child), 0);
      const totalCount = directCount + childrenCount;
      counts.set(node.path, totalCount);
      return totalCount;
    };

    bomTree.forEach(countItems);
    return counts;
  }, [bomTree]);

  // Filter and sort BOMs
  const filteredBOMs = useMemo(() => {
    let boms = [...bomCostComparison];

    // Apply BOM filter
    if (!selectedBOMs.includes('all')) {
      boms = boms.filter(bom => {
        const bomKey = bom.bomQuantity ? `${bom.bomCode}-${bom.bomQuantity}` : bom.bomCode;
        return selectedBOMs.includes(bomKey) || selectedBOMs.includes(bom.bomCode);
      });
    }

    // Apply category filter - filter BOMs by checking if they contain items from selected categories
    if (!selectedCategories.includes('all')) {
      boms = boms.filter(bom => {
        const bomItems = data.overall.filter(item => {
          const itemBomCode = item.bomPath.split('.')[0];
          return itemBomCode === bom.bomCode;
        });
        return bomItems.some(item => selectedCategories.includes(item.category));
      });
    }

    // Apply vendor filter - filter BOMs by checking if they contain items from selected vendors
    if (!selectedVendors.includes('all')) {
      boms = boms.filter(bom => {
        const bomItems = data.overall.filter(item => {
          const itemBomCode = item.bomPath.split('.')[0];
          return itemBomCode === bom.bomCode;
        });
        return bomItems.some(item => selectedVendors.includes(item.vendor));
      });
    }

    // Sort
    switch (sortBy) {
      case 'total':
        boms.sort((a, b) => b.bomTotalWithAC - a.bomTotalWithAC);
        break;
      case 'ac-burden':
        boms.sort((a, b) => {
          const burdenA = (a.bomAdditionalCosts / a.itemsSubtotal) * 100;
          const burdenB = (b.bomAdditionalCosts / b.itemsSubtotal) * 100;
          return burdenB - burdenA;
        });
        break;
      case 'item-count':
        boms.sort((a, b) => {
          const countA = bomItemCounts.get(a.bomCode) || 0;
          const countB = bomItemCounts.get(b.bomCode) || 0;
          return countB - countA;
        });
        break;
      case 'percent':
        boms.sort((a, b) => b.percentOfQuote - a.percentOfQuote);
        break;
    }

    return boms;
  }, [bomCostComparison, selectedBOMs, selectedCategories, selectedVendors, sortBy, bomItemCounts, data.overall]);

  // Calculate insights
  const insights = useMemo(() => {
    const totalBOMCost = filteredBOMs.reduce((sum, bom) => sum + bom.bomTotalWithAC, 0);
    const totalItemsCost = filteredBOMs.reduce((sum, bom) => sum + bom.itemsSubtotal, 0);
    const totalBOMAC = filteredBOMs.reduce((sum, bom) => sum + bom.bomAdditionalCosts, 0);
    const avgACBurden = filteredBOMs.length > 0
      ? filteredBOMs.reduce((sum, bom) => sum + (bom.bomAdditionalCosts / bom.itemsSubtotal) * 100, 0) / filteredBOMs.length
      : 0;
    const highestACBurden = filteredBOMs.reduce((max, bom) => {
      const burden = (bom.bomAdditionalCosts / bom.itemsSubtotal) * 100;
      return burden > (max?.burden || 0) ? { bomCode: bom.bomCode, bomName: bom.bomName, burden } : max;
    }, null as { bomCode: string; bomName: string; burden: number } | null);

    // Get BOM quantity (just show first BOM's qty since we can't sum different BOM types)
    // If multiple BOMs selected, we don't show a total quantity (doesn't make sense)
    const displayQuantity = bomTree.length > 0 && bomTree[0].bomQuantity > 0
      ? (selectedBOMs.includes('all') || selectedBOMs.length > 1 ? '-' : bomTree.find(node => selectedBOMs.includes(node.code))?.bomQuantity?.toLocaleString() || '-')
      : '-';

    return {
      totalBOMCost,
      totalItemsCost,
      totalBOMAC,
      avgACBurden,
      highestACBurden,
      bomCount: filteredBOMs.length,
      displayQuantity
    };
  }, [filteredBOMs, bomTree, selectedBOMs]);

  // Chart data for stacked bar
  const chartData = useMemo(() => {
    return filteredBOMs.map(bom => {
      const displayName = bom.bomQuantity ? `BOM ${bom.bomCode} (${bom.bomQuantity})` : `BOM ${bom.bomCode}`;
      return {
        name: displayName,
        bomCode: bom.bomCode,
        bomQuantity: bom.bomQuantity,
        itemsCost: bom.itemsSubtotal,
        bomAC: bom.bomAdditionalCosts,
        total: bom.bomTotalWithAC,
        itemCount: bomItemCounts.get(bom.bomCode) || 0,
        acBurden: ((bom.bomAdditionalCosts / bom.itemsSubtotal) * 100).toFixed(1)
      };
    });
  }, [filteredBOMs, bomItemCounts]);

  return (
    <div className="space-y-4">
      {/* Compact Filters Bar */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                BOMs: {selectedBOMs.includes('all') ? 'All' : `${selectedBOMs.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                Categories: {selectedCategories.includes('all') ? 'All' : `${selectedCategories.length} selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                Vendors: {selectedVendors.includes('all') ? 'All' : `${selectedVendors.length} selected`}
              </span>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="total">Total Cost</option>
                <option value="ac-burden">AC Impact %</option>
                <option value="item-count">Item Count</option>
                <option value="percent">% of Quote</option>
              </select>
            </div>

            {/* Expand/Collapse Advanced Filters */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              {filtersExpanded ? '▲ Less' : '▼ More Filters'}
            </button>

            {(!selectedBOMs.includes('all') || !selectedCategories.includes('all') || !selectedVendors.includes('all')) && (
              <button
                onClick={() => {
                  setSelectedBOMs(['all']);
                  setSelectedCategories(['all']);
                  setSelectedVendors(['all']);
                  setSortBy('total');
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
              <div className="grid grid-cols-3 gap-4">
                {/* BOM Filter */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Filter by BOMs:</div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes('all')}
                        onChange={() => setSelectedBOMs(['all'])}
                        className="rounded"
                      />
                      <span className="font-medium">All</span>
                    </label>
                    {availableBOMs.map(bom => (
                      <label key={bom} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedBOMs.includes(bom)}
                          onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bom))}
                          className="rounded"
                        />
                        <span className="text-gray-700">{bom}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Filter by Category:</div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes('all')}
                        onChange={() => setSelectedCategories(['all'])}
                        className="rounded"
                      />
                      <span className="font-medium">All</span>
                    </label>
                    {availableCategories.map(cat => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => setSelectedCategories(toggleSelection(selectedCategories, cat))}
                          className="rounded"
                        />
                        <span className="text-gray-700">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Vendor Filter */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 mb-2">Filter by Vendor:</div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes('all')}
                        onChange={() => setSelectedVendors(['all'])}
                        className="rounded"
                      />
                      <span className="font-medium">All</span>
                    </label>
                    {availableVendors.map(vendor => (
                      <label key={vendor} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor)}
                          onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor))}
                          className="rounded"
                        />
                        <span className="text-gray-700">{vendor}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visual Charts - Same style as Items Tab */}
      <div className="grid grid-cols-2 gap-4">
        {/* BOM Items Cost Bar Chart (Without AC) */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Base BOM Cost</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Base Cost']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return `${label} - ${data.itemCount} items`;
                    }
                    return label;
                  }}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
                <Bar dataKey="itemsCost" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* BOM Total Cost Distribution Pie Chart (With AC) */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">BOM Total Cost</h4>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => {
                    const percent = (value / insights.totalBOMCost) * 100;
                    const itemsCost = props.payload.itemsCost;
                    const bomAC = props.payload.bomAC;
                    return [
                      `Total: $${value.toLocaleString()} (Items: $${itemsCost.toLocaleString()} + AC: $${bomAC.toLocaleString()}) - ${percent.toFixed(1)}% of total`,
                      'BOM Total with AC'
                    ];
                  }}
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-3 justify-center">
              {chartData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs text-gray-700 font-medium">
                    {entry.name}: ${(entry.total / 1000).toFixed(0)}k
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Comparison Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">BOM Comparison Table</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Name</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Items</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Items Subtotal</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM AC</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">AC Impact %</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% of Quote</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {(() => {
                  const renderBOMNode = (node: BOMNode, colorIdx: number, parentExpanded: boolean = true): JSX.Element[] => {
                    if (!parentExpanded) return [];

                    const isExpanded = expandedBOMs.has(node.path);
                    const hasChildren = node.children.length > 0;
                    // Calculate AC Impact - use aggregated values (total items + total AC)
                    // This gives the overall impact including all children
                    const acImpact = node.itemsSubtotal > 0 ? (node.bomAC / node.itemsSubtotal) * 100 : 0;
                    const itemCount = bomItemCounts.get(node.path) || 0;
                    const indent = node.level * 24;

                    const rows: JSX.Element[] = [
                      <tr
                        key={node.path}
                        className={`border-b border-gray-200 hover:bg-gray-50 ${
                          node.level > 0 ? 'bg-gray-50' : ''
                        }`}
                      >
                        <td className="px-3 py-2 border-r border-gray-200" style={{ paddingLeft: `${indent + 12}px` }}>
                          <div className="flex items-center gap-2">
                            {hasChildren && (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedBOMs);
                                  if (isExpanded) {
                                    newExpanded.delete(node.path);
                                  } else {
                                    newExpanded.add(node.path);
                                  }
                                  setExpandedBOMs(newExpanded);
                                }}
                                className="text-gray-500 hover:text-gray-700 text-xs"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                            <span className="font-mono text-xs text-gray-900 font-medium">
                              {node.level === 0 ? node.code : node.code}
                              {node.level === 0 && node.bomQuantity > 1 && (
                                <span className="text-gray-600 ml-1">({node.bomQuantity.toLocaleString()})</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs max-w-xs truncate" title={node.name}>
                          <div className={node.level > 0 ? 'font-normal text-gray-600' : 'font-medium'}>
                            {node.name}
                            {hasChildren && <span className="text-gray-500 ml-1">({node.children.length} sub)</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                          {itemCount > 0 ? (
                            <button
                              onClick={() => navigateToTab('items', { selectedBOM: node.path })}
                              className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                              title={`View ${itemCount} items in ${node.name}`}
                            >
                              {itemCount}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-xs">
                          {node.bomQuantity.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900 border-r border-gray-200 text-xs">
                          ${node.itemsSubtotal.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900 border-r border-gray-200 text-xs">
                          {node.bomAC > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedView('additional-costs');
                                navigateToTab('bom', { selectedBOM: node.parentBomCode });
                              }}
                              className="hover:underline font-semibold text-gray-900"
                            >
                              ${node.bomAC.toLocaleString()}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-gray-200 text-xs">
                          {acImpact > 0 ? (
                            <span className={`font-semibold ${
                              acImpact > 10 ? 'text-red-600' : acImpact > 5 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {acImpact.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">
                          ${node.totalCost.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 text-xs font-semibold">
                          {((node.totalCost / totalQuoteValue) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ];

                    // Add children rows if expanded
                    if (isExpanded && hasChildren) {
                      node.children
                        .sort((a, b) => b.totalCost - a.totalCost)
                        .forEach(child => {
                          rows.push(...renderBOMNode(child, colorIdx, true));
                        });
                    }

                    return rows;
                  };

                  // Render all top-level BOMs
                  const allRows: JSX.Element[] = [];
                  bomTree.forEach((node, idx) => {
                    // Check if this BOM should be shown based on filter
                    if (selectedBOMs.includes('all') || selectedBOMs.includes(node.code)) {
                      allRows.push(...renderBOMNode(node, idx));
                    }
                  });

                  return allRows;
                })()}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-400">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-bold text-gray-900 text-xs">TOTAL</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-700 border-r border-gray-300 text-xs">
                    {insights.displayQuantity}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-xs">
                    ${insights.totalItemsCost.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-xs">
                    ${insights.totalBOMAC.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900 border-r border-gray-300 text-xs">
                    {insights.avgACBurden.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-xs">
                    ${insights.totalBOMCost.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900 text-xs">
                    {((insights.totalBOMCost / totalQuoteValue) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-xs text-gray-600">
            <span className="font-medium">Tip:</span> Click ▶ to expand BOMs and see sub-BOMs with their costs. Click items count to filter Items tab, BOM AC to view breakdown. Sub-BOMs show hierarchical cost distribution - find expensive sub-assemblies easily!
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
