import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { CostViewData, CostViewItem } from '../../../../services/api';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';
import BOMInstanceFilter, { BOMInstanceFilterPills, getBOMInstanceFilterText } from '../../shared/BOMInstanceFilter';

interface AdditionalCostsViewProps {
  data: TopItemsAnalytics;
  costViewData?: CostViewData;
  currencySymbol?: string;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SOURCE_COLORS: Record<string, string> = {
  'PROJECT': '#3b82f6',
  'EVENT': '#10b981',
  'QUOTE': '#f59e0b'
};

const SOURCE_LABELS: Record<string, string> = {
  'PROJECT': 'Project',
  'EVENT': 'Event',
  'QUOTE': 'Quote'
};

export default function AdditionalCostsView({
  costViewData,
  currencySymbol = '₹',
  totalQuoteValue,
  navigateToTab,
  navigationContext,
  filterResetKey,
  onClearAllFilters
}: AdditionalCostsViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMInstances, setSelectedBOMInstances] = useState<string[]>(['all']);
  const [selectedACTypes, setSelectedACTypes] = useState<string[]>(['all']);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [hasACOnly, setHasACOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [chartViewMode, setChartViewMode] = useState<'type' | 'item'>('type');
  const [sortColumn, setSortColumn] = useState<string>('total_additional_cost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [openDropdown, setOpenDropdown] = useState<'actype' | 'bom' | 'vendor' | 'category' | 'columns' | null>(null);
  const [acTypeSearch, setAcTypeSearch] = useState('');
  const [bomSearch, setBomSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Column visibility - base columns
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_code', 'item_name', 'vendor_name', 'quantity', 'base_rate', 'item_cost'
  ]));

  // Show per-unit or total for AC columns
  const [acDisplayMode, setAcDisplayMode] = useState<'per_unit' | 'total'>('total');

  // Column definitions (base columns only - AC columns are dynamic)
  const baseColumnDefs = [
    { key: 'item_code', label: 'Item Code', align: 'left' },
    { key: 'item_name', label: 'Item Name', align: 'left' },
    { key: 'vendor_name', label: 'Vendor', align: 'left' },
    { key: 'bom_path', label: 'BOM', align: 'left' },
    { key: 'tags', label: 'Categories', align: 'left' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'base_rate', label: 'Base Rate', align: 'right' },
    { key: 'item_cost', label: 'Item Cost', align: 'right' },
  ];

  // End columns after AC types
  const endColumnDefs = [
    { key: 'total_ac', label: 'Total AC', align: 'right' },
    { key: 'final_cost', label: 'Final Cost', align: 'right' },
    { key: 'ac_percent', label: 'AC %', align: 'right' },
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
  }, [searchQuery, selectedACTypes, selectedVendors, selectedBOMs, selectedCategories, hasACOnly, selectedBOMInstances]);

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

  // Get all unique AC types from items
  const allACTypes = useMemo(() => {
    const acTypeSet = new Set<string>();
    items.forEach(item => {
      item.additional_costs.forEach(ac => {
        acTypeSet.add(ac.cost_name);
      });
    });
    return Array.from(acTypeSet).sort();
  }, [items]);

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

  // Filter items (base filter without sorting for charts)
  const baseFilteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.item_code.toLowerCase().includes(query) ||
        item.item_name.toLowerCase().includes(query)
      );
    }

    // Has AC only
    if (hasACOnly) {
      result = result.filter(item => item.total_additional_cost > 0);
    }

    // AC type filter
    if (!selectedACTypes.includes('all')) {
      result = result.filter(item =>
        item.additional_costs.some(ac => selectedACTypes.includes(ac.cost_name))
      );
    }

    // Vendor filter
    if (!selectedVendors.includes('all')) {
      result = result.filter(item =>
        item.vendor_id && selectedVendors.includes(item.vendor_id)
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

    // Category filter
    if (!selectedCategories.includes('all')) {
      result = result.filter(item =>
        item.tags.some(tag => selectedCategories.includes(tag))
      );
    }

    return result;
  }, [items, searchQuery, hasACOnly, selectedACTypes, selectedVendors, selectedBOMs, selectedCategories, selectedBOMInstances]);

  // Sorted and filtered items for table
  const filteredItems = useMemo(() => {
    let result = [...baseFilteredItems];

    // Sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'item_code':
        case 'item_name':
        case 'vendor_name':
        case 'bom_path':
          aVal = (a[sortColumn as keyof CostViewItem] as string) || '';
          bVal = (b[sortColumn as keyof CostViewItem] as string) || '';
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'total_ac':
          aVal = a.total_additional_cost;
          bVal = b.total_additional_cost;
          break;
        case 'ac_per_unit':
          aVal = a.additional_cost_per_unit;
          bVal = b.additional_cost_per_unit;
          break;
        case 'item_cost':
          aVal = a.base_rate * a.quantity;
          bVal = b.base_rate * b.quantity;
          break;
        case 'final_cost':
          aVal = a.total_amount;
          bVal = b.total_amount;
          break;
        case 'ac_percent':
          aVal = a.total_amount > 0 ? (a.total_additional_cost / a.total_amount) * 100 : 0;
          bVal = b.total_amount > 0 ? (b.total_additional_cost / b.total_amount) * 100 : 0;
          break;
        default:
          aVal = a[sortColumn as keyof CostViewItem] || 0;
          bVal = b[sortColumn as keyof CostViewItem] || 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [baseFilteredItems, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // AC type breakdown for charts (from filtered items)
  const acTypeBreakdown = useMemo(() => {
    const typeMap = new Map<string, number>();
    baseFilteredItems.forEach(item => {
      item.additional_costs.forEach(ac => {
        // Only include AC types that match the filter (or all if no filter)
        if (selectedACTypes.includes('all') || selectedACTypes.includes(ac.cost_name)) {
          typeMap.set(ac.cost_name, (typeMap.get(ac.cost_name) || 0) + ac.total_amount);
        }
      });
    });
    return Array.from(typeMap.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [baseFilteredItems, selectedACTypes]);

  // Top items by AC for chart
  const topItemsByAC = useMemo(() => {
    return [...baseFilteredItems]
      .sort((a, b) => b.total_additional_cost - a.total_additional_cost)
      .slice(0, 10);
  }, [baseFilteredItems]);

  // AC by Vendor breakdown (for default right chart)
  const acByVendor = useMemo(() => {
    const vendorMap = new Map<string, { name: string; total: number; itemCount: number }>();
    baseFilteredItems.forEach(item => {
      if (item.vendor_name && item.total_additional_cost > 0) {
        const existing = vendorMap.get(item.vendor_name) || { name: item.vendor_name, total: 0, itemCount: 0 };
        existing.total += item.total_additional_cost;
        existing.itemCount += 1;
        vendorMap.set(item.vendor_name, existing);
      }
    });
    return Array.from(vendorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [baseFilteredItems]);

  // AC by Category breakdown
  const acByCategory = useMemo(() => {
    const catMap = new Map<string, number>();
    baseFilteredItems.forEach(item => {
      if (item.total_additional_cost > 0) {
        item.tags.forEach(tag => {
          catMap.set(tag, (catMap.get(tag) || 0) + item.total_additional_cost);
        });
      }
    });
    return Array.from(catMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [baseFilteredItems]);

  // Determine what the right chart should show based on active filters
  const rightChartContext = useMemo(() => {
    // Priority: Search > AC Type > Vendor > BOM > Category > Default
    if (searchQuery.trim()) {
      // Show AC breakdown for searched item(s)
      const matchedItems = baseFilteredItems.filter(item =>
        item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchedItems.length === 1) {
        // Single item - show its AC breakdown
        const item = matchedItems[0];
        return {
          type: 'item_breakdown' as const,
          title: `AC Breakdown: ${item.item_code}`,
          subtitle: item.item_name,
          data: item.additional_costs.map(ac => ({
            name: ac.cost_name,
            total: ac.total_amount,
            perUnit: ac.per_unit_amount
          })).sort((a, b) => b.total - a.total)
        };
      } else if (matchedItems.length > 1) {
        // Multiple items - show AC types across them
        const typeMap = new Map<string, number>();
        matchedItems.forEach(item => {
          item.additional_costs.forEach(ac => {
            typeMap.set(ac.cost_name, (typeMap.get(ac.cost_name) || 0) + ac.total_amount);
          });
        });
        return {
          type: 'ac_types' as const,
          title: `AC Types for "${searchQuery}"`,
          subtitle: `${matchedItems.length} items matched`,
          data: Array.from(typeMap.entries())
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
        };
      }
    }

    if (!selectedACTypes.includes('all')) {
      // Show items that have these AC types
      const itemsWithACType = baseFilteredItems
        .filter(item => item.additional_costs.some(ac => selectedACTypes.includes(ac.cost_name)))
        .sort((a, b) => {
          const aTotal = a.additional_costs.filter(ac => selectedACTypes.includes(ac.cost_name)).reduce((s, ac) => s + ac.total_amount, 0);
          const bTotal = b.additional_costs.filter(ac => selectedACTypes.includes(ac.cost_name)).reduce((s, ac) => s + ac.total_amount, 0);
          return bTotal - aTotal;
        })
        .slice(0, 8);
      return {
        type: 'items_with_ac' as const,
        title: `Items with ${selectedACTypes.length === 1 ? selectedACTypes[0] : `${selectedACTypes.length} AC Types`}`,
        subtitle: `${itemsWithACType.length} items`,
        data: itemsWithACType.map(item => ({
          name: item.item_code,
          total: item.additional_costs.filter(ac => selectedACTypes.includes(ac.cost_name)).reduce((s, ac) => s + ac.total_amount, 0),
          itemName: item.item_name
        }))
      };
    }

    if (!selectedVendors.includes('all')) {
      // Show AC types for selected vendor(s)
      const vendorNames = selectedVendors.map(vId => uniqueVendors.find(v => v.vendor_id === vId)?.vendor_name || vId);
      return {
        type: 'ac_types' as const,
        title: `AC Types for ${vendorNames.length === 1 ? vendorNames[0] : `${vendorNames.length} Vendors`}`,
        subtitle: `${baseFilteredItems.length} items`,
        data: acTypeBreakdown.map(entry => ({ name: entry.type, total: entry.total }))
      };
    }

    if (!selectedBOMs.includes('all')) {
      // Show AC types for selected BOM(s)
      const bomNames = selectedBOMs.map(b => b.split(' > ').pop() || b);
      return {
        type: 'ac_types' as const,
        title: `AC Types in ${bomNames.length === 1 ? bomNames[0] : `${bomNames.length} BOMs`}`,
        subtitle: `${baseFilteredItems.length} items`,
        data: acTypeBreakdown.map(entry => ({ name: entry.type, total: entry.total }))
      };
    }

    if (!selectedCategories.includes('all')) {
      // Show AC types for selected category
      return {
        type: 'ac_types' as const,
        title: `AC Types in ${selectedCategories.length === 1 ? selectedCategories[0] : `${selectedCategories.length} Categories`}`,
        subtitle: `${baseFilteredItems.length} items`,
        data: acTypeBreakdown.map(entry => ({ name: entry.type, total: entry.total }))
      };
    }

    // Default: Show AC by Vendor
    return {
      type: 'by_vendor' as const,
      title: 'AC by Vendor',
      subtitle: 'Which vendors have highest additional costs',
      data: acByVendor.map(v => ({ name: v.name, total: v.total, itemCount: v.itemCount }))
    };
  }, [searchQuery, selectedACTypes, selectedVendors, selectedBOMs, selectedCategories, baseFilteredItems, acTypeBreakdown, acByVendor, uniqueVendors]);

  // Key insights
  const insights = useMemo(() => {
    const totalAC = baseFilteredItems.reduce((sum, item) => sum + item.total_additional_cost, 0);
    const itemsWithAC = baseFilteredItems.filter(i => i.total_additional_cost > 0).length;
    const avgACPerItem = itemsWithAC > 0 ? totalAC / itemsWithAC : 0;
    const totalFinalCost = baseFilteredItems.reduce((sum, item) => sum + item.total_amount, 0);
    const acPercentOfTotal = totalFinalCost > 0 ? (totalAC / totalFinalCost) * 100 : 0;

    return { totalAC, itemsWithAC, avgACPerItem, totalFinalCost, acTypesCount: acTypeBreakdown.length, acPercentOfTotal };
  }, [baseFilteredItems, acTypeBreakdown]);

  // Check if any filters are active
  const hasActiveFilters = !selectedACTypes.includes('all') || !selectedVendors.includes('all') ||
    !selectedBOMs.includes('all') || !selectedCategories.includes('all') ||
    searchQuery.trim() !== '' || !hasACOnly || !selectedBOMInstances.includes('all');

  // Clear all filters
  // Global filter reset - responds to filterResetKey from parent
  useEffect(() => {
    if (filterResetKey !== undefined && filterResetKey > 0) {
      setSelectedBOMInstances(['all']);
      setSelectedACTypes(['all']);
      setSelectedVendors(['all']);
      setSelectedBOMs(['all']);
      setSelectedCategories(['all']);
      setSearchQuery('');
      setHasACOnly(true);
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  const clearAllFilters = () => {
    setSelectedBOMInstances(['all']);
    setSelectedACTypes(['all']);
    setSelectedVendors(['all']);
    setSelectedBOMs(['all']);
    setSelectedCategories(['all']);
    setSearchQuery('');
    setHasACOnly(true);
    setCurrentPage(1);
    // Trigger global reset
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

  // Filtered dropdown lists
  const filteredACTypeList = useMemo(() => {
    if (!acTypeSearch.trim()) return allACTypes;
    return allACTypes.filter(t => t.toLowerCase().includes(acTypeSearch.toLowerCase()));
  }, [allACTypes, acTypeSearch]);

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

  // Get AC value for an item by cost name
  const getACValue = (item: CostViewItem, costName: string) => {
    const ac = item.additional_costs.find(a => a.cost_name === costName);
    return ac ? { total: ac.total_amount, perUnit: ac.per_unit_amount, type: ac.cost_type } : null;
  };

  // Get AC metadata for tooltip (aggregated from all items that have this AC type)
  const getACMetadata = (costName: string) => {
    // Find first item with this AC type to get metadata
    for (const item of items) {
      const ac = item.additional_costs.find(a => a.cost_name === costName);
      if (ac) {
        return {
          costType: ac.cost_type === 'PERCENTAGE' ? 'Percentage' : 'Absolute Value',
          source: ac.cost_source === 'FORMULA' ? 'Formula' :
                  ac.cost_source === 'VENDOR' ? 'Vendor' :
                  ac.cost_source === 'ITEM' ? 'Item' : 'Default',
          allocation: ac.allocation_type === 'PER_UNIT' ? 'Per Unit' :
                      ac.allocation_type === 'OVERALL_QUANTITY' ? 'Overall Quantity' : 'N/A'
        };
      }
    }
    return null;
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
                Showing {filteredItems.length} of {items.length} items
                {!hasACOnly && ' • Including items without AC'}
                {!selectedACTypes.includes('all') && ` • AC Types: ${selectedACTypes.length}`}
                {getBOMInstanceFilterText(selectedBOMInstances, bomInstances)}
                {!selectedBOMs.includes('all') && ` • BOM: ${selectedBOMs.map(b => b.split(' > ').pop()).join(', ')}`}
                {!selectedVendors.includes('all') && ` • Vendors: ${selectedVendors.length}`}
                {!selectedCategories.includes('all') && ` • Categories: ${selectedCategories.length}`}
                {searchQuery && ` • Search: "${searchQuery}"`}
              </p>
            </div>
          </div>
          <button
            onClick={clearAllFilters}
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
            <div className="text-sm font-bold text-gray-700 mb-2">Total Additional Costs</div>
            <div className="text-3xl font-bold text-orange-600">{currencySymbol}{insights.totalAC.toLocaleString()}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              {insights.acPercentOfTotal.toFixed(1)}% of final cost
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Items with AC</div>
            <div className="text-3xl font-bold text-blue-600">{insights.itemsWithAC}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">
              of {baseFilteredItems.length} filtered items
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Avg AC per Item</div>
            <div className="text-3xl font-bold text-green-600">
              {currencySymbol}{insights.avgACPerItem.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm font-medium text-gray-700 mt-2">for items with AC</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">AC Types</div>
            <div className="text-3xl font-bold text-purple-600">{insights.acTypesCount}</div>
            <div className="text-sm font-medium text-gray-700 mt-2">unique cost types</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Additional Costs Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Breakdown of additional costs by type and item
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setChartViewMode('type')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'type'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By AC Type
            </button>
            <button
              onClick={() => setChartViewMode('item')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                chartViewMode === 'item'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              By Item
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Chart - By Type or Item based on mode */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">
                {chartViewMode === 'type' ? 'Top AC Types' : 'Top Items by AC'}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                {chartViewMode === 'type'
                  ? 'Additional cost types with highest total amounts'
                  : 'Items with highest additional costs'
                }
              </p>

              <div className="space-y-2">
                {(chartViewMode === 'type' ? acTypeBreakdown : topItemsByAC).map((entry, index) => {
                  const maxVal = chartViewMode === 'type'
                    ? (acTypeBreakdown[0]?.total || 1)
                    : (topItemsByAC[0]?.total_additional_cost || 1);
                  const currentVal = chartViewMode === 'type'
                    ? (entry as { type: string; total: number }).total
                    : (entry as CostViewItem).total_additional_cost;
                  const widthPercent = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;
                  const label = chartViewMode === 'type'
                    ? (entry as { type: string; total: number }).type
                    : (entry as CostViewItem).item_code;

                  return (
                    <div
                      key={`chart-${index}`}
                      className="cursor-pointer rounded-lg p-2 -mx-2 transition-all hover:bg-gray-50"
                      onClick={() => {
                        if (chartViewMode === 'type') {
                          setSelectedACTypes([(entry as { type: string; total: number }).type]);
                        } else {
                          setSearchQuery((entry as CostViewItem).item_code);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 text-xs font-bold text-gray-400">{index + 1}</span>
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate" title={label}>
                          {label}
                        </span>
                        <span className="text-sm font-bold text-orange-600">
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
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(chartViewMode === 'type' ? acTypeBreakdown : topItemsByAC).length === 0 && (
                <div className="text-center text-gray-500 py-8">No data to display</div>
              )}
            </CardContent>
          </Card>

          {/* Right Chart - Contextual based on filters */}
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <h4 className="font-bold text-gray-900 mb-1 text-lg">{rightChartContext.title}</h4>
              <p className="text-sm text-gray-600 mb-4">{rightChartContext.subtitle}</p>

              {rightChartContext.data.length > 0 ? (
                <div className="space-y-2">
                  {rightChartContext.data.map((entry: any, index: number) => {
                    const maxVal = rightChartContext.data[0]?.total || 1;
                    const widthPercent = maxVal > 0 ? (entry.total / maxVal) * 100 : 0;
                    const totalSum = rightChartContext.data.reduce((s: number, e: any) => s + e.total, 0);
                    const percent = totalSum > 0 ? (entry.total / totalSum) * 100 : 0;

                    return (
                      <div
                        key={`right-${index}`}
                        className="cursor-pointer rounded-lg p-2 -mx-2 transition-all hover:bg-gray-50"
                        onClick={() => {
                          if (rightChartContext.type === 'by_vendor') {
                            // Find vendor ID and filter
                            const vendor = uniqueVendors.find(v => v.vendor_name === entry.name);
                            if (vendor) setSelectedVendors([vendor.vendor_id]);
                          } else if (rightChartContext.type === 'items_with_ac' || rightChartContext.type === 'item_breakdown') {
                            setSearchQuery(entry.name);
                          } else if (rightChartContext.type === 'ac_types') {
                            setSelectedACTypes([entry.name]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 text-xs font-bold text-gray-400">{index + 1}</span>
                          <span className="flex-1 text-sm font-medium text-gray-900 truncate" title={entry.name}>
                            {entry.name}
                          </span>
                          <span className="text-sm font-bold text-orange-600">
                            {currencySymbol}{entry.total.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 w-12 text-right">
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5" />
                          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: `${Math.min(widthPercent, 100)}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                          <div className="w-12" />
                        </div>
                        {/* Show extra info based on context */}
                        {rightChartContext.type === 'by_vendor' && entry.itemCount && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-5" />
                            <span className="text-xs text-gray-500">{entry.itemCount} items</span>
                          </div>
                        )}
                        {rightChartContext.type === 'item_breakdown' && entry.perUnit !== undefined && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-5" />
                            <span className="text-xs text-gray-500">Per unit: {currencySymbol}{entry.perUnit.toLocaleString()}</span>
                          </div>
                        )}
                        {entry.itemName && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-5" />
                            <span className="text-xs text-gray-500 truncate">{entry.itemName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No data to display</div>
              )}

              {/* Summary */}
              {rightChartContext.data.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-700">Total ({rightChartContext.data.length} items)</span>
                    <span className="text-orange-700 font-mono">
                      {currencySymbol}{rightChartContext.data.reduce((s: number, e: any) => s + e.total, 0).toLocaleString()}
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

            {/* Has AC Only Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={hasACOnly}
                onChange={(e) => setHasACOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Has AC Only</span>
            </label>

            {/* BOM Instance Filter */}
            <BOMInstanceFilter
              bomInstances={bomInstances}
              selectedInstances={selectedBOMInstances}
              onSelectionChange={setSelectedBOMInstances}
              hasVolumeScenarios={hasVolumeScenarios}
            />

            {/* AC Type Filter Dropdown */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'actype' ? null : 'actype'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  !selectedACTypes.includes('all') ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>AC Type</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                  {selectedACTypes.includes('all') ? 'All' : selectedACTypes.length}
                </span>
                <span className="text-gray-400">▼</span>
              </button>

              {openDropdown === 'actype' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-72">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search AC types..."
                      value={acTypeSearch}
                      onChange={(e) => setAcTypeSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="px-2 py-2 border-b border-gray-100">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedACTypes.includes('all')}
                        onChange={() => setSelectedACTypes(['all'])}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900">All AC Types ({allACTypes.length})</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredACTypeList.map(acType => (
                      <label
                        key={acType}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                          selectedACTypes.includes(acType) ? 'bg-orange-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedACTypes.includes(acType)}
                          onChange={() => setSelectedACTypes(toggleSelection(selectedACTypes, acType))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 truncate">{acType}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-200 flex justify-between">
                    <button onClick={() => setSelectedACTypes(['all'])} className="text-xs text-gray-600 hover:text-gray-900">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
                </div>
              )}
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
                          selectedVendors.includes(vendor.vendor_id) ? 'bg-green-50' : ''
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
                    {baseColumnDefs.map(col => (
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

              {!hasACOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                  Including no-AC items
                  <button onClick={() => setHasACOnly(true)} className="hover:text-gray-900">×</button>
                </span>
              )}

              {/* BOM Instance Filter Pills */}
              <BOMInstanceFilterPills
                selectedInstances={selectedBOMInstances}
                bomInstances={bomInstances}
                onRemove={(instanceId) => {
                  const newInstances = selectedBOMInstances.filter(id => id !== instanceId);
                  setSelectedBOMInstances(newInstances.length ? newInstances : ['all']);
                }}
              />

              {!selectedACTypes.includes('all') && selectedACTypes.map(acType => (
                <span key={acType} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                  AC: {acType.length > 15 ? acType.substring(0, 15) + '...' : acType}
                  <button onClick={() => {
                    const newTypes = selectedACTypes.filter(t => t !== acType);
                    setSelectedACTypes(newTypes.length ? newTypes : ['all']);
                  }} className="hover:text-orange-900">×</button>
                </span>
              ))}

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
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">
                Additional Costs Breakdown
                {searchQuery && <span className="ml-2 text-blue-600">- Search: "{searchQuery}"</span>}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {allACTypes.length} cost types • {acDisplayMode === 'per_unit' ? 'Per Unit' : 'Total'} amounts shown
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show AC as:</span>
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded">
                <button
                  onClick={() => setAcDisplayMode('per_unit')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    acDisplayMode === 'per_unit' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Per Unit
                </button>
                <button
                  onClick={() => setAcDisplayMode('total')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    acDisplayMode === 'total' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Total
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300">#</th>
                  {/* Base columns */}
                  {baseColumnDefs.filter(col => visibleColumns.has(col.key)).map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2.5 font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortColumn === col.key && (
                        <span className="ml-1 text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                  {/* Dynamic AC Type columns */}
                  {allACTypes.map(acType => {
                    const metadata = getACMetadata(acType);
                    const tooltipText = metadata
                      ? `${acType}\n━━━━━━━━━━━━━━━━━━\nType: ${metadata.costType}\nSource: ${metadata.source}\nAllocation: ${metadata.allocation}\n\n(Click to filter)`
                      : `${acType}\n(Click to filter)`;

                    return (
                      <th
                        key={acType}
                        className={`px-3 py-2.5 font-bold text-orange-700 border-r border-gray-300 text-right cursor-pointer hover:bg-orange-50 whitespace-nowrap ${
                          selectedACTypes.includes(acType) && !selectedACTypes.includes('all') ? 'bg-orange-100' : ''
                        }`}
                        onClick={() => setSelectedACTypes(toggleSelection(selectedACTypes, acType))}
                        title={tooltipText}
                      >
                        {acType}
                      </th>
                    );
                  })}
                  {/* End columns */}
                  {endColumnDefs.map(col => (
                    <th
                      key={col.key}
                      className={`px-3 py-2.5 font-bold border-r border-gray-300 cursor-pointer hover:bg-gray-200 whitespace-nowrap ${
                        col.key.includes('ac') || col.key === 'total_ac' ? 'text-orange-700' : 'text-gray-700'
                      } ${col.align === 'right' ? 'text-right' : 'text-left'}`}
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
                {paginatedItems.map((item, idx) => {
                  const itemCost = item.base_rate * item.quantity;
                  const acPercent = item.total_amount > 0 ? (item.total_additional_cost / item.total_amount) * 100 : 0;

                  return (
                    <tr
                      key={`${item.item_id}-${item.bom_path}-${idx}`}
                      className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-600 border-r border-gray-200">
                        {((currentPage - 1) * pageSize) + idx + 1}
                      </td>

                      {/* Base columns */}
                      {visibleColumns.has('item_code') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <span className="font-mono font-medium text-gray-900">{item.item_code}</span>
                        </td>
                      )}

                      {visibleColumns.has('item_name') && (
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200 max-w-[200px] truncate" title={item.item_name}>
                          {item.item_name}
                        </td>
                      )}

                      {visibleColumns.has('vendor_name') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <button
                            onClick={() => navigateToTab('items', { selectedVendor: item.vendor_name || undefined })}
                            className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                            title={item.vendor_name || 'N/A'}
                          >
                            {item.vendor_name || 'N/A'}
                          </button>
                        </td>
                      )}

                      {visibleColumns.has('bom_path') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          <button
                            onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                            className="font-mono text-blue-700 hover:text-blue-900 hover:underline font-medium"
                            title={item.bom_path}
                          >
                            {item.bom_path}
                          </button>
                        </td>
                      )}

                      {visibleColumns.has('tags') && (
                        <td className="px-3 py-2.5 border-r border-gray-200">
                          {item.tags.length > 0 ? (
                            <span className="text-gray-700" title={item.tags.join(', ')}>
                              {item.tags[0]}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.has('quantity') && (
                        <td className="px-3 py-2.5 text-right text-gray-700 border-r border-gray-200">
                          {item.quantity} {item.unit}
                        </td>
                      )}

                      {visibleColumns.has('base_rate') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 border-r border-gray-200">
                          {currencySymbol}{item.base_rate.toLocaleString()}
                        </td>
                      )}

                      {visibleColumns.has('item_cost') && (
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 border-r border-gray-200">
                          {currencySymbol}{itemCost.toLocaleString()}
                        </td>
                      )}

                      {/* Dynamic AC Type columns */}
                      {allACTypes.map(acType => {
                        const acValue = getACValue(item, acType);
                        const displayValue = acValue
                          ? (acDisplayMode === 'per_unit' ? acValue.perUnit : acValue.total)
                          : null;

                        return (
                          <td
                            key={acType}
                            className={`px-3 py-2.5 text-right border-r border-gray-200 ${
                              selectedACTypes.includes(acType) && !selectedACTypes.includes('all') ? 'bg-orange-50' : ''
                            }`}
                          >
                            {displayValue !== null ? (
                              <span className="font-mono text-orange-600 font-semibold text-sm">
                                {currencySymbol}{displayValue.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* End columns */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-orange-600 border-r border-gray-200">
                        {currencySymbol}{item.total_additional_cost.toLocaleString()}
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 border-r border-gray-200">
                        {currencySymbol}{item.total_amount.toLocaleString()}
                      </td>

                      <td className="px-3 py-2.5 text-right font-semibold text-orange-600">
                        {acPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
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
