import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { CostViewData, CostViewItem } from '../../../../services/api';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';

interface BOMVolumeAnalysisViewProps {
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

// Available views for BOM volume analysis
type BOMVolumeViewType =
  | 'per_unit_total'
  | 'per_unit_items'
  | 'per_unit_ac'
  | 'total_cost';

const VIEW_OPTIONS: { value: BOMVolumeViewType; label: string; description: string }[] = [
  { value: 'per_unit_total', label: 'Per-Unit Total', description: 'Total cost per unit (Items + AC)' },
  { value: 'per_unit_items', label: 'Per-Unit Items', description: 'Items subtotal per unit' },
  { value: 'per_unit_ac', label: 'Per-Unit AC', description: 'Additional costs per unit' },
  { value: 'total_cost', label: 'Total Cost', description: 'Total BOM cost (qty × per-unit)' },
];

export default function BOMVolumeAnalysisView({
  costViewData,
  currencySymbol,
  totalQuoteValue,
  navigateToTab,
  navigationContext,
  filterResetKey,
  onClearAllFilters
}: BOMVolumeAnalysisViewProps) {
  // View selection
  const [selectedView, setSelectedView] = useState<BOMVolumeViewType>('per_unit_total');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [tableSearch, setTableSearch] = useState('');

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('change_percent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<'bom' | 'view' | null>(null);
  const [bomSearch, setBomSearch] = useState('');

  // Get items from API
  const items = costViewData?.items || [];

  // Use shared BOM instances hook
  const { bomInstances, hasVolumeScenarios } = useBOMInstances(items);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Reset filters when filterResetKey changes
  React.useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMs(['all']);
      setTableSearch('');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Build BOM list for filter
  const bomList = useMemo(() => {
    const boms = new Set<string>();
    items.forEach(item => {
      if (item.bom_code) {
        boms.add(item.bom_code);
      }
    });
    return Array.from(boms).sort();
  }, [items]);

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

  // Aggregate BOM-level data from items
  // Group by bom_code to find BOMs that appear in multiple instances with different quantities
  const bomVolumeData = useMemo(() => {
    if (!hasVolumeScenarios) return [];

    // First, aggregate items by BOM instance
    const instanceTotals = new Map<string, {
      bom_instance_id: string;
      bom_code: string;
      bom_name: string;
      bom_instance_qty: number;
      items_subtotal: number;
      total_ac: number;
      total_cost: number;
      item_count: number;
    }>();

    items.forEach(item => {
      if (!item.bom_instance_id) return;

      const existing = instanceTotals.get(item.bom_instance_id);
      if (existing) {
        existing.items_subtotal += item.base_rate * item.quantity;
        existing.total_ac += item.additional_cost_per_unit * item.quantity;
        existing.total_cost += item.total_amount;
        existing.item_count += 1;
      } else {
        // Get root BOM code from path
        const rootBomCode = item.bom_path ? item.bom_path.split(' > ')[0] : item.bom_code;

        instanceTotals.set(item.bom_instance_id, {
          bom_instance_id: item.bom_instance_id,
          bom_code: rootBomCode,
          bom_name: item.bom_name,
          bom_instance_qty: item.bom_instance_qty,
          items_subtotal: item.base_rate * item.quantity,
          total_ac: item.additional_cost_per_unit * item.quantity,
          total_cost: item.total_amount,
          item_count: 1
        });
      }
    });

    // Now group instances by BOM code to find volume scenarios
    const bomGroups = new Map<string, typeof instanceTotals extends Map<string, infer V> ? V[] : never>();

    instanceTotals.forEach(instance => {
      if (!bomGroups.has(instance.bom_code)) {
        bomGroups.set(instance.bom_code, []);
      }
      bomGroups.get(instance.bom_code)!.push(instance);
    });

    // Filter to only BOMs with multiple instances (volume scenarios)
    const volumeBOMs: {
      bom_code: string;
      bom_name: string;
      instances: {
        bom_instance_id: string;
        bom_instance_qty: number;
        items_subtotal: number;
        total_ac: number;
        total_cost: number;
        per_unit_items: number;
        per_unit_ac: number;
        per_unit_total: number;
        item_count: number;
      }[];
    }[] = [];

    bomGroups.forEach((instances, bomCode) => {
      // Check for multiple different quantities
      const uniqueQtys = new Set(instances.map(i => i.bom_instance_qty));

      if (uniqueQtys.size > 1) {
        // Sort by quantity
        const sortedInstances = [...instances].sort((a, b) => a.bom_instance_qty - b.bom_instance_qty);

        volumeBOMs.push({
          bom_code: bomCode,
          bom_name: sortedInstances[0].bom_name,
          instances: sortedInstances.map(inst => ({
            bom_instance_id: inst.bom_instance_id,
            bom_instance_qty: inst.bom_instance_qty,
            items_subtotal: inst.items_subtotal,
            total_ac: inst.total_ac,
            total_cost: inst.total_cost,
            per_unit_items: inst.items_subtotal / inst.bom_instance_qty,
            per_unit_ac: inst.total_ac / inst.bom_instance_qty,
            per_unit_total: inst.total_cost / inst.bom_instance_qty,
            item_count: inst.item_count
          }))
        });
      }
    });

    return volumeBOMs;
  }, [items, hasVolumeScenarios]);

  // Get unique BOM instances for column headers (sorted by quantity)
  const uniqueBOMInstances = useMemo(() => {
    const instances = new Map<string, { id: string; qty: number; code: string; label: string }>();

    bomVolumeData.forEach(bom => {
      bom.instances.forEach(inst => {
        if (!instances.has(inst.bom_instance_id)) {
          instances.set(inst.bom_instance_id, {
            id: inst.bom_instance_id,
            qty: inst.bom_instance_qty,
            code: bom.bom_code,
            label: `${inst.bom_instance_qty} units`
          });
        }
      });
    });

    return Array.from(instances.values()).sort((a, b) => a.qty - b.qty);
  }, [bomVolumeData]);

  // Apply filters
  const filteredData = useMemo(() => {
    let result = [...bomVolumeData];

    // BOM filter
    if (!selectedBOMs.includes('all')) {
      result = result.filter(bom => selectedBOMs.includes(bom.bom_code));
    }

    // Search filter
    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      result = result.filter(bom =>
        bom.bom_code.toLowerCase().includes(search) ||
        bom.bom_name.toLowerCase().includes(search)
      );
    }

    return result;
  }, [bomVolumeData, selectedBOMs, tableSearch]);

  // Get value for current view
  const getValue = (instance: typeof bomVolumeData[0]['instances'][0]) => {
    switch (selectedView) {
      case 'per_unit_total': return instance.per_unit_total;
      case 'per_unit_items': return instance.per_unit_items;
      case 'per_unit_ac': return instance.per_unit_ac;
      case 'total_cost': return instance.total_cost;
      default: return instance.per_unit_total;
    }
  };

  // Calculate change for sorting
  const getChange = (bom: typeof bomVolumeData[0]) => {
    if (bom.instances.length < 2) return 0;
    const first = getValue(bom.instances[0]);
    const last = getValue(bom.instances[bom.instances.length - 1]);
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  };

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortColumn === 'change_percent') {
        aVal = getChange(a);
        bVal = getChange(b);
      } else if (sortColumn === 'bom_code') {
        aVal = a.bom_code;
        bVal = b.bom_code;
      } else if (sortColumn === 'bom_name') {
        aVal = a.bom_name;
        bVal = b.bom_name;
      } else {
        // Instance column - sort by value in that instance
        const instA = a.instances.find(i => i.bom_instance_id === sortColumn);
        const instB = b.instances.find(i => i.bom_instance_id === sortColumn);
        aVal = instA ? getValue(instA) : 0;
        bVal = instB ? getValue(instB) : 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const cmp = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [filteredData, sortColumn, sortDirection, selectedView]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      const textColumns = ['bom_code', 'bom_name'];
      setSortDirection(textColumns.includes(column) ? 'asc' : 'desc');
    }
  };

  // Sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc'
      ? <span className="text-blue-600 ml-1 text-[10px] font-bold">ASC</span>
      : <span className="text-blue-600 ml-1 text-[10px] font-bold">DESC</span>;
  };

  // Check for active filters
  const hasActiveFilters = !selectedBOMs.includes('all') || tableSearch.trim() !== '';

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedBOMs(['all']);
    setTableSearch('');
    if (onClearAllFilters) onClearAllFilters();
  };

  // Summary stats
  const stats = useMemo(() => {
    const cheaperAtScale = filteredData.filter(bom => getChange(bom) < -0.01).length;
    const moreExpensive = filteredData.filter(bom => getChange(bom) > 0.01).length;
    const unchanged = filteredData.length - cheaperAtScale - moreExpensive;

    return { total: filteredData.length, cheaperAtScale, moreExpensive, unchanged };
  }, [filteredData, selectedView]);

  // No volume scenarios
  if (!hasVolumeScenarios || bomVolumeData.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-8 text-center">
          <div className="text-gray-500 text-sm">
            <p className="text-lg mb-2 font-semibold">No Volume Scenarios Detected</p>
            <p>Volume analysis appears when the same BOM is added multiple times with different quantities.</p>
            <p className="mt-2 text-xs">Example: BOM D (10 units) and BOM D (1000 units) in the same quote.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-blue-300 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-blue-900 text-sm">BOM VOLUME ANALYSIS</h3>
              <p className="text-blue-700 text-xs mt-1">
                Compare BOM costs across different quantities
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-700">BOMs with Volume Scenarios</div>
              <div className="text-2xl font-bold text-blue-900">{bomVolumeData.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-gray-700 mb-1">Total BOMs</div>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">with volume scenarios</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-green-700 mb-1">Cheaper at Scale</div>
            <div className="text-2xl font-bold text-green-600">{stats.cheaperAtScale}</div>
            <div className="text-xs text-green-600 mt-1">
              {stats.total > 0 ? `${((stats.cheaperAtScale / stats.total) * 100).toFixed(0)}%` : '0%'} of BOMs
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-red-700 mb-1">More Expensive</div>
            <div className="text-2xl font-bold text-red-600">{stats.moreExpensive}</div>
            <div className="text-xs text-red-600 mt-1">
              {stats.total > 0 ? `${((stats.moreExpensive / stats.total) * 100).toFixed(0)}%` : '0%'} of BOMs
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-gray-700 mb-1">BOM Instances</div>
            <div className="text-2xl font-bold text-cyan-600">{uniqueBOMInstances.length}</div>
            <div className="text-xs text-gray-500 mt-1">volume configurations</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-gray-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* View Selector */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'view' ? null : 'view'); }}
                className="flex items-center gap-2 px-3 py-2 border border-blue-500 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
              >
                <span>View: {VIEW_OPTIONS.find(v => v.value === selectedView)?.label}</span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'view' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-72">
                  <div className="py-1">
                    {VIEW_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => { setSelectedView(option.value); setOpenDropdown(null); }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 ${
                          selectedView === option.value ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search BOMs..."
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* BOM Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'bom' ? null : 'bom'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${
                  !selectedBOMs.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>BOM</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedBOMs.includes('all') ? 'All' : selectedBOMs.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'bom' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-64">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search BOMs..."
                      value={bomSearch}
                      onChange={(e) => setBomSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="px-2 py-2 border-b border-gray-100">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBOMs.includes('all')}
                        onChange={() => setSelectedBOMs(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All BOMs</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {bomList
                      .filter(bom => !bomSearch || bom.toLowerCase().includes(bomSearch.toLowerCase()))
                      .map(bom => (
                        <label key={bom} className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBOMs.includes(bom)}
                            onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bom))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700 font-mono">{bom}</span>
                        </label>
                      ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedBOMs(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="px-3 py-2 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Active Filter Pills */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-gray-500">Active filters:</span>

              {!selectedBOMs.includes('all') && selectedBOMs.map(bom => (
                <span key={bom} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  BOM: {bom}
                  <button onClick={() => {
                    const newBOMs = selectedBOMs.filter(b => b !== bom);
                    setSelectedBOMs(newBOMs.length ? newBOMs : ['all']);
                  }} className="hover:text-blue-900 font-bold">×</button>
                </span>
              ))}

              {tableSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  Search: "{tableSearch}"
                  <button onClick={() => setTableSearch('')} className="hover:text-gray-900 font-bold">×</button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">
                {VIEW_OPTIONS.find(v => v.value === selectedView)?.label} Comparison
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                {VIEW_OPTIONS.find(v => v.value === selectedView)?.description}
              </p>
            </div>
            <div className="text-xs text-gray-600">
              Showing {paginatedData.length} of {filteredData.length} BOMs
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-10"
                    onClick={() => handleSort('bom_code')}
                    style={{ minWidth: '120px' }}
                  >
                    BOM Code {renderSortIndicator('bom_code')}
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('bom_name')}
                    style={{ minWidth: '180px' }}
                  >
                    BOM Name {renderSortIndicator('bom_name')}
                  </th>
                  {uniqueBOMInstances.map(inst => (
                    <th
                      key={inst.id}
                      className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                      onClick={() => handleSort(inst.id)}
                      style={{ minWidth: '130px' }}
                    >
                      {inst.label} {renderSortIndicator(inst.id)}
                    </th>
                  ))}
                  <th
                    className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('change_percent')}
                    style={{ minWidth: '100px' }}
                  >
                    Change % {renderSortIndicator('change_percent')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((bom, idx) => {
                  const change = getChange(bom);
                  const firstValue = bom.instances.length > 0 ? getValue(bom.instances[0]) : 0;

                  return (
                    <tr key={bom.bom_code} className={`border-b border-gray-200 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 font-mono text-blue-600 font-semibold sticky left-0 bg-inherit z-10">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: bom.bom_code })}
                          className="hover:underline"
                        >
                          {bom.bom_code}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        <div className="truncate max-w-[200px]" title={bom.bom_name}>
                          {bom.bom_name}
                        </div>
                      </td>
                      {uniqueBOMInstances.map(inst => {
                        const instance = bom.instances.find(i => i.bom_instance_id === inst.id);
                        const value = instance ? getValue(instance) : null;
                        const isDifferent = value !== null && firstValue !== 0 && Math.abs(value - firstValue) / firstValue > 0.001;
                        const isCheaper = value !== null && value < firstValue;

                        return (
                          <td
                            key={inst.id}
                            className={`px-4 py-3 text-right font-mono ${
                              isDifferent
                                ? isCheaper
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                                : 'text-gray-900'
                            }`}
                          >
                            {value !== null
                              ? `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '-'
                            }
                          </td>
                        );
                      })}
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${
                        change < -0.01 ? 'text-green-600' : change > 0.01 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {change < -0.01 ? '' : change > 0.01 ? '+' : ''}{change.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
