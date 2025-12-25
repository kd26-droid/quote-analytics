import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { CostViewData, CostViewItem } from '../../../../services/api';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';

interface ItemVolumeAnalysisViewProps {
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

// Color palette for charts
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Display mode for the view
type DisplayMode = 'table' | 'chart';

export default function ItemVolumeAnalysisView({
  costViewData,
  currencySymbol,
  totalQuoteValue,
  navigateToTab,
  navigationContext,
  filterResetKey,
  onClearAllFilters
}: ItemVolumeAnalysisViewProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');

  // Column visibility - like CostView's "Views" dropdown
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_code', 'item_name'
  ]));

  // Column definitions (optional columns that can be shown/hidden)
  const columnDefs = [
    { key: 'item_code', label: 'Item Code', align: 'left' as const },
    { key: 'item_name', label: 'Item Name', align: 'left' as const },
    { key: 'vendor_name', label: 'Vendor', align: 'left' as const },
    { key: 'bom_path', label: 'BOM Hierarchy', align: 'left' as const },
  ];

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [tableSearch, setTableSearch] = useState('');

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('item_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<'vendor' | 'tags' | 'bom' | 'views' | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [bomSearch, setBomSearch] = useState('');

  // Get items from API - with null safety
  const items = costViewData?.items || [];
  const filters = costViewData?.filters || { vendor_list: [], tag_list: [] };

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
      setSelectedVendors(['all']);
      setSelectedTags(['all']);
      setSelectedBOMs(['all']);
      setTableSearch('');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Build BOM hierarchy list for filter
  const bomHierarchy = useMemo(() => {
    const bomPathSet = new Set<string>();
    const rootBOMs = new Set<string>();

    items.forEach(item => {
      if (item.bom_path) {
        bomPathSet.add(item.bom_path);
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);
        for (let i = 1; i < parts.length; i++) {
          bomPathSet.add(parts.slice(0, i + 1).join(' > '));
        }
      }
    });

    const hierarchy: { path: string; level: number; label: string }[] = [];
    const sortedPaths = Array.from(bomPathSet).sort();

    sortedPaths.forEach(path => {
      const parts = path.split(' > ');
      hierarchy.push({
        path,
        level: parts.length - 1,
        label: parts[parts.length - 1]
      });
    });

    return { paths: hierarchy, rootBOMs: Array.from(rootBOMs).sort() };
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

  // Group items by item_code + bom_path to find volume scenarios
  const volumeAnalysisData = useMemo(() => {
    if (!hasVolumeScenarios) return [];

    const itemGroups = new Map<string, CostViewItem[]>();

    items.forEach(item => {
      const key = `${item.item_code}||${item.bom_path || item.bom_code}`;
      if (!itemGroups.has(key)) {
        itemGroups.set(key, []);
      }
      itemGroups.get(key)!.push(item);
    });

    const volumeItems: {
      item_code: string;
      item_name: string;
      vendor_name: string | null;
      bom_path: string;
      tags: string[];
      instances: {
        bom_instance_id: string;
        bom_instance_qty: number;
        bom_code: string;
        quantity: number;
        vendor_rate: number;
        base_rate: number;
        quoted_rate: number;
        total_ac: number;
        total_cost: number;
      }[];
    }[] = [];

    itemGroups.forEach((groupItems, _key) => {
      const uniqueInstances = new Set(groupItems.map(i => i.bom_instance_id));

      if (uniqueInstances.size > 1) {
        const sortedItems = [...groupItems].sort((a, b) => a.bom_instance_qty - b.bom_instance_qty);

        volumeItems.push({
          item_code: sortedItems[0].item_code,
          item_name: sortedItems[0].item_name,
          vendor_name: sortedItems[0].vendor_name,
          bom_path: sortedItems[0].bom_path || sortedItems[0].bom_code,
          tags: sortedItems[0].tags,
          instances: sortedItems.map(item => ({
            bom_instance_id: item.bom_instance_id,
            bom_instance_qty: item.bom_instance_qty,
            bom_code: item.bom_code,
            quantity: item.quantity,
            vendor_rate: item.vendor_rate,
            base_rate: item.base_rate,
            quoted_rate: item.quoted_rate,
            total_ac: item.additional_cost_per_unit,
            total_cost: item.total_amount
          }))
        });
      }
    });

    return volumeItems;
  }, [items, hasVolumeScenarios]);

  // Get unique BOM instances for column headers (sorted by quantity)
  const uniqueBOMInstances = useMemo(() => {
    const instances = new Map<string, { id: string; qty: number; code: string; label: string }>();

    volumeAnalysisData.forEach(item => {
      item.instances.forEach(inst => {
        if (!instances.has(inst.bom_instance_id)) {
          instances.set(inst.bom_instance_id, {
            id: inst.bom_instance_id,
            qty: inst.bom_instance_qty,
            code: inst.bom_code,
            label: `${inst.bom_code} @ ${inst.bom_instance_qty} units`
          });
        }
      });
    });

    return Array.from(instances.values()).sort((a, b) => a.qty - b.qty);
  }, [volumeAnalysisData]);

  // Apply filters
  const filteredData = useMemo(() => {
    let result = [...volumeAnalysisData];

    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_name && selectedVendors.includes(item.vendor_name)
      );
    }

    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.startsWith(bom + ' > ')
        )
      );
    }

    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(search) ||
        item.item_name.toLowerCase().includes(search) ||
        (item.vendor_name && item.vendor_name.toLowerCase().includes(search)) ||
        item.bom_path.toLowerCase().includes(search)
      );
    }

    return result;
  }, [volumeAnalysisData, selectedVendors, selectedTags, selectedBOMs, tableSearch]);

  // Get value - always show quoted_rate
  const getValue = (instance: typeof volumeAnalysisData[0]['instances'][0]) => {
    return instance.quoted_rate;
  };

  // Check if item has anomaly (price at higher quantity is same or more expensive)
  const hasAnomaly = (item: typeof volumeAnalysisData[0]) => {
    if (item.instances.length < 2) return false;
    const lowestQtyValue = getValue(item.instances[0]);

    for (let i = 1; i < item.instances.length; i++) {
      const higherQtyValue = getValue(item.instances[i]);
      if (higherQtyValue >= lowestQtyValue) {
        return true;
      }
    }
    return false;
  };

  // Count anomalies
  const anomalyCount = useMemo(() => {
    return filteredData.filter(item => hasAnomaly(item)).length;
  }, [filteredData]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortColumn === 'item_code') {
        aVal = a.item_code;
        bVal = b.item_code;
      } else if (sortColumn === 'item_name') {
        aVal = a.item_name;
        bVal = b.item_name;
      } else if (sortColumn === 'vendor_name') {
        aVal = a.vendor_name || '';
        bVal = b.vendor_name || '';
      } else if (sortColumn === 'bom_path') {
        aVal = a.bom_path || '';
        bVal = b.bom_path || '';
      } else {
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
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset page on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendors, selectedTags, tableSearch]);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === 'asc'
      ? <span className="text-blue-600 ml-1 text-[10px] font-bold">↑</span>
      : <span className="text-blue-600 ml-1 text-[10px] font-bold">↓</span>;
  };

  // Check for active filters
  const hasActiveFilters = !selectedVendors.includes('all') || !selectedTags.includes('all') || !selectedBOMs.includes('all') || tableSearch.trim() !== '';

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedVendors(['all']);
    setSelectedTags(['all']);
    setSelectedBOMs(['all']);
    setTableSearch('');
    if (onClearAllFilters) onClearAllFilters();
  };

  // Chart data for selected items
  const chartData = useMemo(() => {
    const topItems = [...filteredData].slice(0, 8);

    return uniqueBOMInstances.map(inst => {
      const dataPoint: Record<string, number | string> = {
        name: `${inst.qty} units`,
        qty: inst.qty
      };

      topItems.forEach(item => {
        const instance = item.instances.find(i => i.bom_instance_id === inst.id);
        if (instance) {
          dataPoint[item.item_code] = getValue(instance);
        }
      });

      return dataPoint;
    });
  }, [filteredData, uniqueBOMInstances]);

  // No volume scenarios
  if (!hasVolumeScenarios || volumeAnalysisData.length === 0) {
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
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-gray-700 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-blue-600">{filteredData.length}</div>
            <div className="text-xs text-gray-500 mt-1">with volume scenarios</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-gray-700 mb-1">BOM Instances</div>
            <div className="text-2xl font-bold text-cyan-600">{uniqueBOMInstances.length}</div>
            <div className="text-xs text-gray-500 mt-1">volume configurations</div>
          </CardContent>
        </Card>
        <Card className={`border-gray-200 ${anomalyCount > 0 ? 'bg-orange-50' : ''}`}>
          <CardContent className="p-4">
            <div className="text-sm font-bold text-orange-700 mb-1">Anomalies</div>
            <div className="text-2xl font-bold text-orange-600">{anomalyCount}</div>
            <div className="text-xs text-orange-600 mt-1">prices not decreasing at scale</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Views */}
      <Card className="border-gray-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search items..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {tableSearch && (
                <button onClick={() => setTableSearch('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                  ×
                </button>
              )}
            </div>

            {/* Vendor Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'vendor' ? null : 'vendor'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${
                  !selectedVendors.includes('all') ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Vendor</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedVendors.includes('all') ? 'All' : selectedVendors.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'vendor' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-64">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search vendors..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="px-2 py-2 border-b border-gray-100">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes('all')}
                        onChange={() => setSelectedVendors(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All Vendors</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filters.vendor_list
                      .filter(v => !vendorSearch || v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase()))
                      .map(vendor => (
                        <label key={vendor.vendor_id} className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedVendors.includes(vendor.vendor_name)}
                            onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor.vendor_name))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{vendor.vendor_name}</span>
                        </label>
                      ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedVendors(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'tags' ? null : 'tags'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${
                  !selectedTags.includes('all') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Category</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedTags.includes('all') ? 'All' : selectedTags.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'tags' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-64">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="px-2 py-2 border-b border-gray-100">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes('all')}
                        onChange={() => setSelectedTags(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All Categories</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {(filters.tag_list || [])
                      .filter(tag => !tagSearch || tag.toLowerCase().includes(tagSearch.toLowerCase()))
                      .map(tag => (
                        <label key={tag} className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => setSelectedTags(toggleSelection(selectedTags, tag))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{tag}</span>
                        </label>
                      ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedTags(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* BOM Hierarchy Filter */}
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-72">
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
                  <div className="max-h-64 overflow-y-auto py-1">
                    {bomHierarchy.paths
                      .filter(bom => !bomSearch || bom.path.toLowerCase().includes(bomSearch.toLowerCase()))
                      .map(bom => (
                        <label
                          key={bom.path}
                          className={`flex items-center gap-2 px-4 py-1.5 hover:bg-gray-100 cursor-pointer ${
                            selectedBOMs.includes(bom.path) ? 'bg-blue-50' : ''
                          }`}
                          style={{ paddingLeft: `${16 + bom.level * 16}px` }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBOMs.includes(bom.path)}
                            onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bom.path))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700 font-mono">{bom.label}</span>
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

            {/* Views - Column visibility dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'views' ? null : 'views'); }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <span>Views</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{visibleColumns.size}</span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'views' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="p-2 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 px-2 py-1">Show/Hide Columns</div>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {columnDefs.map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
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

            <div className="h-6 w-px bg-gray-300 ml-auto" />

            {/* Display Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('table')}
                className={`px-3 py-1.5 text-xs font-medium rounded ${
                  displayMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setDisplayMode('chart')}
                className={`px-3 py-1.5 text-xs font-medium rounded ${
                  displayMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Chart
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLE VIEW */}
      {displayMode === 'table' && (
        <Card className="border-gray-300 shadow-sm">
          <CardContent className="p-0">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">
                  Quoted Rate Comparison
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Compare item rates across different BOM quantities
                </p>
              </div>
              <div className="text-xs text-gray-600">
                Showing {paginatedData.length} of {filteredData.length} items
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    {visibleColumns.has('item_code') && (
                      <th
                        className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 sticky left-0 bg-gray-100 z-10"
                        onClick={() => handleSort('item_code')}
                        style={{ minWidth: '120px' }}
                      >
                        Item Code {renderSortIndicator('item_code')}
                      </th>
                    )}
                    {visibleColumns.has('item_name') && (
                      <th
                        className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('item_name')}
                        style={{ minWidth: '180px' }}
                      >
                        Item Name {renderSortIndicator('item_name')}
                      </th>
                    )}
                    {visibleColumns.has('vendor_name') && (
                      <th
                        className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('vendor_name')}
                        style={{ minWidth: '120px' }}
                      >
                        Vendor {renderSortIndicator('vendor_name')}
                      </th>
                    )}
                    {visibleColumns.has('bom_path') && (
                      <th
                        className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('bom_path')}
                        style={{ minWidth: '150px' }}
                      >
                        BOM Hierarchy {renderSortIndicator('bom_path')}
                      </th>
                    )}
                    {uniqueBOMInstances.map(inst => (
                      <th
                        key={inst.id}
                        className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort(inst.id)}
                        style={{ minWidth: '120px' }}
                      >
                        {inst.label} {renderSortIndicator(inst.id)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, idx) => {
                    const lowestQtyValue = item.instances.length > 0 ? getValue(item.instances[0]) : 0;

                    return (
                      <tr key={`${item.item_code}-${item.bom_path}`} className={`border-b border-gray-200 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        {visibleColumns.has('item_code') && (
                          <td className="px-4 py-3 font-mono text-blue-600 sticky left-0 bg-inherit z-10">
                            {item.item_code}
                          </td>
                        )}
                        {visibleColumns.has('item_name') && (
                          <td className="px-4 py-3 text-gray-900">
                            <div className="truncate max-w-[200px]" title={item.item_name}>
                              {item.item_name}
                            </div>
                          </td>
                        )}
                        {visibleColumns.has('vendor_name') && (
                          <td className="px-4 py-3 text-gray-700">
                            {item.vendor_name || '-'}
                          </td>
                        )}
                        {visibleColumns.has('bom_path') && (
                          <td className="px-4 py-3 text-blue-700 font-mono text-xs">
                            <span title={item.bom_path}>{item.bom_path}</span>
                          </td>
                        )}
                        {uniqueBOMInstances.map((inst, instIdx) => {
                          const instance = item.instances.find(i => i.bom_instance_id === inst.id);
                          const value = instance ? getValue(instance) : null;

                          // Anomaly detection: only highlight if price at higher qty is same or more
                          const isAnomaly = instIdx > 0 && value !== null && lowestQtyValue > 0 && value >= lowestQtyValue;

                          return (
                            <td
                              key={inst.id}
                              className={`px-4 py-3 text-right font-mono ${
                                isAnomaly ? 'bg-orange-100 text-orange-700 font-semibold' : 'text-gray-900'
                              }`}
                            >
                              {value !== null
                                ? `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'
                              }
                            </td>
                          );
                        })}
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
      )}

      {/* CHART VIEW */}
      {displayMode === 'chart' && (
        <Card className="border-gray-300 shadow-sm">
          <CardContent className="p-4">
            <h4 className="font-bold text-gray-900 text-sm mb-4">
              Quoted Rate Trend Across Volumes
            </h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${currencySymbol}${v}`} />
                  <Tooltip
                    formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, '']}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  {[...filteredData]
                    .slice(0, 8)
                    .map((item, idx) => (
                      <Line
                        key={item.item_code}
                        type="monotone"
                        dataKey={item.item_code}
                        name={item.item_code}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Showing first 8 items. Orange highlighted values indicate anomalies (price not decreasing at scale).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
