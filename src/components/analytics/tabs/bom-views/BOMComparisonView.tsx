import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { BOMCostComparison, TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { BOMViewType } from '../BOMTab';
import type { BOMDetailData, CostViewData } from '../../../../services/api';

interface BOMComparisonViewProps {
  bomCostComparison: BOMCostComparison[];
  bomDetailData?: BOMDetailData | null;
  costViewData?: CostViewData;
  totalQuoteValue: number;
  data: TopItemsAnalytics;
  navigationContext: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  setSelectedView: (view: BOMViewType) => void;
  currencySymbol?: string;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface BOMNode {
  path: string;
  code: string;
  name: string;
  level: number;
  items: any[];
  children: BOMNode[];
  totalCost: number;
  itemsSubtotal: number;
  bomAC: number;
  parentBomCode: string;
  bomQuantity: number;
  hierarchyPath?: string; // Full path like "QAB1 > QASB1 > QASSB1"
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Main BOM',
  1: 'Sub-BOM',
  2: 'Sub-Sub-BOM',
  3: 'L3-BOM',
  4: 'L4-BOM',
};

// Helper to get level label
const getLevelLabel = (level: number): string => {
  return LEVEL_LABELS[level] || `L${level} BOM`;
};

export default function BOMComparisonView({
  bomCostComparison,
  bomDetailData,
  costViewData,
  totalQuoteValue,
  data,
  navigationContext,
  navigateToTab,
  setSelectedView,
  currencySymbol = '₹',
  filterResetKey,
  onClearAllFilters
}: BOMComparisonViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]); // empty = all
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [chartViewMode, setChartViewMode] = useState<'cost' | 'ac'>('cost');
  const [sortColumn, setSortColumn] = useState<string>('hierarchy'); // Default: hierarchy order
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openDropdown, setOpenDropdown] = useState<'bom' | 'level' | 'category' | 'vendor' | 'columns' | null>(null);
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());
  const [bomSearch, setBomSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'bom_code', 'bom_name', 'hierarchy', 'items', 'bom_qty', 'items_subtotal', 'bom_ac', 'ac_impact', 'bom_total', 'percent_quote'
  ]));

  // Column definitions
  const columnDefs = [
    { key: 'bom_code', label: 'BOM Code', align: 'left' },
    { key: 'bom_name', label: 'BOM Name', align: 'left' },
    { key: 'hierarchy', label: 'BOM Hierarchy', align: 'left' },
    { key: 'items', label: 'Items', align: 'right' },
    { key: 'bom_qty', label: 'BOM Qty', align: 'right' },
    { key: 'items_subtotal', label: 'Items Subtotal', align: 'right' },
    { key: 'bom_ac', label: 'BOM AC', align: 'right' },
    { key: 'ac_impact', label: 'AC % of BOM', align: 'right' },
    { key: 'bom_total', label: 'BOM Total', align: 'right' },
    { key: 'percent_quote', label: '% of Quote', align: 'right' },
  ];

  // Auto-select BOM from navigation context
  useEffect(() => {
    if (navigationContext?.selectedBOM) {
      const bomCode = navigationContext.selectedBOM.split('.')[0];
      setSelectedBOMs([bomCode]);
    }
  }, [navigationContext]);

  // Reset ALL local filters when filterResetKey changes (triggered by parent clearAllFilters)
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMs(['all']);
      setSelectedLevels([]);
      setSelectedCategories(['all']);
      setSelectedVendors(['all']);
      setSearchQuery('');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBOMs, selectedLevels, selectedCategories, selectedVendors, searchQuery]);

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

  // Toggle level selection
  const toggleLevel = (level: number) => {
    setSelectedLevels(prev => {
      if (prev.includes(level)) {
        return prev.filter(l => l !== level);
      } else {
        return [...prev, level];
      }
    });
  };

  // Check if we have real API data
  const hasRealData = bomDetailData && bomDetailData.bom_instances && bomDetailData.bom_instances.length > 0;

  // Calculate items subtotal per BOM path from Cost View API
  // Cost View items have bom_path like "QAB1" or "QAB1 > QASB1"
  const itemsSubtotalByBomPath = useMemo(() => {
    const subtotals = new Map<string, { total: number; count: number; items: any[] }>();

    if (costViewData?.items) {
      costViewData.items.forEach(item => {
        const bomPath = item.bom_path || '';
        if (!subtotals.has(bomPath)) {
          subtotals.set(bomPath, { total: 0, count: 0, items: [] });
        }
        const entry = subtotals.get(bomPath)!;
        entry.total += item.total_amount;
        entry.count += 1;
        entry.items.push(item);
      });
    }

    return subtotals;
  }, [costViewData]);

  // Build BOM nodes by combining:
  // 1. BOM Detail API: hierarchy structure, bom_level, parent_bom_code, BOM AC (recurring costs)
  // 2. Cost View API: items subtotal per BOM
  const bomTree = useMemo(() => {
    if (!hasRealData) return [];

    const allNodes: BOMNode[] = [];
    const nodeMap = new Map<string, BOMNode>();

    bomDetailData!.bom_instances.forEach((instance) => {
      const instanceLabel = bomDetailData!.bom_instances.length > 1
        ? ` (#${instance.instance_index})`
        : '';

      // First pass: create all nodes
      instance.hierarchy.forEach(bomLevel => {
        const displayCode = bomLevel.bom_level === 0
          ? `${bomLevel.bom_code}${instanceLabel}`
          : bomLevel.bom_code;

        // Get items data from Cost View API for this BOM path
        const itemsData = itemsSubtotalByBomPath.get(bomLevel.bom_path) || { total: 0, count: 0, items: [] };

        // Use correct API fields:
        // - Items Subtotal = total_item_cost (sum of item costs in this BOM)
        // - BOM AC = total_bom_ac_quoted (ONLY BOM-level additional costs, NOT including items)
        // - BOM Total = total_quoted_amount (items + BOM AC)
        const itemsSubtotal = bomLevel.total_item_cost;
        const bomAC = bomLevel.total_bom_ac_quoted;
        const totalCost = bomLevel.total_quoted_amount;

        const node: BOMNode = {
          path: bomLevel.bom_path,
          code: displayCode,
          name: bomLevel.bom_name,
          level: bomLevel.bom_level,
          items: itemsData.items,
          children: [],
          totalCost: totalCost,
          itemsSubtotal: itemsSubtotal,
          bomAC: bomAC,
          parentBomCode: bomLevel.parent_bom_code || '',
          bomQuantity: bomLevel.bom_quantity,
          hierarchyPath: bomLevel.bom_path
        };

        allNodes.push(node);
        nodeMap.set(bomLevel.bom_code, node);
      });
    });

    // Second pass: build parent-child relationships using parent_bom_code
    allNodes.forEach(node => {
      if (node.parentBomCode) {
        const parent = nodeMap.get(node.parentBomCode);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    // Return only main BOMs (level 0) - their children are already attached
    return allNodes.filter(n => n.level === 0);
  }, [bomDetailData, hasRealData, itemsSubtotalByBomPath]);

  // Flatten all BOM nodes for filtering/display - DEPTH-FIRST to preserve hierarchy
  // This ensures: QAB1 → QASB1 → QASSB1 → QASB2 (not QAB1 → QASB1 → QASB2 → QASSB1)
  const allBOMNodes = useMemo(() => {
    const nodes: BOMNode[] = [];

    // Depth-first traversal: parent, then all its children recursively
    const collectNodes = (node: BOMNode) => {
      // Use the API's hierarchyPath directly (e.g., "QAB1 > QASB1 > QASSB1")
      nodes.push(node);

      // Sort children by code before recursing (for consistent ordering)
      const sortedChildren = [...node.children].sort((a, b) => a.code.localeCompare(b.code));
      sortedChildren.forEach(child => collectNodes(child));
    };

    // Sort main BOMs (level 0) first, then traverse depth-first
    const sortedTree = [...bomTree].sort((a, b) => a.code.localeCompare(b.code));
    sortedTree.forEach(node => collectNodes(node));

    return nodes;
  }, [bomTree]);

  // Get available levels
  const availableLevels = useMemo(() => {
    const levels = new Set<number>();
    allBOMNodes.forEach(node => levels.add(node.level));
    return Array.from(levels).sort();
  }, [allBOMNodes]);

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

  // Calculate item count per BOM path
  const bomItemCounts = useMemo(() => {
    const counts = new Map<string, number>();

    const countItems = (node: BOMNode): number => {
      const directCount = node.items.length;
      const childrenCount = node.children.reduce((sum, child) => sum + countItems(child), 0);
      const totalCount = directCount + childrenCount;
      counts.set(node.path, totalCount);
      return totalCount;
    };

    bomTree.forEach(countItems);
    return counts;
  }, [bomTree]);

  // Filter BOM nodes
  const filteredNodes = useMemo(() => {
    let nodes = [...allBOMNodes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(node =>
        node.code.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query)
      );
    }

    // BOM filter
    if (!selectedBOMs.includes('all')) {
      nodes = nodes.filter(node =>
        selectedBOMs.includes(node.code) || selectedBOMs.includes(node.parentBomCode)
      );
    }

    // Level filter
    if (selectedLevels.length > 0) {
      nodes = nodes.filter(node => selectedLevels.includes(node.level));
    }

    // Category filter - filter BOMs that contain items from selected categories
    if (!selectedCategories.includes('all')) {
      nodes = nodes.filter(node => {
        const nodeItems = node.items;
        return nodeItems.some((item: any) => selectedCategories.includes(item.category));
      });
    }

    // Vendor filter - filter BOMs that contain items from selected vendors
    if (!selectedVendors.includes('all')) {
      nodes = nodes.filter(node => {
        const nodeItems = node.items;
        return nodeItems.some((item: any) => selectedVendors.includes(item.vendor));
      });
    }

    return nodes;
  }, [allBOMNodes, searchQuery, selectedBOMs, selectedLevels, selectedCategories, selectedVendors]);

  // Sort filtered nodes
  const sortedNodes = useMemo(() => {
    const result = [...filteredNodes];

    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'hierarchy':
          // Tree order is already preserved from depth-first traversal
          // Just compare by index in original array to maintain order
          const aIdx = allBOMNodes.findIndex(n => n.path === a.path);
          const bIdx = allBOMNodes.findIndex(n => n.path === b.path);
          return sortDirection === 'asc' ? aIdx - bIdx : bIdx - aIdx;
        case 'bom_code':
        case 'code':
          aVal = a.code;
          bVal = b.code;
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'bom_name':
        case 'name':
          aVal = a.name;
          bVal = b.name;
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'level':
          aVal = a.level;
          bVal = b.level;
          break;
        case 'items':
          aVal = bomItemCounts.get(a.path) || 0;
          bVal = bomItemCounts.get(b.path) || 0;
          break;
        case 'bom_qty':
          aVal = a.bomQuantity;
          bVal = b.bomQuantity;
          break;
        case 'items_subtotal':
          aVal = a.itemsSubtotal;
          bVal = b.itemsSubtotal;
          break;
        case 'bom_ac':
          aVal = a.bomAC;
          bVal = b.bomAC;
          break;
        case 'ac_impact':
          aVal = a.totalCost > 0 ? (a.bomAC / a.totalCost) * 100 : 0;
          bVal = b.totalCost > 0 ? (b.bomAC / b.totalCost) * 100 : 0;
          break;
        case 'bom_total':
        case 'totalCost':
          aVal = a.totalCost;
          bVal = b.totalCost;
          break;
        case 'percent_quote':
          aVal = (a.totalCost / totalQuoteValue) * 100;
          bVal = (b.totalCost / totalQuoteValue) * 100;
          break;
        default:
          // Default to hierarchy order
          if (a.level !== b.level) {
            return a.level - b.level;
          }
          return a.path.localeCompare(b.path);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [filteredNodes, sortColumn, sortDirection, bomItemCounts, totalQuoteValue]);

  // Pagination
  const totalPages = Math.ceil(sortedNodes.length / pageSize);
  const paginatedNodes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedNodes.slice(start, start + pageSize);
  }, [sortedNodes, currentPage, pageSize]);

  // Key insights
  const insights = useMemo(() => {
    const totalBOMCost = filteredNodes.reduce((sum, node) => sum + node.totalCost, 0);
    const totalItemsCost = filteredNodes.reduce((sum, node) => sum + node.itemsSubtotal, 0);
    const totalBOMAC = filteredNodes.reduce((sum, node) => sum + node.bomAC, 0);

    // Count by level
    const mainBOMs = filteredNodes.filter(n => n.level === 0).length;
    const subBOMs = filteredNodes.filter(n => n.level === 1).length;
    const subSubBOMs = filteredNodes.filter(n => n.level >= 2).length;

    return {
      totalBOMCost,
      totalItemsCost,
      totalBOMAC,
      bomCount: filteredNodes.length,
      mainBOMs,
      subBOMs,
      subSubBOMs
    };
  }, [filteredNodes]);

  // Chart data - show BOMs in hierarchy order (depth-first), NOT by cost
  // So: QAB1 (Main), QASB1 (Sub), QASSB1 (Sub-Sub under QASB1), QASB2 (Sub)
  const chartData = useMemo(() => {
    // Use the already-sorted allBOMNodes which is in depth-first hierarchy order
    // Filter to only include nodes that pass the current filters
    const inHierarchyOrder = allBOMNodes.filter(node =>
      filteredNodes.some(fn => fn.path === node.path)
    );

    return inHierarchyOrder.slice(0, 10).map((node, index) => ({
      ...node,
      itemCount: bomItemCounts.get(node.path) || 0,
      acPercentOfBOM: node.totalCost > 0 ? (node.bomAC / node.totalCost) * 100 : 0,
      color: COLORS[index % COLORS.length]
    }));
  }, [allBOMNodes, filteredNodes, bomItemCounts]);

  // Check if filters are active
  const hasActiveFilters = !selectedBOMs.includes('all') || selectedLevels.length > 0 ||
    !selectedCategories.includes('all') || !selectedVendors.includes('all') || searchQuery.trim() !== '';

  // Clear all filters - also triggers global reset via parent
  const handleClearAllFilters = () => {
    setSelectedBOMs(['all']);
    setSelectedLevels([]);
    setSelectedCategories(['all']);
    setSelectedVendors(['all']);
    setSearchQuery('');
    setCurrentPage(1);
    // Also trigger parent's clearAllFilters to reset filters in other tabs
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

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

  // Toggle BOM expansion
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

  // Filtered lists for dropdowns
  const filteredBOMList = useMemo(() => {
    const uniqueCodes = [...new Set(bomTree.map(b => b.code))];
    if (!bomSearch.trim()) return uniqueCodes;
    return uniqueCodes.filter(code => code.toLowerCase().includes(bomSearch.toLowerCase()));
  }, [bomTree, bomSearch]);

  const filteredCategoryList = useMemo(() => {
    if (!categorySearch.trim()) return availableCategories;
    return availableCategories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [availableCategories, categorySearch]);

  const filteredVendorList = useMemo(() => {
    if (!vendorSearch.trim()) return availableVendors;
    return availableVendors.filter(v => v.toLowerCase().includes(vendorSearch.toLowerCase()));
  }, [availableVendors, vendorSearch]);

  // Show error if no API data
  if (!hasRealData) {
    return (
      <div className="space-y-4">
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-red-800 mb-2">BOM Detail API Error</h3>
              <p className="text-red-600 mb-4">
                Unable to load BOM hierarchy data from the backend.
              </p>
              <div className="bg-white border border-red-200 rounded-lg p-4 text-left max-w-md mx-auto">
                <p className="text-sm font-bold text-gray-700 mb-2">Please check:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Backend server is running</li>
                  <li>• BOM Detail API endpoint is deployed: <code className="bg-gray-100 px-1 rounded">/quotes/{'{id}'}/analytics/bom-detail/</code></li>
                  <li>• Authentication token is valid</li>
                  <li>• Quote has BOM data configured</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Check browser console for detailed error message.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                Showing {filteredNodes.length} of {allBOMNodes.length} rows ({insights.mainBOMs} Main + {insights.subBOMs} Sub + {insights.subSubBOMs} Sub-Sub)
                {selectedLevels.length > 0 && ` | Level: ${selectedLevels.map(l => LEVEL_LABELS[l] || `L${l}`).join(', ')}`}
                {!selectedBOMs.includes('all') && ` | ${selectedBOMs.length} BOM(s)`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearAllFilters}
            className="px-6 py-2.5 text-base font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-md"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Key Metrics Cards - 4 cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total BOM Cost</div>
            <div className="text-3xl font-bold text-blue-600">{currencySymbol}{insights.totalBOMCost.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-2">
              Items: {currencySymbol}{insights.totalItemsCost.toLocaleString()} + AC: {currencySymbol}{insights.totalBOMAC.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total BOM AC</div>
            <div className="text-3xl font-bold text-orange-600">{currencySymbol}{insights.totalBOMAC.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-2">
              {((insights.totalBOMAC / (insights.totalBOMCost || 1)) * 100).toFixed(1)}% of total cost
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">
              BOM AC Share
              <span className="ml-1 text-gray-400 cursor-help text-xs" title="What % of total quote value is BOM additional costs">ⓘ</span>
            </div>
            <div className={`text-3xl font-bold ${(insights.totalBOMAC / totalQuoteValue * 100) > 20 ? 'text-red-600' : (insights.totalBOMAC / totalQuoteValue * 100) > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
              {((insights.totalBOMAC / totalQuoteValue) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-2">
              of total quote value ({currencySymbol}{totalQuoteValue.toLocaleString()})
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">BOM Structure</div>
            <div className="text-3xl font-bold text-purple-600">{insights.mainBOMs}</div>
            <div className="text-sm font-medium text-gray-700 mt-1">
              Main BOM{insights.mainBOMs !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-gray-500">
              + {insights.subBOMs} Sub-BOM{insights.subBOMs !== 1 ? 's' : ''} + {insights.subSubBOMs} Sub-Sub-BOM{insights.subSubBOMs !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">BOM Cost Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Top BOMs by cost or additional costs
            </p>
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
              By Total Cost
            </button>
            <button
              onClick={() => setChartViewMode('ac')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'ac'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By BOM AC
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Chart - Top BOMs */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">
                Top 10 BOMs {chartViewMode === 'cost' ? 'by Total Cost' : 'by Additional Costs'}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Click any BOM to filter the table below
              </p>

              <div className="space-y-2">
                {chartData.map((node, index) => {
                  const maxVal = chartData[0] ? (chartViewMode === 'cost' ? chartData[0].totalCost : chartData[0].bomAC) : 1;
                  const currentVal = chartViewMode === 'cost' ? node.totalCost : node.bomAC;
                  const widthPercent = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;
                  const isSelected = selectedBOMs.includes(node.code);

                  return (
                    <div
                      key={node.path}
                      className={`cursor-pointer rounded-lg p-2 -mx-2 transition-all ${
                        isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => navigateToTab('items', { selectedBOM: node.path })}
                      title={`Click to view ${node.items.length} items in ${node.name}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 text-xs font-bold text-gray-400">{index + 1}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          node.level === 0 ? 'bg-blue-100 text-blue-700' :
                          node.level === 1 ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {LEVEL_LABELS[node.level] || `L${node.level}-BOM`}
                        </span>
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate" title={node.name}>
                          {node.code}
                        </span>
                        <span className="text-sm font-bold text-gray-700">
                          {currencySymbol}{currentVal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5" />
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${Math.min(widthPercent, 100)}%`,
                              backgroundColor: chartViewMode === 'cost' ? node.color : '#f97316'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {chartData.length === 0 && (
                <div className="text-center text-gray-500 py-8">No data to display</div>
              )}
            </CardContent>
          </Card>

          {/* Right Chart - BOM Level Distribution */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">BOM Level Distribution</h4>
              <p className="text-sm text-gray-600 mb-4">
                Click level to filter, costs aggregated by BOM level
              </p>

              {/* Level breakdown */}
              <div className="space-y-4">
                {availableLevels.map((level, index) => {
                  const levelNodes = filteredNodes.filter(n => n.level === level);
                  const levelCost = levelNodes.reduce((sum, n) => sum + n.totalCost, 0);
                  const levelAC = levelNodes.reduce((sum, n) => sum + n.bomAC, 0);
                  const maxCost = Math.max(...availableLevels.map(l =>
                    filteredNodes.filter(n => n.level === l).reduce((sum, n) => sum + n.totalCost, 0)
                  ));
                  const widthPercent = maxCost > 0 ? (levelCost / maxCost) * 100 : 0;
                  const isSelected = selectedLevels.includes(level);

                  return (
                    <div
                      key={level}
                      className={`cursor-pointer rounded-lg p-3 transition-all ${
                        isSelected ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleLevel(level)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm px-2 py-1 rounded font-bold ${
                            level === 0 ? 'bg-blue-100 text-blue-700' :
                            level === 1 ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {LEVEL_LABELS[level] || `L${level}-BOM`}
                          </span>
                          <span className="text-sm text-gray-600">{levelNodes.length} BOM{levelNodes.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{currencySymbol}{levelCost.toLocaleString()}</div>
                          <div className="text-xs text-orange-600">AC: {currencySymbol}{levelAC.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="h-4 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-xs text-blue-600">Items Subtotal</div>
                    <div className="text-sm font-bold text-blue-700">{currencySymbol}{insights.totalItemsCost.toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-orange-600">Total AC</div>
                    <div className="text-sm font-bold text-orange-700">{currencySymbol}{insights.totalBOMAC.toLocaleString()}</div>
                  </div>
                </div>
              </div>
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
                placeholder="Search BOMs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* BOM Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'bom' ? null : 'bom'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
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
                      <span className="text-sm font-medium text-gray-900">All BOMs ({filteredBOMList.length})</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredBOMList.map(code => (
                      <label
                        key={code}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedBOMs.includes(code) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBOMs.includes(code)}
                          onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, code))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{code}</span>
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

            {/* Level Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'level' ? null : 'level'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  selectedLevels.length > 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Level</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedLevels.length === 0 ? 'All' : selectedLevels.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'level' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLevels.length === 0}
                        onChange={() => setSelectedLevels([])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All Levels</span>
                    </label>
                    {availableLevels.map(level => (
                      <label
                        key={level}
                        className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer ${
                          selectedLevels.includes(level) ? 'bg-green-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLevels.includes(level)}
                          onChange={() => toggleLevel(level)}
                          className="rounded border-gray-300"
                        />
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          level === 0 ? 'bg-blue-100 text-blue-700' :
                          level === 1 ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {LEVEL_LABELS[level] || `L${level}-BOM`}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-200">
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'category' ? null : 'category'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedCategories.includes('all') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>Category</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedCategories.includes('all') ? 'All' : selectedCategories.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'category' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-64">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="px-2 py-2 border-b border-gray-100">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes('all')}
                        onChange={() => setSelectedCategories(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All Categories</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredCategoryList.map(cat => (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedCategories.includes(cat) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => setSelectedCategories(toggleSelection(selectedCategories, cat))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 truncate">{cat}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedCategories(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Vendor Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'vendor' ? null : 'vendor'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedVendors.includes('all') ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
                        key={vendor}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedVendors.includes(vendor) ? 'bg-orange-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(vendor)}
                          onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 truncate">{vendor}</span>
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
                    {columnDefs.map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer">
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
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear All */}
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

              {!selectedBOMs.includes('all') && selectedBOMs.map(code => (
                <span key={code} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  BOM: {code}
                  <button onClick={() => {
                    const newBOMs = selectedBOMs.filter(b => b !== code);
                    setSelectedBOMs(newBOMs.length ? newBOMs : ['all']);
                  }} className="hover:text-blue-900">×</button>
                </span>
              ))}

              {selectedLevels.map(level => (
                <span key={level} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  {LEVEL_LABELS[level] || `Level ${level}`}
                  <button onClick={() => toggleLevel(level)} className="hover:text-green-900">×</button>
                </span>
              ))}

              {!selectedCategories.includes('all') && selectedCategories.map(cat => (
                <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Category: {cat}
                  <button onClick={() => {
                    const newCats = selectedCategories.filter(c => c !== cat);
                    setSelectedCategories(newCats.length ? newCats : ['all']);
                  }} className="hover:text-purple-900">×</button>
                </span>
              ))}

              {!selectedVendors.includes('all') && selectedVendors.map(vendor => (
                <span key={vendor} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                  Vendor: {vendor}
                  <button onClick={() => {
                    const newVendors = selectedVendors.filter(v => v !== vendor);
                    setSelectedVendors(newVendors.length ? newVendors : ['all']);
                  }} className="hover:text-orange-900">×</button>
                </span>
              ))}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-gray-900">×</button>
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
              BOM Comparison Table
              <span className="font-normal text-gray-500 ml-2">Sorted by hierarchy (Main → Sub → Sub-Sub)</span>
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-center font-bold text-gray-700 border-r border-gray-300 text-sm w-8">#</th>
                  {columnDefs.filter(col => visibleColumns.has(col.key)).map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 font-bold text-gray-700 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
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
                {paginatedNodes.map((node, idx) => {
                  const isExpanded = expandedBOMs.has(node.path);
                  const hasChildren = node.children.length > 0;
                  const itemCount = bomItemCounts.get(node.path) || 0;
                  // AC % of BOM = what % of BOM total cost is additional costs
                  const acPercentOfBOM = node.totalCost > 0 ? (node.bomAC / node.totalCost) * 100 : 0;
                  const indent = node.level * 20;

                  return (
                    <tr
                      key={node.path}
                      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors cursor-pointer ${
                        node.level > 0 ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => navigateToTab('items', { selectedBOM: node.path })}
                      title={`Click to view ${itemCount} items in ${node.name}`}
                    >
                      <td className="px-3 py-2.5 border-r border-gray-200 text-center text-gray-400 text-xs">
                        {idx + 1 + (currentPage - 1) * pageSize}
                      </td>

                      {visibleColumns.has('bom_code') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <span className="font-mono font-medium text-gray-900 text-sm">
                            {node.code}
                          </span>
                        </td>
                      )}

                      {visibleColumns.has('bom_name') && (
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200 text-sm max-w-[200px] truncate" title={node.name}>
                          {node.name}
                          {hasChildren && (() => {
                            // Count children by their level relative to parent
                            const countByType = (children: BOMNode[]): { sub: number; subSub: number } => {
                              let sub = 0, subSub = 0;
                              const countRecursive = (nodes: BOMNode[], depth: number) => {
                                nodes.forEach(n => {
                                  if (depth === 1) sub++;
                                  else subSub++;
                                  countRecursive(n.children, depth + 1);
                                });
                              };
                              countRecursive(children, 1);
                              return { sub, subSub };
                            };
                            const counts = countByType(node.children);
                            const parts = [];
                            if (counts.sub > 0) parts.push(`${counts.sub} sub`);
                            if (counts.subSub > 0) parts.push(`${counts.subSub} sub-sub`);
                            return <span className="text-gray-500 ml-1 text-xs">({parts.join(', ')})</span>;
                          })()}
                        </td>
                      )}

                      {visibleColumns.has('hierarchy') && (
                        <td className="px-3 py-2.5 border-r border-gray-200 text-sm">
                          <span className="text-gray-600 font-mono">
                            {node.hierarchyPath || node.code}
                          </span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                            node.level === 0 ? 'bg-blue-100 text-blue-700' :
                            node.level === 1 ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {getLevelLabel(node.level)}
                          </span>
                        </td>
                      )}

                      {visibleColumns.has('items') && (
                        <td className="px-3 py-2.5 text-right border-r border-gray-200 text-sm">
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
                      )}

                      {visibleColumns.has('bom_qty') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 border-r border-gray-200 text-sm">
                          {node.bomQuantity.toLocaleString()}
                        </td>
                      )}

                      {visibleColumns.has('items_subtotal') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-900 border-r border-gray-200 text-sm">
                          {currencySymbol}{node.itemsSubtotal.toLocaleString()}
                        </td>
                      )}

                      {visibleColumns.has('bom_ac') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-900 border-r border-gray-200 text-sm">
                          {node.bomAC > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedView('additional-costs');
                                navigateToTab('bom', { selectedBOM: node.parentBomCode });
                              }}
                              className="hover:underline font-semibold text-orange-600"
                            >
                              {currencySymbol}{node.bomAC.toLocaleString()}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.has('ac_impact') && (
                        <td className="px-3 py-2.5 text-right border-r border-gray-200 text-sm">
                          {acPercentOfBOM > 0 ? (
                            <span className={`font-semibold ${
                              acPercentOfBOM > 30 ? 'text-red-600' : acPercentOfBOM > 15 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {acPercentOfBOM.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.has('bom_total') && (
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-sm">
                          {currencySymbol}{node.totalCost.toLocaleString()}
                        </td>
                      )}

                      {visibleColumns.has('percent_quote') && (
                        <td className="px-3 py-2.5 text-right text-gray-600 text-sm font-semibold">
                          {((node.totalCost / totalQuoteValue) * 100).toFixed(1)}%
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-400">
                <tr>
                  <td className="px-3 py-2 border-r border-gray-300"></td>
                  <td colSpan={visibleColumns.has('bom_name') ? 2 : 1} className="px-3 py-2 font-bold text-gray-900 text-sm border-r border-gray-300">
                    TOTAL ({insights.mainBOMs} Main + {insights.subBOMs} Sub + {insights.subSubBOMs} Sub-Sub)
                  </td>
                  {visibleColumns.has('hierarchy') && <td className="px-3 py-2 border-r border-gray-300"></td>}
                  {visibleColumns.has('items') && <td className="px-3 py-2 border-r border-gray-300"></td>}
                  {visibleColumns.has('bom_qty') && <td className="px-3 py-2 border-r border-gray-300"></td>}
                  {visibleColumns.has('items_subtotal') && (
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-sm">
                      {currencySymbol}{insights.totalItemsCost.toLocaleString()}
                    </td>
                  )}
                  {visibleColumns.has('bom_ac') && (
                    <td className="px-3 py-2 text-right font-mono font-bold text-orange-600 border-r border-gray-300 text-sm">
                      {currencySymbol}{insights.totalBOMAC.toLocaleString()}
                    </td>
                  )}
                  {visibleColumns.has('ac_impact') && (
                    <td className="px-3 py-2 text-right font-bold text-gray-900 border-r border-gray-300 text-sm">
                      {insights.totalBOMCost > 0 ? ((insights.totalBOMAC / insights.totalBOMCost) * 100).toFixed(1) : 0}%
                    </td>
                  )}
                  {visibleColumns.has('bom_total') && (
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-sm">
                      {currencySymbol}{insights.totalBOMCost.toLocaleString()}
                    </td>
                  )}
                  {visibleColumns.has('percent_quote') && (
                    <td className="px-3 py-2 text-right font-bold text-gray-900 text-sm">
                      {((insights.totalBOMCost / totalQuoteValue) * 100).toFixed(1)}%
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Showing {paginatedNodes.length} of {sortedNodes.length} rows
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  ««
                </button>
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
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-2 py-1 rounded text-sm ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  »»
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}