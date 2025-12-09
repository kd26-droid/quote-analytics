import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { AdditionalCostsBreakdown, BOMCostComparison, TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { BOMDetailData, CostViewData, RecurringCost } from '../../../../services/api';

interface BOMAdditionalCostsViewProps {
  additionalCosts: AdditionalCostsBreakdown;
  bomCostComparison: BOMCostComparison[];
  bomDetailData?: BOMDetailData | null;
  costViewData?: CostViewData;
  totalQuoteValue: number;
  data: TopItemsAnalytics;
  navigationContext?: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  currencySymbol?: string;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

interface BOMNode {
  path: string;
  code: string;
  name: string;
  level: number;
  children: BOMNode[];
  parentBomCode: string;
  bomQuantity: number;
  // Financial data from API
  totalItemCost: number;
  totalBomAcCalculated: number;
  totalBomAcQuoted: number;
  totalCalculatedAmount: number;
  totalQuotedAmount: number;
  // is_calculated=true costs (INCLUDED in totals)
  includedCosts: RecurringCost[];
  // is_calculated=false costs (DISPLAY ONLY - NOT in totals)
  displayOnlyCosts: RecurringCost[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const LEVEL_LABELS: Record<number, string> = {
  0: 'Main BOM',
  1: 'Sub-BOM',
  2: 'Sub-Sub-BOM',
  3: 'L3-BOM',
  4: 'L4-BOM',
};

export default function BOMAdditionalCostsView({
  bomDetailData,
  costViewData,
  totalQuoteValue,
  navigateToTab,
  navigationContext,
  currencySymbol = '₹',
  filterResetKey,
  onClearAllFilters
}: BOMAdditionalCostsViewProps) {
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [selectedACTypes, setSelectedACTypes] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [acDisplayMode, setAcDisplayMode] = useState<'calculated' | 'quoted'>('calculated');
  const [showDisplayOnly, setShowDisplayOnly] = useState(false); // Toggle to show is_calculated=false costs
  const [sortColumn, setSortColumn] = useState<string>('hierarchy');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openDropdown, setOpenDropdown] = useState<'bom' | 'level' | 'acType' | 'columns' | null>(null);
  const [bomSearch, setBomSearch] = useState('');
  const [acTypeSearch, setAcTypeSearch] = useState('');
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'hierarchy', 'bom_name', 'level', 'cost_name', 'cost_type', 'total_ac_calc', 'total_ac_quoted', 'diff'
  ]));

  // Column definitions
  const columnDefs = [
    { key: 'hierarchy', label: 'Hierarchy' },
    { key: 'bom_name', label: 'BOM Name' },
    { key: 'level', label: 'Level' },
    { key: 'cost_name', label: 'Cost Name' },
    { key: 'cost_type', label: 'Cost Type' },
    { key: 'total_ac_calc', label: 'Total AC (C)' },
    { key: 'total_ac_quoted', label: 'Total AC (Q)' },
    { key: 'diff', label: 'Q - C Diff' }
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
      setSelectedBOMs(['all']);
      setSelectedLevels([]);
      setSelectedACTypes(['all']);
      setSearchQuery('');
      setCurrentPage(1);
    }
  }, [filterResetKey]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBOMs, selectedLevels, selectedACTypes, searchQuery]);

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

  const toggleLevel = (level: number) => {
    setSelectedLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
  };

  // Check if we have real API data
  const hasRealData = bomDetailData && bomDetailData.bom_instances && bomDetailData.bom_instances.length > 0;

  // DEBUG: Log the raw bomDetailData to see what API returns
  useEffect(() => {
    if (bomDetailData) {
      console.log('[BOM AC View] Raw bomDetailData:', bomDetailData);
      if (bomDetailData.bom_instances?.[0]?.hierarchy) {
        bomDetailData.bom_instances[0].hierarchy.forEach(level => {
          console.log(`[BOM AC View] ${level.bom_code}:`, {
            total_item_cost: level.total_item_cost,
            total_bom_ac_calculated: level.total_bom_ac_calculated,
            total_bom_ac_quoted: level.total_bom_ac_quoted,
            total_calculated_amount: level.total_calculated_amount,
            total_quoted_amount: level.total_quoted_amount,
            recurring_costs_count: level.recurring_costs?.length,
            sample_cost: level.recurring_costs?.[0]
          });
        });
      }
    }
  }, [bomDetailData]);

  // Build BOM nodes from API
  const bomTree = useMemo(() => {
    if (!hasRealData) return [];

    const allNodes: BOMNode[] = [];
    const nodeMap = new Map<string, BOMNode>();

    bomDetailData!.bom_instances.forEach((instance) => {
      const instanceLabel = bomDetailData!.bom_instances.length > 1 ? ` (#${instance.instance_index})` : '';

      instance.hierarchy.forEach(bomLevel => {
        const displayCode = bomLevel.bom_level === 0 ? `${bomLevel.bom_code}${instanceLabel}` : bomLevel.bom_code;

        // Separate costs by is_calculated flag
        // is_calculated=true -> INCLUDED in totals
        // is_calculated=false -> DISPLAY ONLY (subtotals, gross amounts, etc.)
        const includedCosts = (bomLevel.recurring_costs || []).filter(c => c.is_calculated === true);
        const displayOnlyCosts = (bomLevel.recurring_costs || []).filter(c => c.is_calculated === false);

        // Use API totals directly - they should be provided by the backend
        // The API should return these fields as per the documentation
        const totalItemCost = bomLevel.total_item_cost ?? 0;
        const totalBomAcCalculated = bomLevel.total_bom_ac_calculated ?? includedCosts.reduce((sum, c) => sum + c.calculated_amount, 0);
        const totalBomAcQuoted = bomLevel.total_bom_ac_quoted ?? includedCosts.reduce((sum, c) => sum + c.quoted_amount, 0);
        const totalCalculatedAmount = bomLevel.total_calculated_amount ?? (totalItemCost + totalBomAcCalculated);
        const totalQuotedAmount = bomLevel.total_quoted_amount ?? (totalItemCost + totalBomAcQuoted);

        const node: BOMNode = {
          path: bomLevel.bom_path,
          code: displayCode,
          name: bomLevel.bom_name,
          level: bomLevel.bom_level,
          children: [],
          parentBomCode: bomLevel.parent_bom_code || '',
          bomQuantity: bomLevel.bom_quantity,
          totalItemCost,
          totalBomAcCalculated,
          totalBomAcQuoted,
          totalCalculatedAmount,
          totalQuotedAmount,
          includedCosts,
          displayOnlyCosts
        };

        allNodes.push(node);
        nodeMap.set(bomLevel.bom_code, node);
      });
    });

    // Build hierarchy
    allNodes.forEach(node => {
      if (node.parentBomCode) {
        const parent = nodeMap.get(node.parentBomCode);
        if (parent) parent.children.push(node);
      }
    });

    return allNodes.filter(n => n.level === 0);
  }, [bomDetailData, hasRealData]);

  // Flatten for display
  const allBOMNodes = useMemo(() => {
    const nodes: BOMNode[] = [];
    const collectNodes = (node: BOMNode) => {
      nodes.push(node);
      [...node.children].sort((a, b) => a.code.localeCompare(b.code)).forEach(collectNodes);
    };
    [...bomTree].sort((a, b) => a.code.localeCompare(b.code)).forEach(collectNodes);
    return nodes;
  }, [bomTree]);

  // Get all unique AC types - separate included vs display-only
  const { includedACTypes, displayOnlyACTypes } = useMemo(() => {
    const included = new Set<string>();
    const displayOnly = new Set<string>();
    allBOMNodes.forEach(node => {
      node.includedCosts.forEach(cost => included.add(cost.cost_name));
      node.displayOnlyCosts.forEach(cost => displayOnly.add(cost.cost_name));
    });
    return {
      includedACTypes: Array.from(included).sort(),
      displayOnlyACTypes: Array.from(displayOnly).sort()
    };
  }, [allBOMNodes]);

  // All AC types based on toggle
  const allACTypes = showDisplayOnly ? displayOnlyACTypes : includedACTypes;

  // Available levels
  const availableLevels = useMemo(() => {
    return Array.from(new Set(allBOMNodes.map(n => n.level))).sort();
  }, [allBOMNodes]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    let nodes = [...allBOMNodes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
    }

    if (!selectedBOMs.includes('all')) {
      nodes = nodes.filter(n => selectedBOMs.includes(n.code) || selectedBOMs.includes(n.parentBomCode));
    }

    if (selectedLevels.length > 0) {
      nodes = nodes.filter(n => selectedLevels.includes(n.level));
    }

    if (!selectedACTypes.includes('all')) {
      nodes = nodes.filter(n => n.includedCosts.some(c => selectedACTypes.includes(c.cost_name)));
    }

    return nodes;
  }, [allBOMNodes, searchQuery, selectedBOMs, selectedLevels, selectedACTypes]);

  // Sort
  const sortedNodes = useMemo(() => {
    const result = [...filteredNodes];
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'bom_code': return sortDirection === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
        case 'bom_name': return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'item_cost': aVal = a.totalItemCost; bVal = b.totalItemCost; break;
        case 'total_ac': aVal = acDisplayMode === 'calculated' ? a.totalBomAcCalculated : a.totalBomAcQuoted; bVal = acDisplayMode === 'calculated' ? b.totalBomAcCalculated : b.totalBomAcQuoted; break;
        case 'total': aVal = acDisplayMode === 'calculated' ? a.totalCalculatedAmount : a.totalQuotedAmount; bVal = acDisplayMode === 'calculated' ? b.totalCalculatedAmount : b.totalQuotedAmount; break;
        default:
          // Check if sorting by AC type
          if (sortColumn.startsWith('ac_')) {
            const acType = sortColumn.substring(3);
            const aCost = a.includedCosts.find(c => c.cost_name === acType);
            const bCost = b.includedCosts.find(c => c.cost_name === acType);
            aVal = aCost ? (acDisplayMode === 'calculated' ? aCost.calculated_amount : aCost.quoted_amount) : 0;
            bVal = bCost ? (acDisplayMode === 'calculated' ? bCost.calculated_amount : bCost.quoted_amount) : 0;
          } else {
            // Default: hierarchy order
            const aIdx = allBOMNodes.findIndex(n => n.path === a.path);
            const bIdx = allBOMNodes.findIndex(n => n.path === b.path);
            return sortDirection === 'asc' ? aIdx - bIdx : bIdx - aIdx;
          }
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [filteredNodes, sortColumn, sortDirection, allBOMNodes, acDisplayMode]);

  // Pagination
  const totalPages = Math.ceil(sortedNodes.length / pageSize);
  const paginatedNodes = sortedNodes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Insights
  const insights = useMemo(() => {
    const totalItemCost = filteredNodes.reduce((s, n) => s + n.totalItemCost, 0);
    const totalAcCalc = filteredNodes.reduce((s, n) => s + n.totalBomAcCalculated, 0);
    const totalAcQuoted = filteredNodes.reduce((s, n) => s + n.totalBomAcQuoted, 0);
    const diff = totalAcQuoted - totalAcCalc;
    return {
      totalItemCost,
      totalAcCalc,
      totalAcQuoted,
      diff,
      bomCount: filteredNodes.length,
      mainBOMs: filteredNodes.filter(n => n.level === 0).length,
      subBOMs: filteredNodes.filter(n => n.level === 1).length,
      subSubBOMs: filteredNodes.filter(n => n.level >= 2).length
    };
  }, [filteredNodes]);

  // AC Type Summary - based on whether showing included or display-only
  const acTypeSummary = useMemo(() => {
    const summary = new Map<string, { calc: number; quoted: number }>();
    filteredNodes.forEach(node => {
      const costsToUse = showDisplayOnly ? node.displayOnlyCosts : node.includedCosts;
      costsToUse.forEach(cost => {
        if (selectedACTypes.includes('all') || selectedACTypes.includes(cost.cost_name)) {
          const existing = summary.get(cost.cost_name) || { calc: 0, quoted: 0 };
          summary.set(cost.cost_name, {
            calc: existing.calc + cost.calculated_amount,
            quoted: existing.quoted + cost.quoted_amount
          });
        }
      });
    });
    return Array.from(summary.entries())
      .map(([name, data]) => ({ name, calc: data.calc, quoted: data.quoted, diff: data.quoted - data.calc }))
      .sort((a, b) => b.calc - a.calc);
  }, [filteredNodes, selectedACTypes, showDisplayOnly]);

  // Chart data
  const chartData = useMemo(() => {
    return allBOMNodes.filter(n => filteredNodes.some(fn => fn.path === n.path)).slice(0, 10);
  }, [allBOMNodes, filteredNodes]);

  const hasActiveFilters = !selectedBOMs.includes('all') || selectedLevels.length > 0 || !selectedACTypes.includes('all') || searchQuery.trim() !== '';

  const handleClearAllFilters = () => {
    setSelectedBOMs(['all']);
    setSelectedLevels([]);
    setSelectedACTypes(['all']);
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

  // Get AC value for a BOM - from either included or display-only costs
  const getACValue = (node: BOMNode, costName: string) => {
    const costsToUse = showDisplayOnly ? node.displayOnlyCosts : node.includedCosts;
    const cost = costsToUse.find(c => c.cost_name === costName);
    return cost ? { calc: cost.calculated_amount, quoted: cost.quoted_amount } : null;
  };

  // Filtered dropdown lists
  const filteredBOMList = useMemo(() => {
    const codes = [...new Set(bomTree.map(b => b.code))];
    return bomSearch.trim() ? codes.filter(c => c.toLowerCase().includes(bomSearch.toLowerCase())) : codes;
  }, [bomTree, bomSearch]);

  const filteredACTypeList = useMemo(() => {
    return acTypeSearch.trim() ? allACTypes.filter(t => t.toLowerCase().includes(acTypeSearch.toLowerCase())) : allACTypes;
  }, [allACTypes, acTypeSearch]);

  if (!hasRealData) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-800 mb-2">BOM Detail API Required</h3>
          <p className="text-red-600">BOM Additional Costs view requires BOM Detail API data.</p>
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
              <p className="text-sm text-orange-600">Showing {filteredNodes.length} of {allBOMNodes.length} BOMs</p>
            </div>
          </div>
          <button onClick={handleClearAllFilters} className="px-6 py-2.5 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">
            Reset All Filters
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Total BOM AC ({acDisplayMode === 'calculated' ? 'Calc' : 'Quoted'})</div>
            <div className="text-3xl font-bold text-orange-600">
              {currencySymbol}{(acDisplayMode === 'calculated' ? insights.totalAcCalc : insights.totalAcQuoted).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-2">{insights.bomCount} BOM{insights.bomCount !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">Quoted vs Calculated Diff</div>
            <div className={`text-3xl font-bold ${insights.diff > 0 ? 'text-green-600' : insights.diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {insights.diff > 0 ? '+' : ''}{currencySymbol}{insights.diff.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-2">{insights.diff >= 0 ? 'Quoted more' : 'Quoted less'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">AC % of Quote</div>
            <div className="text-3xl font-bold text-blue-600">
              {((insights.totalAcCalc / totalQuoteValue) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-2">of {currencySymbol}{totalQuoteValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold text-gray-700 mb-2">AC Types</div>
            <div className="text-3xl font-bold text-purple-600">{includedACTypes.length}</div>
            <div className="text-xs text-gray-500 mt-2">
              <span className="text-green-600">{includedACTypes.length} included</span>
              {displayOnlyACTypes.length > 0 && (
                <span className="text-gray-400"> + {displayOnlyACTypes.length} display-only</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <h4 className="font-bold text-gray-900 mb-1 text-lg">Top AC Types</h4>
            <p className="text-sm text-gray-600 mb-4">Click to filter</p>
            <div className="space-y-2">
              {acTypeSummary.slice(0, 8).map((item, index) => {
                const maxVal = acTypeSummary[0]?.calc || 1;
                const val = acDisplayMode === 'calculated' ? item.calc : item.quoted;
                const width = (val / maxVal) * 100;
                const hasDiff = Math.abs(item.diff) > 0.01;
                return (
                  <div key={item.name} className="cursor-pointer rounded-lg p-2 -mx-2 hover:bg-gray-50" onClick={() => setSelectedACTypes([item.name])}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1" title={item.name}>
                        {item.name}
                        {hasDiff && <span className={`ml-2 text-xs ${item.diff > 0 ? 'text-green-600' : 'text-red-600'}`}>({item.diff > 0 ? '+' : ''}{currencySymbol}{item.diff.toLocaleString()})</span>}
                      </span>
                      <span className="text-sm font-bold text-gray-700 ml-2">{currencySymbol}{val.toLocaleString()}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${width}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {acTypeSummary.length === 0 && <div className="text-center text-gray-500 py-8">No AC data</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h4 className="font-bold text-gray-900 mb-1 text-lg">AC by BOM</h4>
            <p className="text-sm text-gray-600 mb-4">Top BOMs by additional cost</p>
            <div className="space-y-2">
              {chartData.map((node, index) => {
                const val = acDisplayMode === 'calculated' ? node.totalBomAcCalculated : node.totalBomAcQuoted;
                const maxVal = chartData[0] ? (acDisplayMode === 'calculated' ? chartData[0].totalBomAcCalculated : chartData[0].totalBomAcQuoted) : 1;
                const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={node.path} className="cursor-pointer rounded-lg p-2 -mx-2 hover:bg-gray-50" onClick={() => navigateToTab('bom', { selectedBOM: node.path })}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${node.level === 0 ? 'bg-blue-100 text-blue-700' : node.level === 1 ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                        {LEVEL_LABELS[node.level] || `L${node.level}`}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{node.code}</span>
                      <span className="text-sm font-bold text-gray-700">{currencySymbol}{val.toLocaleString()}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${width}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
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

            {/* BOM Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'bom' ? null : 'bom'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${!selectedBOMs.includes('all') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span>BOM</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{selectedBOMs.includes('all') ? 'All' : selectedBOMs.length}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {openDropdown === 'bom' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-64">
                  <div className="p-2 border-b">
                    <input type="text" placeholder="Search..." value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" onClick={(e) => e.stopPropagation()} />
                  </div>
                  <div className="px-2 py-2 border-b">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedBOMs.includes('all')} onChange={() => setSelectedBOMs(['all'])} className="rounded" />
                      <span className="text-sm font-medium">All BOMs</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredBOMList.map(code => (
                      <label key={code} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${selectedBOMs.includes(code) ? 'bg-blue-50' : ''}`}>
                        <input type="checkbox" checked={selectedBOMs.includes(code)} onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, code))} className="rounded" />
                        <span className="text-sm">{code}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t flex justify-between">
                    <button onClick={() => setSelectedBOMs(['all'])} className="text-xs text-gray-600">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Level Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'level' ? null : 'level'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${selectedLevels.length > 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span>Level</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{selectedLevels.length === 0 ? 'All' : selectedLevels.length}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {openDropdown === 'level' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-56">
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedLevels.length === 0} onChange={() => setSelectedLevels([])} className="rounded" />
                      <span className="text-sm font-medium">All Levels</span>
                    </label>
                    {availableLevels.map(level => (
                      <label key={level} className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer ${selectedLevels.includes(level) ? 'bg-green-50' : ''}`}>
                        <input type="checkbox" checked={selectedLevels.includes(level)} onChange={() => toggleLevel(level)} className="rounded" />
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${level === 0 ? 'bg-blue-100 text-blue-700' : level === 1 ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {LEVEL_LABELS[level] || `L${level}`}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <button onClick={() => setOpenDropdown(null)} className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* AC Type Filter */}
            <div className="relative filter-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'acType' ? null : 'acType'); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium ${!selectedACTypes.includes('all') ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span>AC Type</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{selectedACTypes.includes('all') ? 'All' : selectedACTypes.length}</span>
                <span className="text-gray-400">▼</span>
              </button>
              {openDropdown === 'acType' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-72">
                  <div className="p-2 border-b">
                    <input type="text" placeholder="Search AC types..." value={acTypeSearch} onChange={(e) => setAcTypeSearch(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" onClick={(e) => e.stopPropagation()} />
                  </div>
                  <div className="px-2 py-2 border-b">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedACTypes.includes('all')} onChange={() => setSelectedACTypes(['all'])} className="rounded" />
                      <span className="text-sm font-medium">All AC Types ({allACTypes.length})</span>
                    </label>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredACTypeList.map(type => (
                      <label key={type} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${selectedACTypes.includes(type) ? 'bg-orange-50' : ''}`}>
                        <input type="checkbox" checked={selectedACTypes.includes(type)} onChange={() => setSelectedACTypes(toggleSelection(selectedACTypes, type))} className="rounded" />
                        <span className="text-sm truncate">{type}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t flex justify-between">
                    <button onClick={() => setSelectedACTypes(['all'])} className="text-xs text-gray-600">Clear</button>
                    <button onClick={() => setOpenDropdown(null)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">Done</button>
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
                <option value={100}>100</option>
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
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">BOM Additional Costs Breakdown</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {showDisplayOnly ? (
                    <span className="text-gray-500">{displayOnlyACTypes.length} display-only costs (NOT in totals)</span>
                  ) : (
                    <span className="text-green-700">{includedACTypes.length} costs INCLUDED in totals</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Cost Type Toggle - Included vs Display Only */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Cost Type:</span>
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded">
                    <button
                      onClick={() => setShowDisplayOnly(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1 ${!showDisplayOnly ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-green-300"></span>
                      Included ({includedACTypes.length})
                    </button>
                    <button
                      onClick={() => setShowDisplayOnly(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1 ${showDisplayOnly ? 'bg-gray-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Display Only ({displayOnlyACTypes.length})
                    </button>
                  </div>
                </div>

                {/* Calculated vs Quoted Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Amount:</span>
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded">
                    <button
                      onClick={() => setAcDisplayMode('calculated')}
                      className={`px-2 py-1 text-xs font-medium rounded ${acDisplayMode === 'calculated' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
                    >
                      Calculated
                    </button>
                    <button
                      onClick={() => setAcDisplayMode('quoted')}
                      className={`px-2 py-1 text-xs font-medium rounded ${acDisplayMode === 'quoted' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'}`}
                    >
                      Quoted
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${showDisplayOnly ? 'bg-gray-100 border border-gray-300' : 'bg-green-50 border border-green-200'}`}>
              {showDisplayOnly ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-bold">Display Only Costs:</span>
                  <span className="text-gray-600">These costs (subtotals, gross amounts, etc.) are shown for reference but are <strong>NOT added to BOM totals</strong>.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-bold">Included Costs:</span>
                  <span className="text-green-700">These costs are <strong>ADDED to BOM totals</strong>. Total AC = Sum of all included costs.</span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 w-10">#</th>
                  <th
                    className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 relative"
                    style={{ width: columnWidths['bom_code'] || 120, minWidth: 80 }}
                    onClick={() => handleSort('bom_code')}
                  >
                    BOM Code {sortColumn === 'bom_code' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'bom_code', columnWidths['bom_code'] || 120)} />
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 relative"
                    style={{ width: columnWidths['hierarchy'] || 200, minWidth: 100 }}
                  >
                    Hierarchy
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'hierarchy', columnWidths['hierarchy'] || 200)} />
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-gray-700 border-r border-gray-300 w-24">Level</th>
                  <th
                    className="px-3 py-2.5 text-right font-bold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 relative"
                    style={{ width: columnWidths['item_cost'] || 120, minWidth: 80 }}
                    onClick={() => handleSort('item_cost')}
                  >
                    Item Cost {sortColumn === 'item_cost' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'item_cost', columnWidths['item_cost'] || 120)} />
                  </th>

                  {/* Dynamic AC Type columns - resizable */}
                  {allACTypes.map(acType => (
                    <th
                      key={acType}
                      className={`px-3 py-2.5 text-right font-bold text-orange-700 border-r border-gray-300 cursor-pointer hover:bg-orange-50 whitespace-nowrap relative ${selectedACTypes.includes(acType) && !selectedACTypes.includes('all') ? 'bg-orange-100' : ''}`}
                      style={{ width: columnWidths[`ac_${acType}`] || 130, minWidth: 80 }}
                      onClick={() => handleSort(`ac_${acType}`)}
                      title={`Click to sort by ${acType}. Drag edge to resize.`}
                    >
                      {acType}
                      {sortColumn === `ac_${acType}` && <span className="ml-1 text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, `ac_${acType}`, columnWidths[`ac_${acType}`] || 130)} />
                    </th>
                  ))}

                  <th
                    className="px-3 py-2.5 text-right font-bold bg-blue-50 text-blue-700 border-r border-gray-300 cursor-pointer hover:bg-blue-100 relative"
                    style={{ width: columnWidths['total_ac_calc'] || 120, minWidth: 80 }}
                    onClick={() => handleSort('total_ac_calc')}
                  >
                    Total AC (C) {sortColumn === 'total_ac_calc' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'total_ac_calc', columnWidths['total_ac_calc'] || 120)} />
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-bold bg-green-50 text-green-700 border-r border-gray-300 cursor-pointer hover:bg-green-100 relative"
                    style={{ width: columnWidths['total_ac_quoted'] || 120, minWidth: 80 }}
                    onClick={() => handleSort('total_ac_quoted')}
                  >
                    Total AC (Q) {sortColumn === 'total_ac_quoted' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'total_ac_quoted', columnWidths['total_ac_quoted'] || 120)} />
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-bold bg-blue-50 text-blue-700 border-r border-gray-300 cursor-pointer hover:bg-blue-100 relative"
                    style={{ width: columnWidths['total_calc'] || 130, minWidth: 80 }}
                    onClick={() => handleSort('total_calc')}
                  >
                    BOM Total (C) {sortColumn === 'total_calc' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'total_calc', columnWidths['total_calc'] || 130)} />
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-bold bg-green-50 text-green-700 border-r border-gray-300 cursor-pointer hover:bg-green-100 relative"
                    style={{ width: columnWidths['total_quoted'] || 130, minWidth: 80 }}
                    onClick={() => handleSort('total_quoted')}
                  >
                    BOM Total (Q) {sortColumn === 'total_quoted' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => startResize(e, 'total_quoted', columnWidths['total_quoted'] || 130)} />
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold text-gray-700 w-28" title="Quoted - Calculated: Shows manual overrides during negotiation">Q - C Diff</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {paginatedNodes.map((node, idx) => {
                  const acDiff = node.totalBomAcQuoted - node.totalBomAcCalculated;
                  const totalDiff = node.totalQuotedAmount - node.totalCalculatedAmount;
                  const hasAcDiff = Math.abs(acDiff) > 0.01;

                  return (
                    <tr key={node.path} className={`border-b border-gray-200 hover:bg-blue-50 ${node.level > 0 ? 'bg-gray-50' : ''}`}>
                      <td className="px-3 py-2.5 text-gray-600 border-r border-gray-200">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        <span className="font-mono font-medium text-gray-900">{node.code}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 border-r border-gray-200 font-mono text-xs" title={node.path}>
                        {node.path}
                      </td>
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${node.level === 0 ? 'bg-blue-100 text-blue-700' : node.level === 1 ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {LEVEL_LABELS[node.level] || `L${node.level}`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700 border-r border-gray-200">
                        {currencySymbol}{node.totalItemCost.toLocaleString()}
                      </td>

                      {/* AC Type values */}
                      {allACTypes.map(acType => {
                        const acVal = getACValue(node, acType);
                        const calcVal = acVal?.calc ?? 0;
                        const quotedVal = acVal?.quoted ?? 0;
                        const displayVal = acDisplayMode === 'calculated' ? calcVal : quotedVal;
                        const hasDiff = Math.abs(quotedVal - calcVal) > 0.01;

                        return (
                          <td key={acType} className={`px-3 py-2.5 text-right border-r border-gray-200 ${selectedACTypes.includes(acType) && !selectedACTypes.includes('all') ? 'bg-orange-50' : ''}`}>
                            {displayVal > 0 ? (
                              <span className={`font-mono font-semibold ${hasDiff ? 'text-green-600' : 'text-orange-600'}`}>
                                {currencySymbol}{displayVal.toLocaleString()}
                              </span>
                            ) : acVal ? (
                              <span className="text-gray-400 text-xs italic">Included in Rate</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total AC (Calculated) */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-600 border-r border-gray-200 bg-blue-50">
                        {currencySymbol}{node.totalBomAcCalculated.toLocaleString()}
                      </td>
                      {/* Total AC (Quoted) */}
                      <td className={`px-3 py-2.5 text-right font-mono font-bold border-r border-gray-200 bg-green-50 ${hasAcDiff ? 'text-green-600' : 'text-green-700'}`}>
                        {currencySymbol}{node.totalBomAcQuoted.toLocaleString()}
                      </td>
                      {/* BOM Total (Calculated) */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700 border-r border-gray-200 bg-blue-50">
                        {currencySymbol}{node.totalCalculatedAmount.toLocaleString()}
                      </td>
                      {/* BOM Total (Quoted) */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 border-r border-gray-200 bg-green-50">
                        {currencySymbol}{node.totalQuotedAmount.toLocaleString()}
                      </td>
                      {/* Difference: Quoted - Calculated */}
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold ${totalDiff > 0 ? 'text-green-600 bg-green-50' : totalDiff < 0 ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}
                        title={totalDiff !== 0 ? `Quoted (${currencySymbol}${node.totalQuotedAmount.toLocaleString()}) - Calculated (${currencySymbol}${node.totalCalculatedAmount.toLocaleString()}) = ${currencySymbol}${totalDiff.toLocaleString()}` : 'No difference'}
                      >
                        {Math.abs(totalDiff) > 0.01 ? (
                          <span>
                            {totalDiff > 0 ? '+' : ''}{currencySymbol}{totalDiff.toLocaleString()}
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-sm text-gray-600">Showing {paginatedNodes.length} of {sortedNodes.length} BOMs</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={`px-2 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 hover:bg-gray-200'}`}>««</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>← Prev</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>Next →</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={`px-2 py-1 rounded text-sm ${currentPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 hover:bg-gray-200'}`}>»»</button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
