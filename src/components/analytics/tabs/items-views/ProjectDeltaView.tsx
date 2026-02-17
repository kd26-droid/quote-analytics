import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { ProjectDeltaData, ProjectDeltaBOMInstance, ProjectDeltaBOMItem } from '../../../../services/api';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface ProjectDeltaViewProps {
  projectDeltaData?: ProjectDeltaData | null;
  currencySymbol: string;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

type StatusFilter = 'all' | 'MATCHED' | 'QTY_CHANGED' | 'NOT_IN_QUOTE';
type SectionFilter = 'all' | 'standalone' | 'bom';

const STATUS_STYLES: Record<string, string> = {
  MATCHED: 'bg-green-100 text-green-700',
  QTY_CHANGED: 'bg-amber-100 text-amber-700',
  NOT_IN_QUOTE: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  MATCHED: 'Matched',
  QTY_CHANGED: 'Qty Changed',
  NOT_IN_QUOTE: 'Not in Quote',
};

export default function ProjectDeltaView({
  projectDeltaData,
  currencySymbol,
  navigateToTab,
  navigationContext,
  filterResetKey,
  onClearAllFilters
}: ProjectDeltaViewProps) {

  // Filters
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [openDropdown, setOpenDropdown] = useState<'status' | 'section' | null>(null);

  // Expanded BOM instances
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination for standalone items
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Close dropdown on outside click
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

  // Reset filters on key change
  React.useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setTableSearch('');
      setStatusFilter('all');
      setSectionFilter('all');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Expand all BOMs on first load
  React.useEffect(() => {
    if (projectDeltaData?.bom_instances?.instances) {
      const allIds = new Set(
        projectDeltaData.bom_instances.instances.map(inst => inst.project_bom_entry_id)
      );
      setExpandedBOMs(allIds);
    }
  }, [projectDeltaData]);

  // No project linked
  if (!projectDeltaData) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-8 text-center">
          <div className="text-gray-500 text-sm">
            <p className="text-lg mb-2 font-semibold">No Project Linked</p>
            <p>This quote was not created from a project. Project Delta shows the comparison between project items and quote items.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overall_summary: summary, standalone_items, bom_instances, project } = projectDeltaData;

  const totalItems = summary.total_project_standalone_items + summary.total_project_bom_items;
  const totalMatched = summary.standalone_matched + summary.bom_items_matched;
  const totalMissing = summary.standalone_missing + summary.bom_items_missing;
  const totalQtyChanged = summary.standalone_qty_changed + summary.bom_items_qty_changed;

  // Filter standalone items
  const filteredStandalone = useMemo(() => {
    if (sectionFilter === 'bom') return [];
    let items = [...standalone_items.items];

    if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }

    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      items = items.filter(item =>
        item.item_code.toLowerCase().includes(search) ||
        item.item_name.toLowerCase().includes(search)
      );
    }

    // Sort
    items.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortColumn === 'item_code') { aVal = a.item_code; bVal = b.item_code; }
      else if (sortColumn === 'item_name') { aVal = a.item_name; bVal = b.item_name; }
      else if (sortColumn === 'project_quantity') { aVal = a.project_quantity; bVal = b.project_quantity; }
      else if (sortColumn === 'quote_quantity') { aVal = a.quote_quantity ?? -1; bVal = b.quote_quantity ?? -1; }
      else if (sortColumn === 'status') {
        const order = { NOT_IN_QUOTE: 0, QTY_CHANGED: 1, MATCHED: 2 };
        aVal = order[a.status] ?? 3; bVal = order[b.status] ?? 3;
      }
      else { aVal = a.item_code; bVal = b.item_code; }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : -aVal.localeCompare(bVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return items;
  }, [standalone_items.items, statusFilter, sectionFilter, tableSearch, sortColumn, sortDirection]);

  // Filter BOM instances
  const filteredBOMInstances = useMemo(() => {
    if (sectionFilter === 'standalone') return [];
    let instances = [...bom_instances.instances];

    if (statusFilter !== 'all') {
      instances = instances.filter(inst =>
        inst.status === statusFilter ||
        inst.items.some(item => item.status === statusFilter)
      );
    }

    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      instances = instances.filter(inst =>
        inst.bom_code.toLowerCase().includes(search) ||
        inst.bom_name.toLowerCase().includes(search) ||
        inst.items.some(item =>
          (item.item_code?.toLowerCase().includes(search)) ||
          (item.item_name?.toLowerCase().includes(search))
        )
      );
    }

    return instances;
  }, [bom_instances.instances, statusFilter, sectionFilter, tableSearch]);

  // Paginate standalone
  const totalPages = Math.ceil(filteredStandalone.length / pageSize);
  const paginatedStandalone = filteredStandalone.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc'
      ? <span className="text-blue-600 ml-1 text-[10px] font-bold">↑</span>
      : <span className="text-blue-600 ml-1 text-[10px] font-bold">↓</span>;
  };

  const hasActiveFilters = statusFilter !== 'all' || sectionFilter !== 'all' || tableSearch.trim() !== '';

  const handleClearAllFilters = () => {
    setStatusFilter('all');
    setSectionFilter('all');
    setTableSearch('');
    setCurrentPage(1);
    if (onClearAllFilters) onClearAllFilters();
  };

  const toggleBOM = (id: string) => {
    setExpandedBOMs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter BOM items within an instance
  const filterBOMItems = (items: ProjectDeltaBOMItem[]) => {
    let filtered = [...items];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      filtered = filtered.filter(item =>
        (item.item_code?.toLowerCase().includes(search)) ||
        (item.item_name?.toLowerCase().includes(search)) ||
        item.bom_path.toLowerCase().includes(search)
      );
    }
    return filtered;
  };

  const renderStatusBadge = (status: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );

  const renderQtyComparison = (projectQty: number, quoteQty: number | null, status: string) => {
    if (status === 'NOT_IN_QUOTE') {
      return <span className="text-gray-400">—</span>;
    }
    if (status === 'QTY_CHANGED') {
      return (
        <span className="font-mono">
          <span className="text-gray-500 line-through">{projectQty}</span>
          <span className="mx-1 text-gray-400">→</span>
          <span className="text-amber-700 font-semibold">{quoteQty}</span>
        </span>
      );
    }
    return <span className="font-mono text-gray-900">{quoteQty}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Project Info Banner */}
      <Card className="border-blue-300 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-blue-900 text-sm">PROJECT DELTA</h3>
              <p className="text-blue-700 text-xs mt-1">
                Comparing project <span className="font-semibold">{project.project_code}</span> ({project.project_name}) with this quote
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-700">Match Rate</div>
              <div className="text-2xl font-bold text-blue-900">
                {totalItems > 0 ? ((totalMatched / totalItems) * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-gray-700 mb-1">Total Project Items</div>
            <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.total_project_standalone_items} standalone + {summary.total_project_bom_items} in BOMs
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-green-700 mb-1">Matched</div>
            <div className="text-2xl font-bold text-green-600">{totalMatched}</div>
            <div className="text-xs text-green-600 mt-1">
              {totalItems > 0 ? ((totalMatched / totalItems) * 100).toFixed(0) : 0}% of project items
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-red-700 mb-1">Not in Quote</div>
            <div className="text-2xl font-bold text-red-600">{totalMissing}</div>
            <div className="text-xs text-red-600 mt-1">
              {totalItems > 0 ? ((totalMissing / totalItems) * 100).toFixed(0) : 0}% missing
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-amber-700 mb-1">Qty Changed</div>
            <div className="text-2xl font-bold text-amber-600">{totalQtyChanged}</div>
            <div className="text-xs text-amber-600 mt-1">
              quantities differ from project
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-gray-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search items..."
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {tableSearch && (
                <button onClick={() => { setTableSearch(''); setCurrentPage(1); }} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">×</button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'status' ? null : 'status'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${
                  statusFilter !== 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Status</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {statusFilter === 'all' ? 'All' : STATUS_LABELS[statusFilter]}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'status' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-48">
                  <div className="py-1">
                    {(['all', 'MATCHED', 'QTY_CHANGED', 'NOT_IN_QUOTE'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setOpenDropdown(null); setCurrentPage(1); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${statusFilter === s ? 'bg-blue-50 font-medium' : ''}`}
                      >
                        {s === 'all' ? 'All Statuses' : (
                          <span className="flex items-center gap-2">
                            {renderStatusBadge(s)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'section' ? null : 'section'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${
                  sectionFilter !== 'all' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Section</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {sectionFilter === 'all' ? 'All' : sectionFilter === 'standalone' ? 'Standalone' : 'BOM'}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'section' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-48">
                  <div className="py-1">
                    {([{ value: 'all' as SectionFilter, label: 'All Sections' }, { value: 'standalone' as SectionFilter, label: 'Standalone Items' }, { value: 'bom' as SectionFilter, label: 'BOM Items' }]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSectionFilter(opt.value); setOpenDropdown(null); setCurrentPage(1); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sectionFilter === opt.value ? 'bg-blue-50 font-medium' : ''}`}
                      >
                        {opt.label}
                      </button>
                    ))}
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
        </CardContent>
      </Card>

      {/* Standalone Items Section */}
      {sectionFilter !== 'bom' && standalone_items.items.length > 0 && (
        <Card className="border-gray-300 shadow-sm">
          <CardContent className="p-0">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  Standalone Items
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({standalone_items.summary.project_count} in project)
                  </span>
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Items added directly to the project (not inside any BOM)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-600 font-medium">{standalone_items.summary.matched} matched</span>
                <span className="text-red-600 font-medium">{standalone_items.summary.not_in_quote} missing</span>
                <span className="text-amber-600 font-medium">{standalone_items.summary.qty_changed} changed</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 w-10">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('item_code')}>
                      Item Code {renderSortIndicator('item_code')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('item_name')}>
                      Item Name {renderSortIndicator('item_name')}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('project_quantity')}>
                      Project Qty {renderSortIndicator('project_quantity')}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('quote_quantity')}>
                      Quote Qty {renderSortIndicator('quote_quantity')}
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>
                      Status {renderSortIndicator('status')}
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Match Path</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStandalone.map((item, idx) => (
                    <tr key={item.project_item_id} className={`border-b border-gray-200 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-blue-600 font-medium">{item.item_code}</td>
                      <td className="px-4 py-2.5 text-gray-900">
                        <div className="truncate max-w-[250px]" title={item.item_name}>{item.item_name}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{item.project_quantity}</td>
                      <td className="px-4 py-2.5 text-right">{renderQtyComparison(item.project_quantity, item.quote_quantity, item.status)}</td>
                      <td className="px-4 py-2.5 text-center">{renderStatusBadge(item.status)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {item.match_path ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.match_path === 'DIRECT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {item.match_path}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginatedStandalone.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No standalone items match the current filters
                      </td>
                    </tr>
                  )}
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
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100">Prev</button>
                  <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100">Next</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BOM Instances Section */}
      {sectionFilter !== 'standalone' && filteredBOMInstances.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold text-gray-900 text-sm">
              BOM Instances
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({bom_instances.summary.project_count} in project — {bom_instances.summary.matched} matched, {bom_instances.summary.not_in_quote} missing)
              </span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedBOMs(new Set(filteredBOMInstances.map(i => i.project_bom_entry_id)))}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setExpandedBOMs(new Set())}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Collapse All
              </button>
            </div>
          </div>

          {filteredBOMInstances.map(inst => {
            const isExpanded = expandedBOMs.has(inst.project_bom_entry_id);
            const bomItems = filterBOMItems(inst.items);

            return (
              <Card key={inst.project_bom_entry_id} className={`border-gray-300 shadow-sm ${inst.status === 'NOT_IN_QUOTE' ? 'border-l-4 border-l-red-400' : ''}`}>
                <CardContent className="p-0">
                  {/* BOM Instance Header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleBOM(inst.project_bom_entry_id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm font-mono">{inst.bom_code}</span>
                          <span className="text-gray-600 text-sm">{inst.bom_name}</span>
                          {renderStatusBadge(inst.status)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {inst.items_summary.project_count} items —{' '}
                          <span className="text-green-600">{inst.items_summary.matched} matched</span>
                          {inst.items_summary.not_in_quote > 0 && (
                            <>, <span className="text-red-600">{inst.items_summary.not_in_quote} missing</span></>
                          )}
                          {inst.items_summary.qty_changed > 0 && (
                            <>, <span className="text-amber-600">{inst.items_summary.qty_changed} changed</span></>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Project Qty</div>
                        <div className="font-mono font-semibold text-gray-900">{inst.project_quantity}</div>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Quote Qty</div>
                        <div className="font-mono font-semibold">
                          {inst.quote_quantity !== null ? (
                            <span className={inst.status === 'QTY_CHANGED' ? 'text-amber-700' : 'text-gray-900'}>
                              {inst.quote_quantity}
                            </span>
                          ) : (
                            <span className="text-red-500">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOM Items Table (expandable) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-300">
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs">Item Code</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs">Item Name</th>
                              <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs">BOM Path</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 text-xs">Project Qty</th>
                              <th className="px-4 py-2 text-right font-semibold text-gray-600 text-xs">Quote Qty</th>
                              <th className="px-4 py-2 text-center font-semibold text-gray-600 text-xs">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bomItems.map((item, idx) => {
                              const indent = item.bom_level === 'SUB' ? 16 : item.bom_level === 'SUB_SUB' ? 32 : 0;

                              // Sub-BOM reference row
                              if (item.is_sub_bom_ref) {
                                return (
                                  <tr key={`ref-${idx}`} className="bg-gray-50 border-b border-gray-200">
                                    <td colSpan={3} className="px-4 py-2" style={{ paddingLeft: `${16 + indent}px` }}>
                                      <span className="text-xs font-semibold text-gray-500 italic">
                                        ↳ Sub-BOM: {item.sub_bom_code || item.bom_path.split(' > ').pop()}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">{item.project_quantity}</td>
                                    <td className="px-4 py-2 text-right text-xs">{renderQtyComparison(item.project_quantity, item.quote_quantity, item.status)}</td>
                                    <td className="px-4 py-2 text-center">{renderStatusBadge(item.status)}</td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={`${item.enterprise_item_id || idx}`} className={`border-b border-gray-200 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                  <td className="px-4 py-2 font-mono text-blue-600 text-xs font-medium" style={{ paddingLeft: `${16 + indent}px` }}>
                                    {item.item_code || '—'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-900 text-xs">
                                    <div className="truncate max-w-[200px]" title={item.item_name || ''}>
                                      {item.item_name || '—'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                                    <div className="truncate max-w-[180px]" title={item.bom_path}>
                                      {item.bom_path}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-700">{item.project_quantity}</td>
                                  <td className="px-4 py-2 text-right text-xs">{renderQtyComparison(item.project_quantity, item.quote_quantity, item.status)}</td>
                                  <td className="px-4 py-2 text-center">{renderStatusBadge(item.status)}</td>
                                </tr>
                              );
                            })}
                            {bomItems.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-4 py-4 text-center text-gray-500 text-xs">
                                  No items match the current filters
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state when everything is filtered out */}
      {filteredStandalone.length === 0 && filteredBOMInstances.length === 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="text-gray-500 text-sm">
              <p className="text-lg mb-2 font-semibold">No Items Match</p>
              <p>Try adjusting your filters to see project delta data.</p>
              {hasActiveFilters && (
                <button onClick={handleClearAllFilters} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Clear All Filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
