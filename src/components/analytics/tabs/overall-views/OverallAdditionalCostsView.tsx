import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { OverallACData, OverallACCost } from '../../../../services/api';

interface OverallAdditionalCostsViewProps {
  overallACData?: OverallACData | null;
  currencySymbol?: string;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

export default function OverallAdditionalCostsView({
  overallACData,
  currencySymbol = '₹',
  filterResetKey,
  onClearAllFilters
}: OverallAdditionalCostsViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedCostTypes, setSelectedCostTypes] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [showDisplayOnly, setShowDisplayOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('cost_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openDropdown, setOpenDropdown] = useState<'costType' | 'columns' | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'cost_name', 'cost_type', 'rate', 'amount', 'running_total'
  ]));

  // Column definitions
  const columnDefs = [
    { key: 'cost_name', label: 'Cost Name' },
    { key: 'cost_type', label: 'Type' },
    { key: 'rate', label: 'Rate' },
    { key: 'amount', label: 'Amount' },
    { key: 'running_total', label: 'Running Total' }
  ];

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        if (newSet.size > 1) newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Column resizing
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({});
  const resizingColumnRef = useRef<string | null>(null);
  const resizingStartXRef = useRef<number>(0);
  const resizingStartWidthRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColumnRef.current) return;
      const diff = e.clientX - resizingStartXRef.current;
      const newWidth = Math.max(50, resizingStartWidthRef.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColumnRef.current!]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingColumnRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent, column: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColumnRef.current = column;
    resizingStartXRef.current = e.clientX;
    resizingStartWidthRef.current = currentWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Reset filters from parent
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedCostTypes(['all']);
      setSearchQuery('');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCostTypes, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.filter-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Toggle multi-select
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

  // Check if we have real API data
  const hasRealData = overallACData && overallACData.overall_additional_costs;

  // Get costs based on toggle
  const allCosts = useMemo(() => {
    if (!hasRealData) return [];
    const section = showDisplayOnly
      ? overallACData!.overall_additional_costs.display_only
      : overallACData!.overall_additional_costs.included_in_total;
    return section.costs || [];
  }, [overallACData, hasRealData, showDisplayOnly]);

  // Get all cost types present
  const availableCostTypes = useMemo(() => {
    const types = new Set(allCosts.map(c => c.cost_type));
    return Array.from(types).sort();
  }, [allCosts]);

  // Filter costs
  const filteredCosts = useMemo(() => {
    let costs = [...allCosts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      costs = costs.filter(c => c.cost_name.toLowerCase().includes(q));
    }

    if (!selectedCostTypes.includes('all')) {
      costs = costs.filter(c => selectedCostTypes.includes(c.cost_type));
    }

    return costs;
  }, [allCosts, searchQuery, selectedCostTypes]);

  // Sort
  const sortedCosts = useMemo(() => {
    const result = [...filteredCosts];
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'cost_name': return sortDirection === 'asc' ? a.cost_name.localeCompare(b.cost_name) : b.cost_name.localeCompare(a.cost_name);
        case 'cost_type': return sortDirection === 'asc' ? a.cost_type.localeCompare(b.cost_type) : b.cost_type.localeCompare(a.cost_type);
        case 'cost_value': aVal = a.cost_value; bVal = b.cost_value; break;
        case 'calculated': aVal = a.calculated_amount; bVal = b.calculated_amount; break;
        case 'quoted': aVal = a.quoted_amount; bVal = b.quoted_amount; break;
        case 'diff': aVal = a.quoted_amount - a.calculated_amount; bVal = b.quoted_amount - b.calculated_amount; break;
        default: return 0;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [filteredCosts, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedCosts.length / pageSize);
  const paginatedCosts = sortedCosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Totals
  const totals = useMemo(() => {
    const totalCalc = filteredCosts.reduce((s, c) => s + c.calculated_amount, 0);
    const totalQuoted = filteredCosts.reduce((s, c) => s + c.quoted_amount, 0);
    return { totalCalc, totalQuoted, diff: totalQuoted - totalCalc };
  }, [filteredCosts]);

  const includedSection = overallACData?.overall_additional_costs.included_in_total;
  const displayOnlySection = overallACData?.overall_additional_costs.display_only;
  const grandTotal = overallACData?.grand_total;

  const hasActiveFilters = !selectedCostTypes.includes('all') || searchQuery.trim() !== '';

  const handleClearAllFilters = () => {
    setSelectedCostTypes(['all']);
    setSearchQuery('');
    setCurrentPage(1);
    onClearAllFilters?.();
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  if (!hasRealData) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-800 mb-2">Overall AC API Required</h3>
          <p className="text-red-600">Overall Additional Costs view requires the Overall AC API data.</p>
          <p className="text-sm text-red-500 mt-2">Endpoint: /quotes/[id]/analytics/overall-ac/</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Alert */}
      {hasActiveFilters && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-800">Filters Active</p>
              <p className="text-sm text-orange-600">Showing {filteredCosts.length} of {allCosts.length} costs</p>
            </div>
          </div>
          <button onClick={handleClearAllFilters} className="px-6 py-2.5 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">
            Reset All Filters
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {overallACData?.base_amounts && (
          <>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm font-bold text-gray-700 mb-2">Total Item Cost</div>
                <div className="text-2xl font-bold text-blue-600">
                  {currencySymbol}{overallACData.base_amounts.sum_item_totals.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="text-sm font-bold text-gray-700 mb-2">Total BOM AC</div>
                <div className="text-2xl font-bold text-purple-600">
                  {currencySymbol}{overallACData.base_amounts.total_bom_ac.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Overall AC</div>
            <div className="text-2xl font-bold text-orange-600">
              {currencySymbol}{totals.totalQuoted.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">{filteredCosts.length} cost{filteredCosts.length !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>

        {grandTotal && (
          <Card>
            <CardContent className="p-5">
              <div className="text-sm font-bold text-gray-700 mb-2">Grand Total</div>
              <div className="text-2xl font-bold text-green-600">
                {currencySymbol}{grandTotal.quoted.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search costs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Cost Type Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'costType' ? null : 'costType'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${!selectedCostTypes.includes('all') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span>Type</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{selectedCostTypes.includes('all') ? 'All' : selectedCostTypes.length}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {openDropdown === 'costType' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedCostTypes.includes('all')} onChange={() => setSelectedCostTypes(['all'])} className="rounded" />
                      <span className="text-sm font-medium">All Types</span>
                    </label>
                    {availableCostTypes.map(type => (
                      <label key={type} className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer ${selectedCostTypes.includes(type) ? 'bg-purple-50' : ''}`}>
                        <input type="checkbox" checked={selectedCostTypes.includes(type)} onChange={() => setSelectedCostTypes(toggleSelection(selectedCostTypes, type))} className="rounded" />
                        <span className="text-sm">{type === 'PERCENTAGE' ? 'Percentage' : 'Flat Rate'}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Views (Column Visibility) Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'columns' ? null : 'columns'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  visibleColumns.size < columnDefs.length ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span>Views</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{visibleColumns.size}/{columnDefs.length}</span>
              </button>

              {openDropdown === 'columns' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">Show Columns</span>
                    <button
                      onClick={() => setVisibleColumns(new Set(columnDefs.map(c => c.key)))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Show All
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {columnDefs.map(col => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-gray-600">Show:</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 border rounded text-xs">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button onClick={handleClearAllFilters} className="px-3 py-2 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium">
                Clear All
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Overall Additional Costs</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {showDisplayOnly ? 'Display-only costs (NOT in grand total)' : 'Costs included in grand total'}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded">
              <button
                onClick={() => setShowDisplayOnly(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${!showDisplayOnly ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                Included ({includedSection?.costs.length || 0})
              </button>
              <button
                onClick={() => setShowDisplayOnly(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${showDisplayOnly ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                Display Only ({displayOnlySection?.costs.length || 0})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 w-10">#</th>
                  {visibleColumns.has('cost_name') && (
                    <th
                      className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 relative"
                      style={{ width: columnWidths['cost_name'] || 250, minWidth: 150 }}
                      onClick={() => handleSort('cost_name')}
                    >
                      Cost Name {sortColumn === 'cost_name' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'cost_name', columnWidths['cost_name'] || 250)} />
                    </th>
                  )}
                  {visibleColumns.has('cost_type') && (
                    <th
                      className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 w-28"
                      onClick={() => handleSort('cost_type')}
                    >
                      Type {sortColumn === 'cost_type' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                  )}
                  {visibleColumns.has('rate') && (
                    <th
                      className="px-3 py-2.5 text-right font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 relative w-28"
                      onClick={() => handleSort('cost_value')}
                    >
                      Rate {sortColumn === 'cost_value' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                  )}
                  {visibleColumns.has('amount') && (
                    <th
                      className="px-3 py-2.5 text-right font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 relative"
                      style={{ width: columnWidths['amount'] || 140, minWidth: 100 }}
                      onClick={() => handleSort('quoted')}
                    >
                      Amount {sortColumn === 'quoted' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'amount', columnWidths['amount'] || 140)} />
                    </th>
                  )}
                  {visibleColumns.has('running_total') && (
                    <th
                      className="px-3 py-2.5 text-right font-bold text-green-700 bg-green-50 relative"
                      style={{ width: columnWidths['running_total'] || 160, minWidth: 120 }}
                    >
                      Running Total
                      <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'running_total', columnWidths['running_total'] || 160)} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white">
                {/* Base row - Item Cost + BOM AC */}
                {overallACData?.base_amounts && (
                  <tr className="border-b-2 border-gray-300 bg-blue-50">
                    <td className="px-3 py-2.5 text-gray-600 border-r border-gray-200"></td>
                    {visibleColumns.has('cost_name') && (
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        <span className="font-bold text-gray-900">Base (Items + BOM AC)</span>
                      </td>
                    )}
                    {visibleColumns.has('cost_type') && (
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-700">Base</span>
                      </td>
                    )}
                    {visibleColumns.has('rate') && (
                      <td className="px-3 py-2.5 text-right font-mono text-gray-500 border-r border-gray-200">-</td>
                    )}
                    {visibleColumns.has('amount') && (
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900 border-r border-gray-200">
                        {currencySymbol}{overallACData.base_amounts.base_amount_for_percentage.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.has('running_total') && (
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 bg-green-50">
                        {currencySymbol}{overallACData.base_amounts.base_amount_for_percentage.toLocaleString()}
                      </td>
                    )}
                  </tr>
                )}
                {paginatedCosts.map((cost, idx) => {
                  // Calculate running total: base + all costs up to and including this one
                  const baseAmount = overallACData?.base_amounts?.base_amount_for_percentage || 0;
                  const costsUpToNow = paginatedCosts.slice(0, idx + 1);
                  const runningTotal = baseAmount + costsUpToNow.reduce((sum, c) => sum + c.quoted_amount, 0);

                  return (
                    <tr key={`${cost.cost_name}-${idx}`} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="px-3 py-2.5 text-gray-600 border-r border-gray-200">{(currentPage - 1) * pageSize + idx + 1}</td>
                      {visibleColumns.has('cost_name') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <span className="font-medium text-gray-900">{cost.cost_name}</span>
                        </td>
                      )}
                      {visibleColumns.has('cost_type') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cost.cost_type === 'PERCENTAGE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {cost.cost_type === 'PERCENTAGE' ? 'Percentage' : 'Flat Rate'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.has('rate') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 border-r border-gray-200">
                          {cost.cost_type === 'PERCENTAGE' ? `${cost.cost_value}%` : `${currencySymbol}${cost.cost_value.toLocaleString()}`}
                        </td>
                      )}
                      {visibleColumns.has('amount') && (
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900 border-r border-gray-200">
                          {currencySymbol}{cost.quoted_amount.toLocaleString()}
                        </td>
                      )}
                      {visibleColumns.has('running_total') && (
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 bg-green-50">
                          {currencySymbol}{runningTotal.toLocaleString()}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {paginatedCosts.length === 0 && (
                  <tr>
                    <td colSpan={1 + visibleColumns.size} className="px-4 py-8 text-center text-gray-500">
                      {showDisplayOnly ? 'No display-only costs' : 'No costs found'}
                    </td>
                  </tr>
                )}
              </tbody>
              {paginatedCosts.length > 0 && (
                <tfoot className="bg-gray-100 border-t-2 border-gray-400">
                  <tr>
                    <td
                      colSpan={1 + (visibleColumns.has('cost_name') ? 1 : 0) + (visibleColumns.has('cost_type') ? 1 : 0) + (visibleColumns.has('rate') ? 1 : 0)}
                      className="px-3 py-2.5 font-bold text-gray-900 text-right"
                    >
                      TOTAL OVERALL AC
                    </td>
                    {visibleColumns.has('amount') && (
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 border-r border-gray-300">
                        {currencySymbol}{totals.totalQuoted.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.has('running_total') && (
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 bg-green-100">
                        {currencySymbol}{grandTotal?.quoted.toLocaleString()}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
              <span className="text-sm text-gray-600">Showing {paginatedCosts.length} of {sortedCosts.length}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>← Prev</button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>Next →</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
