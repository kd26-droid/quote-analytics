import { useState, useMemo, useEffect } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import type { TopItemsAnalytics, VendorRateDeviation } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData } from '../../../../services/api';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';
import BOMInstanceFilter, { BOMInstanceFilterPills, getBOMInstanceFilterText } from '../../shared/BOMInstanceFilter';

interface RateViewProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol?: string;
  totalQuoteValue: number;
  vendorRateDeviation: VendorRateDeviation;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

// Currency code to symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'INR': '₹',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CNY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'CHF',
  'SGD': 'S$',
  'AED': 'AED',
  'SAR': 'SAR',
};

const getCurrencySymbol = (code: string | null | undefined): string => {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code + ' ';
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RateView({ costViewData, currencySymbol = '₹', totalQuoteValue, navigateToTab, navigationContext, filterResetKey, onClearAllFilters }: RateViewProps) {
  // Core state
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBOMInstances, setSelectedBOMInstances] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);

  // UI state
  const [chartViewMode, setChartViewMode] = useState<'markup' | 'rates'>('rates');
  const [sortColumn, setSortColumn] = useState<string>('item_total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [openDropdown, setOpenDropdown] = useState<'bom' | 'vendor' | 'category' | 'columns' | null>(null);
  const [bomSearch, setBomSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_code', 'item_name', 'vendor_name', 'quantity', 'vendor_rate', 'base_rate', 'markup', 'ac_per_unit', 'quoted_rate', 'item_total', 'percent_of_quote'
  ]));

  // Column definitions with renamed labels
  const columnDefs = [
    { key: 'item_code', label: 'Item Code', align: 'left' },
    { key: 'item_name', label: 'Item Name', align: 'left' },
    { key: 'vendor_name', label: 'Vendor', align: 'left' },
    { key: 'bom_path', label: 'BOM', align: 'left' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'vendor_rate', label: 'Vendor Base Rate', align: 'right' },
    { key: 'base_rate', label: 'Buyer Base Rate', align: 'right' },
    { key: 'markup', label: 'Markup %', align: 'center' },
    { key: 'ac_per_unit', label: 'AC/Unit', align: 'right' },
    { key: 'quoted_rate', label: 'Landed Rate', align: 'right' },
    { key: 'item_total', label: 'Total', align: 'right' },
    { key: 'percent_of_quote', label: '% Quote', align: 'right' },
  ];

  // Get items from costViewData
  const items = costViewData?.items || [];
  const filters = costViewData?.filters;

  // Use shared BOM instances hook for volume scenario detection
  const { bomInstances, hasVolumeScenarios, filterByInstance } = useBOMInstances(items);

  // Auto-select from navigation context
  useEffect(() => {
    if (navigationContext?.selectedItem) {
      setSearchQuery(navigationContext.selectedItem);
    }
  }, [navigationContext]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBOMInstances, selectedBOMs, selectedVendors, selectedCategories, selectedItem]);

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

  // Build BOM hierarchy tree for filter dropdown
  interface BOMNode {
    code: string;
    fullPath: string;
    children: BOMNode[];
  }

  const bomHierarchy = useMemo(() => {
    const roots: BOMNode[] = [];
    const nodeMap = new Map<string, BOMNode>();

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

  // Get unique vendors
  const uniqueVendors = useMemo(() => {
    return filters?.vendor_list || [];
  }, [filters]);

  // Get unique categories
  const uniqueCategories = useMemo(() => {
    return filters?.tag_list || [];
  }, [filters]);

  // Calculate rates for each item
  const itemRates = useMemo(() => {
    return items.map(item => {
      const vendorRate = item.vendor_rate || 0;
      const baseRate = item.base_rate || 0;
      const quotedRate = item.quoted_rate || 0;
      const additionalCostsPerUnit = item.additional_cost_per_unit || 0;
      const totalAC = item.total_additional_cost || 0;
      const itemTotal = item.total_amount || 0;

      // Calculate markup from vendor rate to base rate
      const markup = vendorRate > 0 ? ((baseRate - vendorRate) / vendorRate) * 100 : 0;

      // Get vendor currency symbol from code
      const vendorCurrencySymbol = getCurrencySymbol(item.vendor_currency);

      return {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        vendor_currency_code: item.vendor_currency || 'INR',
        vendor_currency_symbol: vendorCurrencySymbol || currencySymbol,
        bom_path: item.bom_path,
        tags: item.tags,
        vendor_rate: vendorRate,
        base_rate: baseRate,
        quoted_rate: quotedRate,
        additional_cost_per_unit: additionalCostsPerUnit,
        total_ac: totalAC,
        item_total: itemTotal,
        markup,
        percent_of_quote: item.percent_of_quote || 0
      };
    });
  }, [items, currencySymbol]);

  // Apply filters (without selectedItem for charts)
  const baseFilteredItems = useMemo(() => {
    let result = [...itemRates];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(query) ||
        item.item_name.toLowerCase().includes(query)
      );
    }

    // Apply BOM Instance filter (for volume scenarios)
    if (!selectedBOMInstances.includes('all')) {
      result = result.filter(item =>
        selectedBOMInstances.includes(item.bom_instance_id)
      );
    }

    // BOM filter
    if (!selectedBOMs.includes('all')) {
      result = result.filter(item =>
        selectedBOMs.some(bom =>
          item.bom_path === bom || item.bom_path?.startsWith(bom + ' > ')
        )
      );
    }

    // Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_id && selectedVendors.includes(item.vendor_id)
      );
    }

    // Category filter
    if (!selectedCategories.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedCategories.includes(tag))
      );
    }

    return result;
  }, [itemRates, searchQuery, selectedBOMInstances, selectedBOMs, selectedVendors, selectedCategories]);

  // Apply selectedItem filter for table
  const filteredItems = useMemo(() => {
    let result = baseFilteredItems;

    // Apply item selection from chart
    if (selectedItem) {
      result = result.filter(item => item.item_code === selectedItem);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof typeof a];
      let bVal: any = b[sortColumn as keyof typeof b];

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [baseFilteredItems, selectedItem, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Key insights from base filtered items (for charts)
  const insights = useMemo(() => {
    if (baseFilteredItems.length === 0) {
      return { avgMarkup: 0, highestMarkup: 0, lowestMarkup: 0, totalAC: 0, totalValue: 0, itemCount: 0 };
    }

    const avgMarkup = baseFilteredItems.reduce((sum, item) => sum + item.markup, 0) / baseFilteredItems.length;
    const highestMarkup = Math.max(...baseFilteredItems.map(i => i.markup));
    const lowestMarkup = Math.min(...baseFilteredItems.map(i => i.markup));
    const totalAC = baseFilteredItems.reduce((sum, item) => sum + item.total_ac, 0);
    const totalValue = baseFilteredItems.reduce((sum, item) => sum + item.item_total, 0);

    return { avgMarkup, highestMarkup, lowestMarkup, totalAC, totalValue, itemCount: baseFilteredItems.length };
  }, [baseFilteredItems]);

  // Chart data - top items by total amount or markup (from base filtered, not selectedItem filtered)
  const chartData = useMemo(() => {
    const sorted = [...baseFilteredItems].sort((a, b) => {
      if (chartViewMode === 'markup') return b.markup - a.markup;
      return b.item_total - a.item_total;
    });
    return sorted.slice(0, 8);
  }, [baseFilteredItems, chartViewMode]);

  // Check if any filters are active
  const hasActiveFilters = !selectedBOMInstances.includes('all') || !selectedBOMs.includes('all') || !selectedVendors.includes('all') ||
    !selectedCategories.includes('all') || searchQuery.trim() !== '' || selectedItem !== null;

  // Clear all filters
  // Global filter reset - responds to filterResetKey from parent
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMInstances(['all']);
      setSelectedBOMs(['all']);
      setSelectedVendors(['all']);
      setSelectedCategories(['all']);
      setSearchQuery('');
      setSelectedItem(null);
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  const clearAllFilters = () => {
    setSelectedBOMInstances(['all']);
    setSelectedBOMs(['all']);
    setSelectedVendors(['all']);
    setSelectedCategories(['all']);
    setSearchQuery('');
    setSelectedItem(null);
    setCurrentPage(1);
    // Trigger global reset
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

  // Filtered dropdown lists
  const filteredBOMList = useMemo(() => {
    if (!bomSearch.trim()) return uniqueBOMs;
    return uniqueBOMs.filter(b => b.toLowerCase().includes(bomSearch.toLowerCase()));
  }, [uniqueBOMs, bomSearch]);

  const filteredVendorList = useMemo(() => {
    if (!vendorSearch.trim()) return uniqueVendors;
    return uniqueVendors.filter(v =>
      v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())
    );
  }, [uniqueVendors, vendorSearch]);

  const filteredCategoryList = useMemo(() => {
    if (!categorySearch.trim()) return uniqueCategories;
    return uniqueCategories.filter(c =>
      c.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [uniqueCategories, categorySearch]);

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
                Showing {filteredItems.length} of {itemRates.length} items
                {selectedItem && ` • Item: ${selectedItem}`}
                {!selectedBOMInstances.includes('all') && ` • ${getBOMInstanceFilterText(selectedBOMInstances, bomInstances)}`}
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedVendors.includes('all') && ` • Vendor: ${selectedVendors.map(vId => uniqueVendors.find(v => v.vendor_id === vId)?.vendor_name || vId).join(', ')}`}
                {!selectedCategories.includes('all') && ` • Category: ${selectedCategories.join(', ')}`}
                {searchQuery && ` • Search: "${searchQuery}"`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedItem && (
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to All Items
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
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Items</div>
            <div className="text-3xl font-bold text-blue-600">{insights.itemCount}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {currencySymbol}{insights.totalValue.toLocaleString()} total
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Avg Markup</div>
            <div className="text-3xl font-bold text-green-600">{insights.avgMarkup.toFixed(1)}%</div>
            <div className="text-sm font-medium text-gray-700 mt-2">vendor → buyer base</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Markup Range</div>
            <div className="text-2xl font-bold text-purple-600">
              {insights.lowestMarkup.toFixed(0)}% - {insights.highestMarkup.toFixed(0)}%
            </div>
            <div className="text-sm font-medium text-gray-700 mt-2">min to max</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total Additional Costs</div>
            <div className="text-3xl font-bold text-orange-600">
              {currencySymbol}{insights.totalAC.toLocaleString()}
            </div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {((insights.totalAC / insights.totalValue) * 100).toFixed(1)}% of value
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Rate Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Compare Vendor Base Rate, Buyer Base Rate, and Landed Rate
            </p>
            {hasActiveFilters && (
              <p className="text-sm text-orange-600 font-medium mt-1">
                Showing {baseFilteredItems.length} filtered items
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setChartViewMode('rates')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'rates'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Total Value
            </button>
            <button
              onClick={() => setChartViewMode('markup')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'markup'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Markup %
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Chart - Top Items by Value/Markup */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">
                Top 10 Items {chartViewMode === 'markup' ? 'by Markup %' : 'by Total Value'}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Click any item to filter the table below
              </p>

              <div className="space-y-2">
                {chartData.slice(0, 10).map((item, index) => {
                  const maxVal = chartData[0] ? (chartViewMode === 'markup' ? Math.abs(chartData[0].markup) : chartData[0].item_total) : 1;
                  const currentVal = chartViewMode === 'markup' ? Math.abs(item.markup) : item.item_total;
                  const widthPercent = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;
                  const isSelected = selectedItem === item.item_code;

                  return (
                    <div
                      key={`${item.item_id}-${item.bom_path}`}
                      className={`cursor-pointer rounded-lg p-2 -mx-2 transition-all ${
                        isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedItem(isSelected ? null : item.item_code)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 text-xs font-bold text-gray-400">{index + 1}</span>
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate" title={`${item.item_code} - ${item.item_name}`}>
                          {item.item_code}
                        </span>
                        <span className="text-sm font-bold text-gray-700">
                          {chartViewMode === 'markup'
                            ? <span className={item.markup >= 0 ? 'text-green-600' : 'text-red-600'}>{item.markup.toFixed(1)}%</span>
                            : `${currencySymbol}${item.item_total.toLocaleString()}`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5" />
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${Math.min(widthPercent, 100)}%`,
                              backgroundColor: chartViewMode === 'markup'
                                ? (item.markup >= 15 ? '#16a34a' : item.markup >= 5 ? '#ca8a04' : item.markup >= 0 ? '#f97316' : '#dc2626')
                                : COLORS[index % COLORS.length]
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

          {/* Right Chart - Rate Comparison Table */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">Rate Comparison</h4>
              <p className="text-sm text-gray-600 mb-4">
                All three rates side by side for top items
              </p>

              {/* Mini table header */}
              <div className="grid grid-cols-12 gap-1 text-xs font-bold text-gray-600 border-b border-gray-200 pb-2 mb-2">
                <div className="col-span-3">Item</div>
                <div className="col-span-3 text-right">Vendor Base</div>
                <div className="col-span-3 text-right">Buyer Base</div>
                <div className="col-span-3 text-right">Landed</div>
              </div>

              <div className="space-y-1">
                {chartData.slice(0, 8).map((item, index) => {
                  const isSelected = selectedItem === item.item_code;

                  return (
                    <div
                      key={`table-${item.item_id}-${item.bom_path}`}
                      className={`grid grid-cols-12 gap-1 py-2 px-1 rounded cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedItem(isSelected ? null : item.item_code)}
                    >
                      <div className="col-span-3 text-sm font-medium text-gray-900 truncate" title={item.item_code}>
                        {item.item_code}
                      </div>
                      <div className="col-span-3 text-right text-sm font-mono text-gray-600">
                        {item.vendor_rate > 0 ? `${item.vendor_currency_symbol}${item.vendor_rate.toLocaleString()}` : '-'}
                      </div>
                      <div className="col-span-3 text-right text-sm font-mono text-blue-600 font-medium">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </div>
                      <div className="col-span-3 text-right text-sm font-mono text-green-600 font-bold">
                        {currencySymbol}{item.quoted_rate.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary stats */}
              {baseFilteredItems.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
                  <div className="text-sm font-bold text-gray-700">Summary ({baseFilteredItems.length} items)</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500">Avg Vendor Base</div>
                      <div className="text-sm font-bold text-gray-700">
                        {currencySymbol}{(baseFilteredItems.reduce((s, i) => s + i.vendor_rate, 0) / baseFilteredItems.length).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-xs text-blue-600">Avg Buyer Base</div>
                      <div className="text-sm font-bold text-blue-700">
                        {currencySymbol}{(baseFilteredItems.reduce((s, i) => s + i.base_rate, 0) / baseFilteredItems.length).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs text-green-600">Avg Landed</div>
                      <div className="text-sm font-bold text-green-700">
                        {currencySymbol}{(baseFilteredItems.reduce((s, i) => s + i.quoted_rate, 0) / baseFilteredItems.length).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-xs text-gray-500">Average Markup: </span>
                    <span className={`text-sm font-bold ${insights.avgMarkup >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {insights.avgMarkup.toFixed(1)}%
                    </span>
                  </div>
                </div>
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
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <BOMInstanceFilter
              bomInstances={bomInstances}
              selectedInstances={selectedBOMInstances}
              onSelectionChange={setSelectedBOMInstances}
              hasVolumeScenarios={hasVolumeScenarios}
            />

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

            {/* Category Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'category' ? null : 'category'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedCategories.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
                          selectedCategories.includes(cat) ? 'bg-blue-50' : ''
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

              {selectedItem && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  Item: {selectedItem}
                  <button onClick={() => setSelectedItem(null)} className="hover:text-blue-900">×</button>
                </span>
              )}

              <BOMInstanceFilterPills
                selectedInstances={selectedBOMInstances}
                bomInstances={bomInstances}
                onRemove={(instanceId) => {
                  const newInstances = selectedBOMInstances.filter(id => id !== instanceId);
                  setSelectedBOMInstances(newInstances.length ? newInstances : ['all']);
                }}
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

              {!selectedVendors.includes('all') && selectedVendors.map(vId => (
                <span key={vId} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  Vendor: {uniqueVendors.find(v => v.vendor_id === vId)?.vendor_name || vId}
                  <button onClick={() => {
                    const newVendors = selectedVendors.filter(v => v !== vId);
                    setSelectedVendors(newVendors.length ? newVendors : ['all']);
                  }} className="hover:text-green-900">×</button>
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
              Complete Rate Breakdown
              {selectedItem && <span className="ml-2 text-blue-600">- Showing: {selectedItem}</span>}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-300 text-sm">#</th>
                  {columnDefs.filter(col => visibleColumns.has(col.key)).map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 font-bold text-gray-700 border-r border-gray-300 text-sm cursor-pointer hover:bg-gray-200 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
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
                {paginatedItems.map((item, idx) => (
                  <tr
                    key={`${item.item_id}-${item.bom_path}-${idx}`}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-sm">
                      {((currentPage - 1) * pageSize) + idx + 1}
                    </td>

                    {visibleColumns.has('item_code') && (
                      <td className="px-3 py-2 border-r border-gray-200">
                        <span className="font-mono font-medium text-gray-900 text-sm">{item.item_code}</span>
                      </td>
                    )}

                    {visibleColumns.has('item_name') && (
                      <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-[150px] truncate text-sm" title={item.item_name}>
                        {item.item_name}
                      </td>
                    )}

                    {visibleColumns.has('vendor_name') && (
                      <td className="px-3 py-2 border-r border-gray-200">
                        <button
                          onClick={() => navigateToTab('items', { selectedVendor: item.vendor_name || undefined })}
                          className="text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
                        >
                          {item.vendor_name || 'N/A'}
                        </button>
                      </td>
                    )}

                    {visibleColumns.has('bom_path') && (
                      <td className="px-3 py-2 border-r border-gray-200">
                        <button
                          onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                          className="font-mono text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium"
                        >
                          {item.bom_path}
                        </button>
                      </td>
                    )}

                    {visibleColumns.has('quantity') && (
                      <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-sm">
                        {item.quantity} {item.unit}
                      </td>
                    )}

                    {visibleColumns.has('vendor_rate') && (
                      <td className="px-3 py-2 text-right font-mono text-gray-600 border-r border-gray-200 text-sm">
                        {item.vendor_rate > 0
                          ? `${item.vendor_currency_symbol}${item.vendor_rate.toLocaleString()}`
                          : <span className="text-gray-400">-</span>
                        }
                      </td>
                    )}

                    {visibleColumns.has('base_rate') && (
                      <td className="px-3 py-2 text-right font-mono font-medium text-blue-600 border-r border-gray-200 text-sm">
                        {currencySymbol}{item.base_rate.toLocaleString()}
                      </td>
                    )}

                    {visibleColumns.has('markup') && (
                      <td className="px-3 py-2 text-center border-r border-gray-200">
                        {item.vendor_rate > 0 ? (
                          <Badge className={`text-xs ${item.markup >= 15 ? 'bg-green-100 text-green-800' : item.markup >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {item.markup.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.has('ac_per_unit') && (
                      <td className="px-3 py-2 text-right font-mono text-orange-600 border-r border-gray-200 text-sm">
                        {currencySymbol}{item.additional_cost_per_unit.toLocaleString()}
                      </td>
                    )}

                    {visibleColumns.has('quoted_rate') && (
                      <td className="px-3 py-2 text-right font-mono font-bold text-green-600 border-r border-gray-200 text-sm">
                        {currencySymbol}{item.quoted_rate.toLocaleString()}
                      </td>
                    )}

                    {visibleColumns.has('item_total') && (
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-sm">
                        {currencySymbol}{item.item_total.toLocaleString()}
                      </td>
                    )}

                    {visibleColumns.has('percent_of_quote') && (
                      <td className="px-3 py-2 text-right text-gray-600 text-sm">
                        {item.percent_of_quote.toFixed(1)}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Showing {paginatedItems.length} of {filteredItems.length} items
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
