import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
// Removed Recharts - using custom bar visualization for clarity
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { ItemViewType } from '../ItemsTab';
import type { CostViewData, CostViewItem } from '../../../../services/api';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';
import BOMInstanceFilter, { BOMInstanceFilterPills, getBOMInstanceFilterText } from '../../shared/BOMInstanceFilter';

interface CostViewProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol: string;
  totalQuoteValue: number;
  totalItems: number;
  navigationContext?: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  setSelectedView?: (view: ItemViewType) => void;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SOURCE_COLORS: Record<string, string> = {
  'PROJECT': '#3b82f6',
  'EVENT': '#8b5cf6',
  'QUOTE': '#10b981'
};

const SOURCE_LABELS: Record<string, string> = {
  'PROJECT': 'Project',
  'EVENT': 'Event',
  'QUOTE': 'Quote'
};

export default function CostView({
  costViewData,
  currencySymbol,
  totalQuoteValue,
  totalItems,
  navigationContext,
  navigateToTab,
  setSelectedView,
  filterResetKey,
  onClearAllFilters
}: CostViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMInstances, setSelectedBOMInstances] = useState<string[]>(['all']); // Now uses bom_instance_id
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']); // Keep for backward compatibility with bom_path filtering
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
  const [selectedItems, setSelectedItems] = useState<string[]>(['all']);
  const [costRange, setCostRange] = useState<[number, number]>([0, 100000000]);
  const [sortColumn, setSortColumn] = useState<string>('total_amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<'bom' | 'bom-instance' | 'vendor' | 'tags' | 'cost' | 'columns' | 'items' | null>(null);
  const [bomSearch, setBomSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState('');
  const [chartViewMode, setChartViewMode] = useState<'total' | 'base'>('total');
  const [chartSelectedItem, setChartSelectedItem] = useState<string | null>(null);
  const [chartSelectedBOM, setChartSelectedBOM] = useState<string | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_code', 'item_name', 'tags', 'vendor_name', 'bom_path', 'item_source',
    'quantity', 'base_rate', 'quoted_rate', 'total_additional_cost', 'total_amount', 'percent_of_quote'
  ]));

  // Column definitions
  const columnDefs = [
    { key: 'item_code', label: 'Item Code', align: 'left' },
    { key: 'item_name', label: 'Item Name', align: 'left' },
    { key: 'tags', label: 'Tags', align: 'left' },
    { key: 'vendor_name', label: 'Vendor', align: 'left' },
    { key: 'bom_path', label: 'BOM', align: 'left' },
    { key: 'item_source', label: 'Source', align: 'center' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'base_rate', label: 'Base Rate', align: 'right' },
    { key: 'quoted_rate', label: 'Quoted Rate', align: 'right' },
    { key: 'total_additional_cost', label: 'Item AC', align: 'right' },
    { key: 'total_amount', label: 'Total', align: 'right' },
    { key: 'percent_of_quote', label: '% Quote', align: 'right' },
  ];

  // Reset ALL local filters when filterResetKey changes (triggered by parent clearAllFilters)
  React.useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMInstances(['all']);
      setSelectedBOMs(['all']);
      setSelectedVendors(['all']);
      setSelectedTags(['all']);
      setSelectedItems(['all']);
      setCostRange([0, 100000000]);
      setTableSearch('');
      setCurrentPage(1);
      setChartSelectedItem(null);
      setChartSelectedBOM(null);
    }
  }, [filterResetKey]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow hiding all columns - keep at least item_code
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Calculate max cost for range slider
  const maxCostInData = useMemo(() => {
    return Math.max(...costViewData.items.map(item => item.total_amount), 100000);
  }, [costViewData.items]);

  // Use real API data
  const items = costViewData.items;
  const filters = costViewData.filters;

  // Use shared BOM instances hook for volume scenario detection
  const { bomInstances, hasVolumeScenarios, filterByInstance } = useBOMInstances(items);

  // Get unique BOM paths for hierarchy filter (separate from instances)
  const { allUniqueBOMPaths, rootBOMCount } = useMemo(() => {
    const bomPathSet = new Set<string>();
    const rootBOMs = new Set<string>();

    items.forEach(item => {
      if (item.bom_path) {
        bomPathSet.add(item.bom_path);

        // Track root BOM (first part of the path)
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);

        // Also add parent paths for hierarchy display
        for (let i = 1; i < parts.length; i++) {
          bomPathSet.add(parts.slice(0, i).join(' > '));
        }
      }
    });

    // Sort by hierarchy depth then alphabetically
    const sortedPaths = Array.from(bomPathSet).sort((a, b) => {
      const depthA = a.split(' > ').length;
      const depthB = b.split(' > ').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    return {
      allUniqueBOMPaths: sortedPaths,
      rootBOMCount: rootBOMs.size
    };
  }, [items]);

  // Auto-select BOM from navigation context
  React.useEffect(() => {
    if (navigationContext?.selectedBOM) {
      setSelectedBOMs([navigationContext.selectedBOM]);
    }
  }, [navigationContext]);

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

  // Build hierarchical BOM structure for tree display
  const bomHierarchy = useMemo(() => {
    const roots: { code: string; path: string; children: any[] }[] = [];
    const pathMap = new Map<string, { code: string; path: string; children: any[] }>();

    // Get unique root BOMs
    const rootBOMs = new Set<string>();
    items.forEach(item => {
      if (item.bom_path) {
        const parts = item.bom_path.split(' > ');
        rootBOMs.add(parts[0]);
      }
    });

    // Build tree structure
    rootBOMs.forEach(rootCode => {
      const rootNode = { code: rootCode, path: rootCode, children: [] as any[] };
      pathMap.set(rootCode, rootNode);
      roots.push(rootNode);
    });

    // Add all paths and build hierarchy
    allUniqueBOMPaths.forEach(path => {
      const parts = path.split(' > ');
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join(' > ');
        const currentCode = parts[parts.length - 1];

        let parent = pathMap.get(parentPath);
        if (!parent) {
          // Create parent if it doesn't exist
          parent = { code: parts[parts.length - 2], path: parentPath, children: [] };
          pathMap.set(parentPath, parent);
        }

        const node = { code: currentCode, path, children: [] as any[] };
        pathMap.set(path, node);
        parent.children.push(node);
      }
    });

    return roots;
  }, [items, allUniqueBOMPaths]);

  // Filter BOMs by search
  const filteredBOMPaths = useMemo(() => {
    if (!bomSearch.trim()) return allUniqueBOMPaths;
    const search = bomSearch.toLowerCase();
    return allUniqueBOMPaths.filter(path =>
      path.toLowerCase().includes(search)
    );
  }, [allUniqueBOMPaths, bomSearch]);

  // Filter vendors by search
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return filters.vendor_list;
    const search = vendorSearch.toLowerCase();
    return filters.vendor_list.filter(v =>
      v.vendor_name.toLowerCase().includes(search)
    );
  }, [filters.vendor_list, vendorSearch]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return filters.tag_list;
    const search = tagSearch.toLowerCase();
    return filters.tag_list.filter(t =>
      t.toLowerCase().includes(search)
    );
  }, [filters.tag_list, tagSearch]);

  // Get unique items list for filter
  const uniqueItemsList = useMemo(() => {
    const itemMap = new Map<string, { item_id: string; item_code: string; item_name: string }>();
    items.forEach(item => {
      if (!itemMap.has(item.item_id)) {
        itemMap.set(item.item_id, {
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name
        });
      }
    });
    return Array.from(itemMap.values()).sort((a, b) => a.item_code.localeCompare(b.item_code));
  }, [items]);

  // Filter items by search
  const filteredItemsList = useMemo(() => {
    if (!itemSearch.trim()) return uniqueItemsList;
    const search = itemSearch.toLowerCase();
    return uniqueItemsList.filter(item =>
      item.item_code.toLowerCase().includes(search) ||
      item.item_name.toLowerCase().includes(search)
    );
  }, [uniqueItemsList, itemSearch]);

  // Toggle BOM tree expand/collapse
  const toggleBOMExpand = (path: string) => {
    setExpandedBOMs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Recursive BOM tree renderer
  const renderBOMTree = (nodes: { code: string; path: string; children: any[] }[], depth: number = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedBOMs.has(node.path);
      const isSelected = selectedBOMs.includes(node.path);
      const matchesSearch = !bomSearch || node.path.toLowerCase().includes(bomSearch.toLowerCase());
      const childMatchesSearch = !bomSearch || node.children.some(c =>
        c.path.toLowerCase().includes(bomSearch.toLowerCase()) ||
        c.children.some((cc: any) => cc.path.toLowerCase().includes(bomSearch.toLowerCase()))
      );

      if (!matchesSearch && !childMatchesSearch) return null;

      return (
        <div key={node.path}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleBOMExpand(node.path); }}
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
                onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, node.path))}
                className="rounded border-gray-300"
              />
              <span className={`text-sm ${depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                {node.code}
              </span>
              {hasChildren && (
                <span className="text-xs text-gray-400 ml-auto mr-2">
                  {node.children.length} sub
                </span>
              )}
            </label>
          </div>
          {hasChildren && isExpanded && renderBOMTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // Check if any filters are active
  const hasActiveFilters = !selectedBOMInstances.includes('all') || !selectedBOMs.includes('all') || !selectedVendors.includes('all') || !selectedTags.includes('all') || costRange[0] > 0 || costRange[1] < maxCostInData || selectedItemCode || chartSelectedItem || chartSelectedBOM || tableSearch.trim();

  // Clear all filters - also triggers global reset via parent
  const handleClearAllFilters = () => {
    setSelectedBOMInstances(['all']);
    setSelectedBOMs(['all']);
    setSelectedVendors(['all']);
    setSelectedTags(['all']);
    setCostRange([0, maxCostInData]);
    setSelectedItemCode(null);
    setChartSelectedItem(null);
    setChartSelectedBOM(null);
    setTableSearch('');
    // Also trigger parent's clearAllFilters to reset filters in other tabs
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

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

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply BOM Instance filter (primary filter when volume scenarios exist)
    if (!selectedBOMInstances.includes('all')) {
      result = result.filter(item =>
        selectedBOMInstances.includes(item.bom_instance_id)
      );
    }

    // Apply BOM path filter - supports hierarchy paths like "BOM-A > SUB-1" (fallback/secondary)
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom ||
          item.bom_path.startsWith(bom + ' > ') ||
          item.bom_code === bom
        )
      );
    }

    // Apply Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_id && selectedVendors.includes(item.vendor_id)
      );
    }

    // Apply Tags filter
    if (!selectedTags.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Apply Items filter
    if (!selectedItems.includes('all')) {
      result = result.filter(item =>
        selectedItems.includes(item.item_id)
      );
    }

    // Apply Cost Range filter
    result = result.filter(item =>
      item.total_amount >= costRange[0] && item.total_amount <= costRange[1]
    );

    // Apply single item filter (from clicking Highest Cost Item card)
    // Uses item_code so user can see same item from different vendors/BOMs
    if (selectedItemCode) {
      result = result.filter(item => item.item_code === selectedItemCode);
    }

    // Apply table search filter
    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(search) ||
        item.item_name.toLowerCase().includes(search) ||
        (item.vendor_name && item.vendor_name.toLowerCase().includes(search)) ||
        item.bom_path.toLowerCase().includes(search) ||
        item.bom_code.toLowerCase().includes(search) ||
        item.tags.some(tag => tag.toLowerCase().includes(search)) ||
        item.item_source.toLowerCase().includes(search)
      );
    }

    // Apply chart item selection filter
    if (chartSelectedItem) {
      result = result.filter(item => item.item_code === chartSelectedItem);
    }

    // Apply chart BOM selection filter
    if (chartSelectedBOM) {
      result = result.filter(item => item.bom_code === chartSelectedBOM);
    }

    // Sort based on selected column
    result.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof CostViewItem];
      let bVal: any = b[sortColumn as keyof CostViewItem];

      // Handle special cases
      if (sortColumn === 'tags') {
        aVal = a.tags.length > 0 ? a.tags[0] : '';
        bVal = b.tags.length > 0 ? b.tags[0] : '';
      }

      // Calculate percent_of_quote on the fly instead of using backend value
      if (sortColumn === 'percent_of_quote') {
        aVal = totalQuoteValue > 0 ? a.total_amount / totalQuoteValue : 0;
        bVal = totalQuoteValue > 0 ? b.total_amount / totalQuoteValue : 0;
      }

      // Handle null/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Number comparison
      const comparison = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, selectedBOMInstances, selectedBOMs, selectedVendors, selectedTags, selectedItems, costRange, selectedItemCode, tableSearch, chartSelectedItem, chartSelectedBOM, sortColumn, sortDirection, totalQuoteValue]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedBOMInstances, selectedBOMs, selectedVendors, selectedTags, costRange, selectedItemCode, tableSearch, chartSelectedItem, chartSelectedBOM, sortColumn, sortDirection, pageSize]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - default to descending for numbers, ascending for text
      setSortColumn(column);
      const textColumns = ['item_code', 'item_name', 'vendor_name', 'bom_path', 'bom_code', 'tags', 'item_source', 'unit'];
      setSortDirection(textColumns.includes(column) ? 'asc' : 'desc');
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return <span className="text-gray-400 ml-1 text-[10px]">sort</span>;
    }
    return sortDirection === 'asc'
      ? <span className="text-blue-600 ml-1 text-[10px] font-bold">ASC</span>
      : <span className="text-blue-600 ml-1 text-[10px] font-bold">DESC</span>;
  };

  // Calculate the highest cost item from ALL items (before single item filter)
  // This is used for the clickable card
  const highestCostItem = useMemo(() => {
    const sortedItems = [...items].sort((a, b) => b.total_amount - a.total_amount);
    return sortedItems.length > 0 ? sortedItems[0] : null;
  }, [items]);

  // Calculate insights from filtered data
  const insights = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + item.total_amount, 0);
    const totalAC = filteredItems.reduce((sum, item) => sum + item.total_additional_cost, 0);
    const avgCost = total / filteredItems.length || 0;
    const maxItem = filteredItems.length > 0 ? filteredItems[0] : null;

    return {
      total,
      totalAC,
      percent: (total / totalQuoteValue) * 100,
      avgCost,
      maxCost: highestCostItem?.total_amount || 0,
      maxItemCode: highestCostItem?.item_code || '-',
      count: filteredItems.length
    };
  }, [filteredItems, totalQuoteValue, highestCostItem]);

  // Chart data for cost distribution (top 6 items) - supports both total and base rate views
  const costDistributionData = useMemo(() => {
    // Sort by the selected view mode
    const sorted = [...filteredItems].sort((a, b) => {
      if (chartViewMode === 'base') {
        return b.base_rate - a.base_rate;
      }
      return b.total_amount - a.total_amount;
    });

    return sorted.slice(0, 6).map(item => ({
      name: item.item_code,
      cost: chartViewMode === 'base' ? item.base_rate : item.total_amount,
      baseRate: item.base_rate,
      totalAmount: item.total_amount,
      ac: item.total_additional_cost,
      percent: totalQuoteValue > 0 ? item.total_amount / totalQuoteValue : 0,
      quantity: item.quantity
    }));
  }, [filteredItems, chartViewMode, totalQuoteValue]);

  // BOM breakdown data - supports both total and base rate views
  const bomBreakdownData = useMemo(() => {
    const bomTotals = new Map<string, { total: number; base: number }>();
    filteredItems.forEach(item => {
      // Use the last segment of bom_path for grouping (the actual BOM the item belongs to)
      const bomPath = item.bom_path || item.bom_code || 'No BOM';
      const bomKey = bomPath.includes(' > ') ? bomPath.split(' > ').pop()! : bomPath;
      const current = bomTotals.get(bomKey) || { total: 0, base: 0 };
      bomTotals.set(bomKey, {
        total: current.total + item.total_amount,
        base: current.base + (item.base_rate * item.quantity)
      });
    });

    return Array.from(bomTotals.entries())
      .map(([bom, values]) => ({
        name: bom,
        value: chartViewMode === 'base' ? values.base : values.total,
        totalValue: values.total,
        baseValue: values.base
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredItems, chartViewMode]);

  // Calculate chart totals based on view mode
  const chartTotal = useMemo(() => {
    if (chartViewMode === 'base') {
      return filteredItems.reduce((sum, item) => sum + (item.base_rate * item.quantity), 0);
    }
    return insights.total;
  }, [filteredItems, chartViewMode, insights.total]);

  // Tags display helper - shows count with hover for all, clickable to navigate
  // isNearBottom: for last 4 rows, show dropdown above to prevent cutoff
  const renderTags = (tags: string[], isNearBottom: boolean = false) => {
    if (tags.length === 0) {
      return <span className="text-gray-500 text-sm">Uncategorized</span>;
    }

    if (tags.length === 1) {
      return (
        <button
          onClick={() => {
            if (setSelectedView) {
              setSelectedView('category');
              navigateToTab('items', { selectedCategory: tags[0] });
            }
          }}
          className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
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
            // Click on "X categories" redirects to Category View
            if (setSelectedView) {
              setSelectedView('category');
            }
          }}
          className="text-sm text-blue-700 hover:text-blue-900 hover:underline cursor-pointer font-medium"
        >
          {tags.length} categories
        </button>
        <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[150px] left-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="text-sm font-bold text-gray-700 mb-1 border-b pb-1">Categories ({tags.length}):</div>
          {tags.map((tag, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (setSelectedView) {
                  setSelectedView('category');
                  navigateToTab('items', { selectedCategory: tag });
                }
              }}
              className="block text-sm text-blue-700 hover:text-blue-900 hover:underline py-0.5 w-full text-left"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Additional costs display helper - show top 5 on hover, click for full view
  // isNearBottom: for last 4 rows, show dropdown above to prevent cutoff
  const renderAdditionalCosts = (item: CostViewItem, isNearBottom: boolean = false) => {
    if (item.additional_costs.length === 0) {
      return <span className="text-gray-700 text-sm">-</span>;
    }

    const maxToShow = 5;
    const costsToShow = item.additional_costs.slice(0, maxToShow);
    const remainingCount = item.additional_costs.length - maxToShow;

    return (
      <div className="relative group">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (setSelectedView) {
              setSelectedView('additional-costs');
              navigateToTab('items', { selectedItem: item.item_code });
            }
          }}
          className="font-mono text-sm text-orange-700 group-hover:text-orange-900 hover:underline font-semibold"
        >
          {currencySymbol}{item.total_additional_cost.toLocaleString()}
        </button>
        <div className={`absolute z-20 hidden group-hover:block bg-white border border-gray-300 rounded shadow-xl right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`} style={{ minWidth: '240px' }}>
          <div className="bg-gray-100 px-3 py-2 border-b border-gray-300 text-sm font-bold text-gray-800">
            Item Additional Costs ({item.additional_costs.length})
          </div>
          <table className="w-full text-sm">
            <tbody>
              {costsToShow.map((ac, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-800">{ac.cost_name}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{currencySymbol}{ac.total_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {remainingCount > 0 && (
            <div className="px-3 py-2 text-sm text-blue-600 border-b border-gray-200">
              +{remainingCount} more (click to view all)
            </div>
          )}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-300 flex justify-between text-sm font-bold">
            <span>Total</span>
            <span className="font-mono">{currencySymbol}{item.total_additional_cost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* Prominent Reset Filters Bar - Shows when any filter is active - STICKY */}
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
                Showing {filteredItems.length} of {items.length} items
                {getBOMInstanceFilterText(bomInstances, selectedBOMInstances)}
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedVendors.includes('all') && ` • Vendor: ${selectedVendors.map(vId => filters.vendor_list.find(v => v.vendor_id === vId)?.vendor_name || vId).join(', ')}`}
                {!selectedTags.includes('all') && ` • Category: ${selectedTags.join(', ')}`}
                {(costRange[0] > 0 || costRange[1] < maxCostInData) && ` • Cost: ${currencySymbol}${costRange[0].toLocaleString()} - ${currencySymbol}${costRange[1].toLocaleString()}`}
                {tableSearch && ` • Search: "${tableSearch}"`}
                {chartSelectedItem && ` • Chart Item: ${chartSelectedItem}`}
                {chartSelectedBOM && ` • Chart BOM: ${chartSelectedBOM}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleClearAllFilters}
              className="px-6 py-2.5 text-base font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {/* Key Insights */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Cost Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Amount</div>
            <div className="text-3xl font-bold text-blue-600">{currencySymbol}{insights.total.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">{insights.count} items</div>
          </CardContent>
        </Card>

        {/* Item AC Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Item Additional Costs</div>
            <div className="text-3xl font-bold text-orange-600">{currencySymbol}{insights.totalAC.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {insights.total > 0 ? ((insights.totalAC / insights.total) * 100).toFixed(1) : 0}% of total
            </div>
          </CardContent>
        </Card>

        {/* Max Cost Card - Clickable - Shows all instances of this item code across vendors/BOMs */}
        <Card
          className={`border-gray-200 cursor-pointer transition-all hover:shadow-md hover:border-green-400 ${selectedItemCode === highestCostItem?.item_code ? 'ring-2 ring-green-500 border-green-500' : ''}`}
          onClick={() => {
            if (selectedItemCode === highestCostItem?.item_code) {
              setSelectedItemCode(null); // Toggle off
            } else if (highestCostItem) {
              setSelectedItemCode(highestCostItem.item_code);
            }
          }}
        >
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">
              Highest Cost Item
              {selectedItemCode === highestCostItem?.item_code && <span className="ml-2 text-green-600 font-normal">(Click to clear)</span>}
            </div>
            <div className="text-3xl font-bold text-green-600">{currencySymbol}{insights.maxCost.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">{insights.maxItemCode}</div>
          </CardContent>
        </Card>

        {/* Item Count Card */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Items Shown</div>
            <div className="text-3xl font-bold text-purple-600">{insights.count}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">of {items.length} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts - Detailed with Data Labels */}
      <div className="space-y-3">
        {/* Chart Header with Filter Indicator */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Cost Analysis Charts</h3>
            {/* Filter indicator for charts */}
            {hasActiveFilters && (
              <p className="text-sm text-orange-600 font-medium mt-1">
                Charts showing filtered data ({filteredItems.length} of {items.length} items)
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedVendors.includes('all') && ` • Vendor: ${selectedVendors.map(vId => filters.vendor_list.find(v => v.vendor_id === vId)?.vendor_name || vId).join(', ')}`}
                {!selectedTags.includes('all') && ` • Category: ${selectedTags.join(', ')}`}
                {tableSearch && ` • Search: "${tableSearch}"`}
                {chartSelectedItem && ` • Item: ${chartSelectedItem}`}
                {chartSelectedBOM && ` • BOM: ${chartSelectedBOM}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setChartViewMode('total')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'total'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Total Amount
            </button>
            <button
              onClick={() => setChartViewMode('base')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'base'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Base Rate Only
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Top Items Bar Chart - with data labels */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">
                Top 6 {chartViewMode === 'base' ? 'Highest Base Rate' : 'Most Expensive'} Items
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                {chartViewMode === 'base'
                  ? 'Items with the highest per-unit base rate (before additional costs)'
                  : 'Highest cost items by total amount (Base × Qty + Additional Costs)'
                }
              </p>

              {/* Data Table instead of just chart */}
              <div className="space-y-2" key={`items-${chartSelectedItem || 'none'}`}>
                {costDistributionData.map((item, index) => {
                  const maxCost = costDistributionData[0]?.cost || 1;
                  const widthPercent = (item.cost / maxCost) * 100;
                  const percentOfChart = chartTotal > 0 ? (item.cost / chartTotal) * 100 : 0;
                  const isSelected = chartSelectedItem !== null && chartSelectedItem === item.name;
                  return (
                    <div
                      key={`${item.name}-${chartSelectedItem || 'none'}`}
                      className={`flex items-center gap-3 cursor-pointer rounded-lg p-1 -mx-1 transition-all ${
                        isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setChartSelectedItem(isSelected ? null : item.name)}
                      title={isSelected ? 'Click to clear filter' : 'Click to filter table by this item'}
                    >
                      <div className="w-6 text-sm font-bold text-gray-500">{index + 1}</div>
                      <div className={`w-24 text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`} title={item.name}>{item.name}</div>
                      <div className="flex-1 h-8 bg-gray-100 rounded relative">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: isSelected ? '#2563eb' : COLORS[index % COLORS.length]
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                          {currencySymbol}{item.cost.toLocaleString()}
                          {chartViewMode === 'base' && <span className="text-xs font-normal text-gray-500">/unit</span>}
                        </span>
                      </div>
                      <div className="w-16 text-right text-sm font-medium text-gray-600">
                        {chartViewMode === 'base' ? `×${item.quantity}` : `${percentOfChart.toFixed(1)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
              {chartSelectedItem && (
                <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-blue-600">
                  Filtering table by: <strong>{chartSelectedItem}</strong>
                  <button onClick={() => setChartSelectedItem(null)} className="ml-2 text-red-500 hover:text-red-700">[Clear]</button>
                </div>
              )}

              {costDistributionData.length === 0 && (
                <div className="text-center text-gray-500 py-8">No items to display</div>
              )}
            </CardContent>
          </Card>

          {/* BOM Cost Breakdown - Detailed with values */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">
                Cost Distribution by BOM {chartViewMode === 'base' ? '(Base Only)' : ''}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                {chartViewMode === 'base'
                  ? 'Sum of (Base Rate × Quantity) for each BOM - excludes additional costs'
                  : 'How each Bill of Materials contributes to the total quote value'
                }
              </p>

              {/* Data Table with visual bars */}
              <div className="space-y-2" key={`boms-${chartSelectedBOM || 'none'}`}>
                {bomBreakdownData.map((bom, index) => {
                  const maxVal = bomBreakdownData[0]?.value || 1;
                  const widthPercent = (bom.value / maxVal) * 100;
                  const percentOfTotal = chartTotal > 0 ? (bom.value / chartTotal) * 100 : 0;
                  const isSelected = chartSelectedBOM !== null && chartSelectedBOM === bom.name;
                  return (
                    <div
                      key={`${bom.name}-${chartSelectedBOM || 'none'}`}
                      className={`flex items-center gap-3 cursor-pointer rounded-lg p-1 -mx-1 transition-all ${
                        isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setChartSelectedBOM(isSelected ? null : bom.name)}
                      title={isSelected ? 'Click to clear filter' : 'Click to filter table by this BOM'}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: isSelected ? '#2563eb' : COLORS[index % COLORS.length] }}
                      />
                      <div className={`w-28 text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`} title={bom.name}>{bom.name}</div>
                      <div className="flex-1 h-7 bg-gray-100 rounded relative">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: isSelected ? '#2563eb' : COLORS[index % COLORS.length]
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-800">
                          {currencySymbol}{bom.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-16 text-right text-sm font-bold" style={{ color: isSelected ? '#2563eb' : COLORS[index % COLORS.length] }}>
                        {percentOfTotal.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total row */}
              {bomBreakdownData.length > 0 && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-300">
                  <div className="w-3" />
                  <div className="w-28 text-sm font-bold text-gray-900">TOTAL</div>
                  <div className="flex-1 text-right text-sm font-bold text-gray-900 pr-2">
                    {currencySymbol}{chartTotal.toLocaleString()}
                  </div>
                  <div className="w-16 text-right text-sm font-bold text-gray-900">100%</div>
                </div>
              )}
              {chartSelectedBOM && (
                <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-blue-600">
                  Filtering table by BOM: <strong>{chartSelectedBOM}</strong>
                  <button onClick={() => setChartSelectedBOM(null)} className="ml-2 text-red-500 hover:text-red-700">[Clear]</button>
                </div>
              )}

              {bomBreakdownData.length === 0 && (
                <div className="text-center text-gray-500 py-8">No BOM data to display</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Excel-like Table with Pagination */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          {/* Filter Bar - Clean Horizontal Layout */}
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-48 px-3 py-2 pl-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    x
                  </button>
                )}
              </div>

              <div className="h-6 w-px bg-gray-300" />

              {/* BOM Instance Filter - Shows when volume scenarios exist (shared component) */}
              <BOMInstanceFilter
                bomInstances={bomInstances}
                selectedInstances={selectedBOMInstances}
                onSelectionChange={setSelectedBOMInstances}
                hasVolumeScenarios={hasVolumeScenarios}
              />

              {/* BOM Hierarchy Filter - Always shown for sub-BOM filtering */}
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
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80">
                    {/* Search */}
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

                    {/* Select All */}
                    <div className="px-2 py-2 border-b border-gray-100">
                      <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBOMs.includes('all')}
                          onChange={() => setSelectedBOMs(['all'])}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-900">All BOMs</span>
                        <span className="text-xs text-gray-500 ml-auto">{rootBOMCount} root BOMs</span>
                      </label>
                    </div>

                    {/* BOM Tree */}
                    <div className="max-h-64 overflow-y-auto py-1">
                      {renderBOMTree(bomHierarchy)}
                    </div>

                    {/* Actions */}
                    <div className="p-2 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => setSelectedBOMs(['all'])}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
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
                    {/* Search */}
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

                    {/* Select All */}
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

                    {/* Vendor List */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredVendors.map(vendor => (
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

                    {/* Actions */}
                    <div className="p-2 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => setSelectedVendors(['all'])}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags Filter Dropdown */}
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
                    {/* Search */}
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

                    {/* Select All */}
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

                    {/* Tags List */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredTags.map(tag => (
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
                          <span className="text-sm text-gray-700 truncate">{tag}</span>
                        </label>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="p-2 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => setSelectedTags(['all'])}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Item Filter Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'items' ? null : 'items'); }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    !selectedItems.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Item</span>
                  <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                    {selectedItems.includes('all') ? 'All' : selectedItems.length}
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>

                {openDropdown === 'items' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Select All */}
                    <div className="px-2 py-2 border-b border-gray-100">
                      <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes('all')}
                          onChange={() => setSelectedItems(['all'])}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-900">All Items</span>
                      </label>
                    </div>

                    {/* Items List */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredItemsList.map(item => (
                        <label
                          key={item.item_id}
                          className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                            selectedItems.includes(item.item_id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.item_id)}
                            onChange={() => setSelectedItems(toggleSelection(selectedItems, item.item_id))}
                            className="rounded border-gray-300"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.item_code}</span>
                            <span className="text-xs text-gray-500 truncate">{item.item_name}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="p-2 border-t border-gray-200 flex justify-between">
                      <button
                        onClick={() => setSelectedItems(['all'])}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cost Range Filter Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'cost' ? null : 'cost'); }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    costRange[0] > 0 || costRange[1] < maxCostInData ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Cost Range</span>
                  <span className="text-gray-400">▼</span>
                </button>

                {openDropdown === 'cost' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-72 p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Range:</span>
                        <span className="font-medium text-blue-600">
                          {currencySymbol}{costRange[0].toLocaleString()} - {currencySymbol}{costRange[1].toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Minimum</label>
                          <input
                            type="range"
                            min="0"
                            max={maxCostInData}
                            step={Math.max(1, Math.floor(maxCostInData / 100))}
                            value={costRange[0]}
                            onChange={(e) => setCostRange([Number(e.target.value), costRange[1]])}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Maximum</label>
                          <input
                            type="range"
                            min="0"
                            max={maxCostInData}
                            step={Math.max(1, Math.floor(maxCostInData / 100))}
                            value={costRange[1]}
                            onChange={(e) => setCostRange([costRange[0], Number(e.target.value)])}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <button
                          onClick={() => setCostRange([0, maxCostInData])}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setOpenDropdown(null)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Done
                        </button>
                      </div>
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

              {/* Views (Column Visibility) Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'columns' ? null : 'columns'); }}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    visibleColumns.size < 12 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
                      <span className="text-sm font-medium text-gray-900">Show Columns</span>
                      <button
                        onClick={() => setVisibleColumns(new Set(columnDefs.map(c => c.key)))}
                        className="text-xs text-blue-600 hover:text-blue-800"
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
                    <div className="p-2 border-t border-gray-200">
                      <button
                        onClick={() => setOpenDropdown(null)}
                        className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Clear All Filters */}
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

                {/* BOM Instance Pills (shared component) */}
                <BOMInstanceFilterPills
                  bomInstances={bomInstances}
                  selectedInstances={selectedBOMInstances}
                  onSelectionChange={setSelectedBOMInstances}
                  hasVolumeScenarios={hasVolumeScenarios}
                />

                {/* BOM Hierarchy Pills */}
                {!selectedBOMs.includes('all') && selectedBOMs.map(bom => (
                  <span
                    key={`bom-${bom}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                  >
                    BOM: {bom.split(' > ').pop()}
                    <button
                      onClick={() => {
                        const newBOMs = selectedBOMs.filter(b => b !== bom);
                        setSelectedBOMs(newBOMs.length ? newBOMs : ['all']);
                      }}
                      className="hover:text-blue-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {!selectedVendors.includes('all') && selectedVendors.map(vendorId => {
                  const vendor = filters.vendor_list.find(v => v.vendor_id === vendorId);
                  return (
                    <span
                      key={vendorId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                    >
                      Vendor: {vendor?.vendor_name || vendorId}
                      <button
                        onClick={() => {
                          const newVendors = selectedVendors.filter(v => v !== vendorId);
                          setSelectedVendors(newVendors.length ? newVendors : ['all']);
                        }}
                        className="hover:text-green-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}

                {!selectedTags.includes('all') && selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                  >
                    Category: {tag}
                    <button
                      onClick={() => {
                        const newTags = selectedTags.filter(t => t !== tag);
                        setSelectedTags(newTags.length ? newTags : ['all']);
                      }}
                      className="hover:text-purple-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {(costRange[0] > 0 || costRange[1] < maxCostInData) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                    Cost: {currencySymbol}{costRange[0].toLocaleString()} - {currencySymbol}{costRange[1].toLocaleString()}
                    <button
                      onClick={() => setCostRange([0, maxCostInData])}
                      className="hover:text-orange-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                )}

                {selectedItemCode && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                    Item: {selectedItemCode}
                    <button
                      onClick={() => setSelectedItemCode(null)}
                      className="hover:text-yellow-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                )}

                {chartSelectedItem && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                    Chart Item: {chartSelectedItem}
                    <button
                      onClick={() => setChartSelectedItem(null)}
                      className="hover:text-indigo-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                )}

                {chartSelectedBOM && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs">
                    Chart BOM: {chartSelectedBOM}
                    <button
                      onClick={() => setChartSelectedBOM(null)}
                      className="hover:text-teal-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Table Header Row */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
            <h4 className="font-semibold text-gray-900 text-sm">
              Item Details
            </h4>
            <div className="text-xs text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm">#</th>
                  {visibleColumns.has('item_code') && (
                    <th
                      className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('item_code')}
                    >
                      Item Code {renderSortIndicator('item_code')}
                    </th>
                  )}
                  {visibleColumns.has('item_name') && (
                    <th
                      className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('item_name')}
                    >
                      Item Name {renderSortIndicator('item_name')}
                    </th>
                  )}
                  {visibleColumns.has('tags') && (
                    <th
                      className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('tags')}
                    >
                      Tags {renderSortIndicator('tags')}
                    </th>
                  )}
                  {visibleColumns.has('vendor_name') && (
                    <th
                      className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('vendor_name')}
                    >
                      Vendor {renderSortIndicator('vendor_name')}
                    </th>
                  )}
                  {visibleColumns.has('bom_path') && (
                    <th
                      className="px-3 py-3 text-left font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('bom_path')}
                    >
                      BOM {renderSortIndicator('bom_path')}
                    </th>
                  )}
                  {visibleColumns.has('item_source') && (
                    <th
                      className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('item_source')}
                    >
                      Source {renderSortIndicator('item_source')}
                    </th>
                  )}
                  {visibleColumns.has('quantity') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('quantity')}
                    >
                      Qty {renderSortIndicator('quantity')}
                    </th>
                  )}
                  {visibleColumns.has('base_rate') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('base_rate')}
                    >
                      Base Rate {renderSortIndicator('base_rate')}
                    </th>
                  )}
                  {visibleColumns.has('quoted_rate') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('quoted_rate')}
                    >
                      Quoted Rate {renderSortIndicator('quoted_rate')}
                    </th>
                  )}
                  {visibleColumns.has('total_additional_cost') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('total_additional_cost')}
                      title="Item Additional Costs (Total)"
                    >
                      Item AC {renderSortIndicator('total_additional_cost')}
                    </th>
                  )}
                  {visibleColumns.has('total_amount') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('total_amount')}
                    >
                      Total {renderSortIndicator('total_amount')}
                    </th>
                  )}
                  {visibleColumns.has('percent_of_quote') && (
                    <th
                      className="px-3 py-3 text-right font-bold text-gray-800 text-sm cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => handleSort('percent_of_quote')}
                    >
                      % Quote {renderSortIndicator('percent_of_quote')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedItems.map((item, idx) => (
                  <tr key={`${item.item_id}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-800 border-r border-gray-200 text-sm">
                      {((currentPage - 1) * pageSize) + idx + 1}
                    </td>
                    {visibleColumns.has('item_code') && (
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-900 border-r border-gray-200 font-medium">
                        {item.item_code}
                      </td>
                    )}
                    {visibleColumns.has('item_name') && (
                      <td className="px-3 py-2.5 text-gray-900 border-r border-gray-200 max-w-xs truncate text-sm" title={item.item_name}>
                        {item.item_name}
                      </td>
                    )}
                    {visibleColumns.has('tags') && (
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        {renderTags(item.tags, idx >= paginatedItems.length - 4)}
                      </td>
                    )}
                    {visibleColumns.has('vendor_name') && (
                      <td className="px-3 py-2.5 border-r border-gray-200 group cursor-pointer">
                        {item.vendor_name ? (
                          <button
                            onClick={() => {
                              if (setSelectedView) {
                                setSelectedView('vendor');
                                navigateToTab('items', { selectedVendor: item.vendor_name || undefined, selectedItem: item.item_code });
                              }
                            }}
                            className="text-sm text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                          >
                            {item.vendor_name}
                          </button>
                        ) : (
                          <span className="text-gray-700 text-sm">-</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.has('bom_path') && (
                      <td className="px-3 py-2.5 border-r border-gray-200 group cursor-pointer" title={`Path: ${item.bom_path}`}>
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                          className="font-mono text-sm text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                        >
                          {item.bom_path || item.bom_code}
                        </button>
                      </td>
                    )}
                    {visibleColumns.has('item_source') && (
                      <td className="px-3 py-2.5 text-center border-r border-gray-200">
                        <button
                          onClick={() => {
                            if (setSelectedView) {
                              setSelectedView('item-source');
                              navigateToTab('items', { selectedSource: item.item_source, selectedItem: item.item_code });
                            }
                          }}
                          className="inline-block px-2 py-1 rounded text-sm font-medium text-white transition-colors"
                          style={{ backgroundColor: SOURCE_COLORS[item.item_source] || '#6b7280' }}
                        >
                          {SOURCE_LABELS[item.item_source] || item.item_source}
                        </button>
                      </td>
                    )}
                    {visibleColumns.has('quantity') && (
                      <td className="px-3 py-2.5 text-right text-gray-900 border-r border-gray-200 text-sm">
                        {item.quantity} {item.unit}
                      </td>
                    )}
                    {visibleColumns.has('base_rate') && (
                      <td className="px-3 py-2.5 text-right border-r border-gray-200">
                        <span className="font-mono text-sm text-gray-900">
                          {currencySymbol}{item.base_rate.toLocaleString()}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has('quoted_rate') && (
                      <td className="px-3 py-2.5 text-right border-r border-gray-200 group cursor-pointer">
                        <button
                          onClick={() => {
                            if (setSelectedView) {
                              setSelectedView('rate');
                              navigateToTab('items', { selectedItem: item.item_code });
                            }
                          }}
                          className="font-mono text-sm text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                        >
                          {currencySymbol}{item.quoted_rate.toLocaleString()}
                        </button>
                      </td>
                    )}
                    {visibleColumns.has('total_additional_cost') && (
                      <td className="px-3 py-2.5 text-right border-r border-gray-200">
                        {renderAdditionalCosts(item, idx >= paginatedItems.length - 4)}
                      </td>
                    )}
                    {visibleColumns.has('total_amount') && (
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-sm">
                        {currencySymbol}{item.total_amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.has('percent_of_quote') && (
                      <td
                        className="px-3 py-2.5 text-right text-gray-900 text-sm font-medium cursor-help"
                        title={totalQuoteValue > 0 ? `${(item.total_amount / totalQuoteValue)}` : '0'}
                      >
                        {totalQuoteValue > 0 ? (item.total_amount / totalQuoteValue).toFixed(2) : '0.00'}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <div className="text-xs text-gray-800">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
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
