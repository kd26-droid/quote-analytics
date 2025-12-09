import { useState, useMemo, useEffect } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { TopItemsAnalytics, Vendor } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData, CostViewItem } from '../../../../services/api';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';
import BOMInstanceFilter, { BOMInstanceFilterPills, getBOMInstanceFilterText } from '../../shared/BOMInstanceFilter';

interface VendorViewProps {
  data: TopItemsAnalytics;
  costViewData: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  topVendors: Vendor[];
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function VendorView({ costViewData, currencySymbol, totalQuoteValue, navigateToTab, navigationContext, filterResetKey, onClearAllFilters }: VendorViewProps) {
  // Core state - same as before
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters - same as before
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
  const [selectedBOMInstances, setSelectedBOMInstances] = useState<string[]>(['all']); // NEW: BOM instance filter
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [minCost, setMinCost] = useState(0);
  const [minItemCount, setMinItemCount] = useState(1);

  // New UI state
  const [chartViewMode, setChartViewMode] = useState<'cost' | 'items'>('cost');
  const [tableSearch, setTableSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('totalCost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [openDropdown, setOpenDropdown] = useState<'vendor' | 'bom' | 'bom-instance' | 'tags' | 'columns' | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [bomSearch, setBomSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Column visibility for vendor summary table
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'vendor', 'items', 'totalCost', 'avgRate', 'percentOfQuote'
  ]));

  // Column visibility for item detail table
  const [visibleItemColumns, setVisibleItemColumns] = useState<Set<string>>(new Set([
    'item_code', 'item_name', 'tags', 'bom_path', 'quantity', 'base_rate', 'quoted_rate', 'total_amount'
  ]));

  // Column definitions
  const vendorColumnDefs = [
    { key: 'vendor', label: 'Vendor Name', align: 'left' },
    { key: 'items', label: 'Item Count', align: 'right' },
    { key: 'totalCost', label: 'Total Cost', align: 'right' },
    { key: 'avgRate', label: 'Avg Rate', align: 'right' },
    { key: 'percentOfQuote', label: '% of Quote', align: 'right' },
  ];

  const itemColumnDefs = [
    { key: 'item_code', label: 'Item Code', align: 'left' },
    { key: 'item_name', label: 'Item Name', align: 'left' },
    { key: 'tags', label: 'Category', align: 'left' },
    { key: 'bom_path', label: 'BOM', align: 'left' },
    { key: 'quantity', label: 'Quantity', align: 'right' },
    { key: 'vendor_rate', label: 'Vendor Rate', align: 'right' },
    { key: 'base_rate', label: 'Base Rate', align: 'right' },
    { key: 'quoted_rate', label: 'Quoted Rate', align: 'right' },
    { key: 'total_amount', label: 'Total Cost', align: 'right' },
  ];

  // Auto-select vendor from navigation context
  useEffect(() => {
    if (navigationContext?.selectedVendor) {
      setSelectedVendor(navigationContext.selectedVendor);
    }
  }, [navigationContext]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendor, selectedTags, selectedBOMInstances, selectedBOMs, tableSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  // Get items from costViewData
  const items = costViewData.items;
  const filters = costViewData.filters;

  // Get unique tags (categories) from API filters
  const uniqueTags = useMemo(() => {
    return filters.tag_list || [];
  }, [filters.tag_list]);

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

  // Use shared BOM instances hook for volume scenario detection
  const { bomInstances, hasVolumeScenarios, filterByInstance } = useBOMInstances(items);

  // Build BOM hierarchy tree for filter dropdown
  interface BOMNode {
    code: string;
    fullPath: string;
    children: BOMNode[];
  }

  const bomHierarchy = useMemo(() => {
    const roots: BOMNode[] = [];
    const nodeMap = new Map<string, BOMNode>();

    // Sort uniqueBOMs by path depth first
    const sortedBOMs = [...uniqueBOMs].sort((a, b) => {
      const depthA = a.split(' > ').length;
      const depthB = b.split(' > ').length;
      return depthA - depthB;
    });

    sortedBOMs.forEach(bomPath => {
      const parts = bomPath.split(' > ');
      const code = parts[parts.length - 1];
      const node: BOMNode = { code, fullPath: bomPath, children: [] };
      nodeMap.set(bomPath, node);

      if (parts.length === 1) {
        roots.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join(' > ');
        const parent = nodeMap.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    return roots;
  }, [uniqueBOMs]);

  // Render BOM tree for dropdown
  const renderBOMTree = (nodes: BOMNode[], depth = 0): React.ReactNode => {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedBOMs.has(node.fullPath);
      const isSelected = selectedBOMs.includes(node.fullPath);
      const matchesSearch = !bomSearch.trim() ||
        node.code.toLowerCase().includes(bomSearch.toLowerCase()) ||
        node.fullPath.toLowerCase().includes(bomSearch.toLowerCase());

      // If search is active and this doesn't match and none of children match, hide
      if (bomSearch.trim() && !matchesSearch) {
        const childrenMatch = node.children.some(child =>
          child.code.toLowerCase().includes(bomSearch.toLowerCase()) ||
          child.fullPath.toLowerCase().includes(bomSearch.toLowerCase())
        );
        if (!childrenMatch) return null;
      }

      return (
        <div key={node.fullPath}>
          <div
            className={`flex items-center gap-1 py-1.5 px-2 hover:bg-gray-100 rounded cursor-pointer ${
              isSelected ? 'bg-blue-50' : ''
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedBOMs(prev => {
                    const next = new Set(prev);
                    if (next.has(node.fullPath)) {
                      next.delete(node.fullPath);
                    } else {
                      next.add(node.fullPath);
                    }
                    return next;
                  });
                }}
                className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, node.fullPath))}
                className="rounded border-gray-300"
              />
              <span className={`text-sm ${depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                {node.code}
              </span>
            </label>
          </div>
          {hasChildren && isExpanded && renderBOMTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // Base filtered items (for vendor analysis - without vendor filter)
  const baseFilteredItems = useMemo(() => {
    let result = [...items];

    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // NEW: Apply BOM Instance filter (primary filter for volume scenarios)
    if (!selectedBOMInstances.includes('all')) {
      result = result.filter(item =>
        selectedBOMInstances.includes(item.bom_instance_id)
      );
    }

    // Apply BOM Hierarchy filter (for sub-BOM filtering)
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.startsWith(bom + ' > ')
        )
      );
    }

    // Apply Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_id && selectedVendors.includes(item.vendor_id)
      );
    }

    return result;
  }, [items, selectedTags, selectedBOMInstances, selectedBOMs, selectedVendors]);

  // Vendor analysis data
  const vendorAnalysis = useMemo(() => {
    const vendorMap = new Map<string, {
      vendor_id: string;
      vendor_name: string;
      items: number;
      totalCost: number;
      totalQuantity: number;
    }>();

    baseFilteredItems.forEach(item => {
      if (!item.vendor_id || !item.vendor_name) return;

      const current = vendorMap.get(item.vendor_id) || {
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        items: 0,
        totalCost: 0,
        totalQuantity: 0
      };
      current.items += 1;
      current.totalCost += item.total_amount;
      current.totalQuantity += item.quantity;
      vendorMap.set(item.vendor_id, current);
    });

    return Array.from(vendorMap.values())
      .map(stats => ({
        vendor: stats.vendor_name,
        vendor_id: stats.vendor_id,
        items: stats.items,
        totalCost: stats.totalCost,
        avgRate: stats.totalQuantity > 0 ? stats.totalCost / stats.totalQuantity : 0,
        percentOfQuote: baseFilteredItems.length > 0 ? (stats.items / baseFilteredItems.length) * 100 : 0
      }))
      .filter(v => v.totalCost >= minCost && v.items >= minItemCount);
  }, [baseFilteredItems, minCost, minItemCount]);

  // Sorted vendor analysis
  const sortedVendorAnalysis = useMemo(() => {
    const sorted = [...vendorAnalysis];
    sorted.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof typeof a];
      let bVal: any = b[sortColumn as keyof typeof b];

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [vendorAnalysis, sortColumn, sortDirection]);

  // Filtered vendor list for table search
  const filteredVendorAnalysis = useMemo(() => {
    if (!tableSearch.trim()) return sortedVendorAnalysis;
    const search = tableSearch.toLowerCase();
    return sortedVendorAnalysis.filter(v => v.vendor.toLowerCase().includes(search));
  }, [sortedVendorAnalysis, tableSearch]);

  // Filtered items for selected vendor
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // NEW: Apply BOM Instance filter
    if (!selectedBOMInstances.includes('all')) {
      result = result.filter(item =>
        selectedBOMInstances.includes(item.bom_instance_id)
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

    if (selectedVendor !== 'all') {
      result = result.filter(item => item.vendor_name === selectedVendor);
    }

    // Apply table search for item view
    if (tableSearch.trim() && selectedVendor !== 'all') {
      const search = tableSearch.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(search) ||
        item.item_name.toLowerCase().includes(search)
      );
    }

    result.sort((a, b) => b.total_amount - a.total_amount);
    return result;
  }, [items, selectedVendor, selectedTags, selectedBOMInstances, selectedBOMs, tableSearch]);

  // Selected vendor stats
  const selectedVendorStats = useMemo(() => {
    if (selectedVendor === 'all') return null;
    const vendorItems = filteredItems;
    if (vendorItems.length === 0) return null;

    const totalCost = vendorItems.reduce((sum, item) => sum + item.total_amount, 0);
    const totalQuantity = vendorItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      vendor: selectedVendor,
      items: vendorItems.length,
      totalCost,
      avgRate: totalQuantity > 0 ? totalCost / totalQuantity : 0,
      percentOfQuote: items.length > 0 ? (vendorItems.length / items.length) * 100 : 0
    };
  }, [filteredItems, selectedVendor, items]);

  // Pagination
  const totalPages = Math.ceil(
    (selectedVendor === 'all' ? filteredVendorAnalysis.length : filteredItems.length) / pageSize
  );
  const paginatedVendors = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVendorAnalysis.slice(startIndex, startIndex + pageSize);
  }, [filteredVendorAnalysis, currentPage, pageSize]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...vendorAnalysis].sort((a, b) => {
      if (chartViewMode === 'items') return b.items - a.items;
      return b.totalCost - a.totalCost;
    });
    return sorted.slice(0, 6);
  }, [vendorAnalysis, chartViewMode]);

  const chartTotal = useMemo(() => {
    if (chartViewMode === 'items') {
      return vendorAnalysis.reduce((sum, v) => sum + v.items, 0);
    }
    return vendorAnalysis.reduce((sum, v) => sum + v.totalCost, 0);
  }, [vendorAnalysis, chartViewMode]);

  // Insights
  const insights = useMemo(() => {
    const totalCost = vendorAnalysis.reduce((sum, v) => sum + v.totalCost, 0);
    const totalItems = vendorAnalysis.reduce((sum, v) => sum + v.items, 0);
    const topVendor = vendorAnalysis.sort((a, b) => b.totalCost - a.totalCost)[0];

    return {
      vendorCount: vendorAnalysis.length,
      totalCost,
      totalItems,
      topVendor: topVendor?.vendor || '-',
      topVendorCost: topVendor?.totalCost || 0,
      avgPerVendor: vendorAnalysis.length > 0 ? totalCost / vendorAnalysis.length : 0
    };
  }, [vendorAnalysis]);

  // Check if any filters are active
  const hasActiveFilters = !selectedBOMInstances.includes('all') || !selectedBOMs.includes('all') || !selectedTags.includes('all') ||
    selectedVendor !== 'all' || tableSearch.trim() !== '' || minCost > 0 || minItemCount > 1;

  // Clear all filters
  // Global filter reset - responds to filterResetKey from parent
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMInstances(['all']);
      setSelectedBOMs(['all']);
      setSelectedTags(['all']);
      setSelectedVendors(['all']);
      setSelectedVendor('all');
      setTableSearch('');
      setMinCost(0);
      setMinItemCount(1);
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  const clearAllFilters = () => {
    setSelectedBOMs(['all']);
    setSelectedTags(['all']);
    setSelectedVendors(['all']);
    setSelectedVendor('all');
    setTableSearch('');
    setMinCost(0);
    setMinItemCount(1);
    setCurrentPage(1);
    // Trigger global reset
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

  // Filtered lists for dropdowns
  const filteredVendorList = useMemo(() => {
    if (!vendorSearch.trim()) return filters.vendor_list;
    return filters.vendor_list.filter(v =>
      v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())
    );
  }, [filters.vendor_list, vendorSearch]);

  const filteredTagList = useMemo(() => {
    if (!tagSearch.trim()) return uniqueTags;
    return uniqueTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
  }, [uniqueTags, tagSearch]);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Toggle column visibility
  const toggleColumn = (key: string, isVendorTable: boolean) => {
    const setter = isVendorTable ? setVisibleColumns : setVisibleItemColumns;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">

      {/* Sticky Filter Alert Bar */}
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
              <p className="text-sm text-orange-600">
                {selectedVendor !== 'all'
                  ? `Showing ${filteredItems.length} items from ${selectedVendor}`
                  : `Showing ${filteredVendorAnalysis.length} of ${vendorAnalysis.length} vendors`
                }
                {getBOMInstanceFilterText(bomInstances, selectedBOMInstances)}
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedTags.includes('all') && ` • Category: ${selectedTags.join(', ')}`}
                {tableSearch && ` • Search: "${tableSearch}"`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedVendor !== 'all' && (
              <button
                onClick={() => setSelectedVendor('all')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to All Vendors
              </button>
            )}
            <button
              onClick={clearAllFilters}
              className="px-6 py-2.5 text-base font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics Cards - 4 cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all" onClick={() => setSelectedVendor('all')}>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Vendors</div>
            <div className="text-3xl font-bold text-blue-600">{insights.vendorCount}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {currencySymbol}{insights.totalCost.toLocaleString()} total
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-gray-200 cursor-pointer hover:shadow-md hover:border-green-400 transition-all ${selectedVendor === insights.topVendor ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => insights.topVendor !== '-' && setSelectedVendor(insights.topVendor)}
        >
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Top Vendor</div>
            <div className="text-xl font-bold text-green-600 truncate" title={insights.topVendor}>{insights.topVendor}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {currencySymbol}{insights.topVendorCost.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Avg Cost / Vendor</div>
            <div className="text-3xl font-bold text-purple-600">
              {currencySymbol}{Math.floor(insights.avgPerVendor).toLocaleString()}
            </div>
            <div className="text-sm font-medium text-gray-700 mt-2">per vendor</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Items</div>
            <div className="text-3xl font-bold text-orange-600">{insights.totalItems}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {(insights.totalItems / Math.max(1, insights.vendorCount)).toFixed(1)} avg/vendor
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Vendor Analysis Charts</h3>
            {hasActiveFilters && (
              <p className="text-sm text-orange-600 font-medium mt-1">
                Charts showing {vendorAnalysis.length} vendors
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedTags.includes('all') && ` • Category: ${selectedTags.join(', ')}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setChartViewMode('cost')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'cost'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Cost
            </button>
            <button
              onClick={() => setChartViewMode('items')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'items'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Item Count
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Chart - Vendors or Item Breakdown */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              {selectedVendor === 'all' ? (
                <>
                  <h4 className="font-bold text-gray-900 mb-1 text-lg">
                    Top 6 Vendors {chartViewMode === 'items' ? 'by Item Count' : 'by Cost'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {chartViewMode === 'items'
                      ? 'Vendors supplying the most items in this quote'
                      : 'Vendors with highest total spend in this quote'
                    }
                  </p>

                  <div className="space-y-2">
                    {chartData.map((vendor, index) => {
                      const maxVal = chartData[0] ? (chartViewMode === 'items' ? chartData[0].items : chartData[0].totalCost) : 1;
                      const currentVal = chartViewMode === 'items' ? vendor.items : vendor.totalCost;
                      const widthPercent = (currentVal / maxVal) * 100;
                      return (
                        <div
                          key={vendor.vendor_id}
                          className="flex items-center gap-3 cursor-pointer rounded-lg p-1 -mx-1 transition-all hover:bg-gray-50"
                          onClick={() => setSelectedVendor(vendor.vendor)}
                          title="Click to view items from this vendor"
                        >
                          <div className="w-6 text-sm font-bold text-gray-500">{index + 1}</div>
                          <div className="w-32 text-sm font-medium truncate text-gray-900" title={vendor.vendor}>
                            {vendor.vendor}
                          </div>
                          <div className="flex-1 h-8 bg-gray-100 rounded relative">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: `${widthPercent}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                              {chartViewMode === 'items'
                                ? `${vendor.items} items`
                                : `${currencySymbol}${vendor.totalCost.toLocaleString()}`
                              }
                            </span>
                          </div>
                          <div
                            className="w-16 text-right text-sm font-medium text-gray-600 cursor-help"
                            title={`${vendor.percentOfQuote}`}
                          >
                            {vendor.percentOfQuote.toFixed(2)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {chartData.length === 0 && (
                    <div className="text-center text-gray-500 py-8">No vendor data to display</div>
                  )}
                </>
              ) : (
                <>
                  <h4 className="font-bold text-gray-900 mb-1 text-lg">
                    {selectedVendor} - Item Breakdown
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Top items from this vendor by cost
                  </p>

                  <div className="space-y-2">
                    {filteredItems.slice(0, 6).map((item, index) => {
                      const maxVal = filteredItems[0]?.total_amount || 1;
                      const widthPercent = (item.total_amount / maxVal) * 100;
                      const vendorTotal = filteredItems.reduce((s, i) => s + i.total_amount, 0);
                      const percentOfVendor = vendorTotal > 0 ? (item.total_amount / vendorTotal) * 100 : 0;
                      return (
                        <div
                          key={`${item.item_id}-${item.bom_path}`}
                          className="flex items-center gap-3 rounded-lg p-1 -mx-1 hover:bg-gray-50"
                        >
                          <div className="w-6 text-sm font-bold text-gray-500">{index + 1}</div>
                          <div className="w-24 text-sm font-medium truncate text-gray-900 font-mono" title={item.item_code}>
                            {item.item_code}
                          </div>
                          <div className="flex-1 h-8 bg-gray-100 rounded relative">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: `${widthPercent}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                              {currencySymbol}{item.total_amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-16 text-right text-sm font-medium text-gray-600">
                            {percentOfVendor.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-blue-600">
                    Showing top 6 of {filteredItems.length} items
                    <button onClick={() => setSelectedVendor('all')} className="ml-2 text-red-500 hover:text-red-700">[Back to All Vendors]</button>
                  </div>

                  {filteredItems.length === 0 && (
                    <div className="text-center text-gray-500 py-8">No items from this vendor</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Right Chart - Vendor Distribution or Category Breakdown */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              {selectedVendor === 'all' ? (
                <>
                  <h4 className="font-bold text-gray-900 mb-1 text-lg">Vendor Distribution</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    How spend is distributed across all vendors
                  </p>

                  <div className="space-y-3">
                    {vendorAnalysis.slice(0, 8).map((vendor, index) => {
                      const widthPercent = (vendor.totalCost / insights.totalCost) * 100;
                      return (
                        <div
                          key={vendor.vendor_id}
                          className="flex items-center gap-3 cursor-pointer rounded p-1 -mx-1 hover:bg-gray-50"
                          onClick={() => setSelectedVendor(vendor.vendor)}
                          title="Click to view items from this vendor"
                        >
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="w-32 text-sm font-medium truncate text-gray-900" title={vendor.vendor}>
                            {vendor.vendor}
                          </div>
                          <div className="flex-1 h-6 bg-gray-100 rounded relative">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${widthPercent}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                          <div
                            className="w-16 text-right text-sm font-bold cursor-help"
                            style={{ color: COLORS[index % COLORS.length] }}
                            title={`${vendor.percentOfQuote}`}
                          >
                            {vendor.percentOfQuote.toFixed(2)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {vendorAnalysis.length > 8 && (
                    <div className="mt-3 pt-2 border-t text-xs text-gray-500">
                      +{vendorAnalysis.length - 8} more vendors
                    </div>
                  )}

                  {vendorAnalysis.length > 0 && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-300">
                      <div className="w-3" />
                      <div className="w-32 text-sm font-bold text-gray-900">TOTAL</div>
                      <div className="flex-1 text-right text-sm font-bold text-gray-900 pr-2">
                        {currencySymbol}{insights.totalCost.toLocaleString()}
                      </div>
                      <div className="w-16 text-right text-sm font-bold text-gray-900">100%</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h4 className="font-bold text-gray-900 mb-1 text-lg">
                    {selectedVendor} - Category Breakdown
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    How this vendor's items are distributed by category
                  </p>

                  {(() => {
                    // Calculate category breakdown for selected vendor
                    const tagMap = new Map<string, number>();
                    filteredItems.forEach(item => {
                      if (item.tags.length === 0) {
                        tagMap.set('Uncategorized', (tagMap.get('Uncategorized') || 0) + item.total_amount);
                      } else {
                        item.tags.forEach(tag => {
                          tagMap.set(tag, (tagMap.get(tag) || 0) + item.total_amount);
                        });
                      }
                    });
                    const vendorTotal = filteredItems.reduce((s, i) => s + i.total_amount, 0);
                    const categoryData = Array.from(tagMap.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([tag, cost]) => ({
                        name: tag,
                        cost,
                        percent: vendorTotal > 0 ? (cost / vendorTotal) * 100 : 0
                      }));

                    const maxCost = categoryData[0]?.cost || 1;

                    return (
                      <>
                        <div className="space-y-3">
                          {categoryData.map((cat, index) => {
                            const widthPercent = (cat.cost / maxCost) * 100;
                            return (
                              <div
                                key={cat.name}
                                className="flex items-center gap-3 cursor-pointer rounded p-1 -mx-1 hover:bg-gray-50"
                                onClick={() => navigateToTab('items', { selectedCategory: cat.name })}
                                title="Click to view this category"
                              >
                                <div
                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <div className="w-32 text-sm font-medium truncate text-gray-900" title={cat.name}>
                                  {cat.name}
                                </div>
                                <div className="flex-1 h-6 bg-gray-100 rounded relative">
                                  <div
                                    className="h-full rounded"
                                    style={{
                                      width: `${widthPercent}%`,
                                      backgroundColor: COLORS[index % COLORS.length]
                                    }}
                                  />
                                </div>
                                <div className="w-20 text-right text-sm font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                                  {cat.percent.toFixed(1)}%
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {categoryData.length > 0 && (
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-300">
                            <div className="w-3" />
                            <div className="w-32 text-sm font-bold text-gray-900">TOTAL</div>
                            <div className="flex-1 text-right text-sm font-bold text-gray-900 pr-2">
                              {currencySymbol}{vendorTotal.toLocaleString()}
                            </div>
                            <div className="w-20 text-right text-sm font-bold text-gray-900">100%</div>
                          </div>
                        )}

                        {categoryData.length === 0 && (
                          <div className="text-center text-gray-500 py-8">No category data</div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Bar Above Table */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder={selectedVendor === 'all' ? "Search vendors..." : "Search items..."}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-48 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Vendor Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'vendor' ? null : 'vendor'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedVendors.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    {filteredVendorList.map(vendor => (
                      <label
                        key={vendor.vendor_id}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedVendors.includes(vendor.vendor_id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor.vendor_id)}
                          onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor.vendor_id))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 truncate">{vendor.vendor_name}</span>
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

            {/* BOM Instance Filter - Shows when volume scenarios exist (shared component) */}
            <BOMInstanceFilter
              bomInstances={bomInstances}
              selectedInstances={selectedBOMInstances}
              onSelectionChange={setSelectedBOMInstances}
              hasVolumeScenarios={hasVolumeScenarios}
            />

            {/* BOM Hierarchy Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'bom' ? null : 'bom'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedBOMs.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>BOM Hierarchy</span>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <span className="text-sm font-medium text-gray-900">All BOMs ({rootBOMCount})</span>
                    </label>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {renderBOMTree(bomHierarchy)}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedBOMs(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'tags' ? null : 'tags'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedTags.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    {filteredTagList.map(tag => (
                      <label
                        key={tag}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedTags.includes(tag) ? 'bg-blue-50' : ''
                        }`}
                      >
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

            {/* Page Size */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Views (Column Visibility) */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'columns' ? null : 'columns'); }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span>Views</span>
              </button>

              {openDropdown === 'columns' && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-900">Show Columns</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {(selectedVendor === 'all' ? vendorColumnDefs : itemColumnDefs).map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(selectedVendor === 'all' ? visibleColumns : visibleItemColumns).has(col.key)}
                          onChange={() => toggleColumn(col.key, selectedVendor === 'all')}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-200">
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear All */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
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

              {selectedVendor !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  Vendor: {selectedVendor}
                  <button onClick={() => setSelectedVendor('all')} className="hover:text-green-900">×</button>
                </span>
              )}

              {/* BOM Instance Pills (shared component) */}
              <BOMInstanceFilterPills
                bomInstances={bomInstances}
                selectedInstances={selectedBOMInstances}
                onSelectionChange={setSelectedBOMInstances}
                hasVolumeScenarios={hasVolumeScenarios}
              />

              {!selectedBOMs.includes('all') && selectedBOMs.map(bom => (
                <span key={bom} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  BOM: {bom.split(' > ').pop()}
                  <button onClick={() => {
                    const newBOMs = selectedBOMs.filter(b => b !== bom);
                    setSelectedBOMs(newBOMs.length ? newBOMs : ['all']);
                  }} className="hover:text-blue-900">×</button>
                </span>
              ))}

              {!selectedTags.includes('all') && selectedTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Category: {tag}
                  <button onClick={() => {
                    const newTags = selectedTags.filter(t => t !== tag);
                    setSelectedTags(newTags.length ? newTags : ['all']);
                  }} className="hover:text-purple-900">×</button>
                </span>
              ))}

              {tableSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  Search: "{tableSearch}"
                  <button onClick={() => setTableSearch('')} className="hover:text-gray-900">×</button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-bold text-gray-900 text-sm">
              {selectedVendor === 'all' ? 'All Vendors Summary' : `Items from ${selectedVendor}`}
            </h4>
          </div>
          <div className="overflow-x-auto">
            {selectedVendor === 'all' ? (
              /* Vendor Summary Table */
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-400">
                    <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-sm">#</th>
                    {vendorColumnDefs.filter(col => visibleColumns.has(col.key)).map(col => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 font-bold text-gray-700 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {sortColumn === col.key && (
                          <span className="ml-1 text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedVendors.map((vendor, idx) => (
                    <tr
                      key={vendor.vendor_id}
                      className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedVendor(vendor.vendor)}
                      title="Click to view items from this vendor"
                    >
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-sm">{(currentPage - 1) * pageSize + idx + 1}</td>
                      {visibleColumns.has('vendor') && (
                        <td className="px-3 py-2 text-sm text-blue-700 hover:text-blue-900 font-medium border-r border-gray-200">
                          {vendor.vendor}
                        </td>
                      )}
                      {visibleColumns.has('items') && (
                        <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-sm">{vendor.items} items</td>
                      )}
                      {visibleColumns.has('totalCost') && (
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-sm">
                          {currencySymbol}{vendor.totalCost.toLocaleString()}
                        </td>
                      )}
                      {visibleColumns.has('avgRate') && (
                        <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-sm">
                          {currencySymbol}{vendor.avgRate.toFixed(2)}
                        </td>
                      )}
                      {visibleColumns.has('percentOfQuote') && (
                        <td
                          className="px-3 py-2 text-right text-gray-600 text-sm cursor-help"
                          title={`${vendor.percentOfQuote}`}
                        >
                          {vendor.percentOfQuote.toFixed(2)}%
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* Item Detail Table */
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-400">
                    <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-sm">#</th>
                    {itemColumnDefs.filter(col => visibleItemColumns.has(col.key)).map(col => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 font-bold text-gray-700 border-r border-gray-300 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedItems.map((item, idx) => (
                    <tr key={`${item.item_id}-${item.bom_path}`} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-sm">{(currentPage - 1) * pageSize + idx + 1}</td>

                      {visibleItemColumns.has('item_code') && (
                        <td className="px-3 py-2 font-mono text-sm text-gray-900 border-r border-gray-200 font-medium">{item.item_code}</td>
                      )}

                      {visibleItemColumns.has('item_name') && (
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-xs truncate text-sm" title={item.item_name}>
                          {item.item_name}
                        </td>
                      )}

                      {visibleItemColumns.has('tags') && (
                        <td className="px-3 py-2 border-r border-gray-200">
                          {item.tags.length === 0 ? (
                            <span className="text-sm text-gray-500">-</span>
                          ) : item.tags.length === 1 ? (
                            <button
                              onClick={() => navigateToTab('items', { selectedCategory: item.tags[0] })}
                              className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
                            >
                              {item.tags[0]}
                            </button>
                          ) : (
                            <div className="relative group">
                              <button className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium">
                                {item.tags.length} categories
                              </button>
                              <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[150px] left-0 ${idx >= paginatedItems.length - 3 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                {item.tags.map((tag, tagIdx) => (
                                  <button
                                    key={tagIdx}
                                    onClick={() => navigateToTab('items', { selectedCategory: tag })}
                                    className="block text-sm text-blue-700 hover:text-blue-900 hover:underline py-0.5 w-full text-left"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      )}

                      {visibleItemColumns.has('bom_path') && (
                        <td className="px-3 py-2 border-r border-gray-200">
                          <button
                            onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                            className="font-mono text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
                          >
                            {item.bom_path}
                          </button>
                        </td>
                      )}

                      {visibleItemColumns.has('quantity') && (
                        <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-sm">
                          {item.quantity} {item.unit}
                        </td>
                      )}

                      {visibleItemColumns.has('vendor_rate') && (
                        <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-sm">
                          {item.vendor_rate?.toLocaleString() ?? '-'}
                        </td>
                      )}

                      {visibleItemColumns.has('base_rate') && (
                        <td className="px-3 py-2 text-right font-mono text-gray-700 border-r border-gray-200 text-sm">
                          {currencySymbol}{item.base_rate.toLocaleString()}
                        </td>
                      )}

                      {visibleItemColumns.has('quoted_rate') && (
                        <td className="px-3 py-2 text-right border-r border-gray-200">
                          <button
                            onClick={() => navigateToTab('items', { selectedItem: item.item_code })}
                            className="font-mono text-sm text-blue-700 hover:text-blue-900 hover:underline font-semibold"
                          >
                            {currencySymbol}{item.quoted_rate.toLocaleString()}
                          </button>
                        </td>
                      )}

                      {visibleItemColumns.has('total_amount') && (
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 text-sm">
                          {currencySymbol}{item.total_amount.toLocaleString()}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer with Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {selectedVendor === 'all'
                ? `Showing ${paginatedVendors.length} of ${filteredVendorAnalysis.length} vendors. Click any vendor to view their items.`
                : `Showing ${paginatedItems.length} of ${filteredItems.length} items from ${selectedVendor}`
              }
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
