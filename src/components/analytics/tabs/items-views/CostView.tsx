import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { CostViewData } from '../../../../services/api';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import type { ItemViewType } from '../ItemsTab';

interface CostViewProps {
    data: TopItemsAnalytics;
    costViewData: CostViewData;
    totalQuoteValue: number;
    totalItems: number;
    navigationContext?: NavigationContext;
    navigateToTab: (tab: TabType, context?: NavigationContext) => void;
    setSelectedView?: (view: ItemViewType) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
    'EVENT': { bg: '#8b5cf6', text: '#ffffff' },
    'PROJECT': { bg: '#3b82f6', text: '#ffffff' },
    'QUOTE': { bg: '#10b981', text: '#ffffff' }
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function CostView({
    data,
    costViewData,
    totalQuoteValue,
    totalItems,
    navigationContext,
    navigateToTab,
    setSelectedView
}: CostViewProps) {
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Filters
    const [selectedBOMs, setSelectedBOMs] = useState<string[]>(['all']);
    const [selectedVendors, setSelectedVendors] = useState<string[]>(['all']);
    const [selectedTags, setSelectedTags] = useState<string[]>(['all']);
    const [percentThreshold, setPercentThreshold] = useState(0);
    const [sortMode, setSortMode] = useState<'with-ac' | 'rate-only'>('with-ac');
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    // Auto-select BOM from navigation context
    React.useEffect(() => {
        if (navigationContext?.selectedBOM) {
            setSelectedBOMs([navigationContext.selectedBOM]);
            setFiltersExpanded(true);
        }
    }, [navigationContext]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [selectedBOMs, selectedVendors, selectedTags, percentThreshold, sortMode, pageSize]);

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

    // Get unique tags from filters
    const uniqueTags = useMemo(() => {
        if (costViewData.filters?.tag_list?.length > 0) {
            return costViewData.filters.tag_list;
        }
        const tagsSet = new Set<string>();
        costViewData.items.forEach(item => {
            item.tags.forEach(tag => tagsSet.add(tag));
        });
        return Array.from(tagsSet).sort();
    }, [costViewData]);

    // Get unique BOM paths from all items
    const uniqueBOMPaths = useMemo(() => {
        const bomSet = new Set<string>();
        costViewData.items.forEach(item => {
            bomSet.add(item.bom_path);
        });
        return Array.from(bomSet).sort((a, b) => {
            const aDepth = a.split(' > ').length;
            const bDepth = b.split(' > ').length;
            if (aDepth !== bDepth) return aDepth - bDepth;
            return a.localeCompare(b);
        });
    }, [costViewData.items]);

    // Get vendors from filters
    const vendors = useMemo(() => {
        return costViewData.filters?.vendor_list || [];
    }, [costViewData.filters]);

    // Filter and sort ALL items
    const filteredItems = useMemo(() => {
        let items = [...costViewData.items];

        // Apply BOM filter
        if (!selectedBOMs.includes('all')) {
            items = items.filter(item => selectedBOMs.includes(item.bom_path));
        }

        // Apply Vendor filter
        if (!selectedVendors.includes('all')) {
            items = items.filter(item => item.vendor_name && selectedVendors.includes(item.vendor_name));
        }

        // Apply Tags filter
        if (!selectedTags.includes('all')) {
            items = items.filter(item => item.tags.some(tag => selectedTags.includes(tag)));
        }

        // Apply percent threshold filter
        items = items.filter(item => item.percent_of_quote >= percentThreshold);

        // Sort based on mode
        if (sortMode === 'with-ac') {
            items.sort((a, b) => b.total_amount - a.total_amount);
        } else {
            items.sort((a, b) => b.total_item_cost - a.total_item_cost);
        }

        return items;
    }, [costViewData.items, selectedBOMs, selectedVendors, selectedTags, percentThreshold, sortMode]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredItems.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    // Calculate insights from ALL filtered data
    const insights = useMemo(() => {
        const costField = sortMode === 'with-ac' ? 'total_amount' : 'total_item_cost';
        const total = filteredItems.reduce((sum, item) => sum + item[costField], 0);
        const totalAC = filteredItems.reduce((sum, item) => sum + item.total_additional_cost, 0);
        const maxCost = Math.max(...filteredItems.map(i => i[costField]), 0);
        const grandTotal = costViewData.summary.grand_total;

        return {
            total,
            totalAC,
            percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
            maxCost,
            count: filteredItems.length,
            grandTotal
        };
    }, [filteredItems, costViewData.summary, sortMode]);

    // Chart data for cost distribution (top 6 items)
    const costDistributionData = useMemo(() => {
        const costField = sortMode === 'with-ac' ? 'total_amount' : 'total_item_cost';
        return filteredItems.slice(0, 6).map(item => ({
            name: item.item_code,
            cost: item[costField],
            itemCost: item.total_item_cost,
            ac: item.total_additional_cost,
            percent: item.percent_of_quote
        }));
    }, [filteredItems, sortMode]);

    // BOM breakdown pie chart data
    const bomBreakdownData = useMemo(() => {
        const bomTotals = new Map<string, number>();
        const costField = sortMode === 'with-ac' ? 'total_amount' : 'total_item_cost';
        filteredItems.forEach(item => {
            const mainBom = item.bom_path.split(' > ')[0];
            bomTotals.set(mainBom, (bomTotals.get(mainBom) || 0) + item[costField]);
        });

        return Array.from(bomTotals.entries()).map(([bom, cost]) => ({
            name: bom,
            value: cost
        }));
    }, [filteredItems, sortMode]);

    // Page navigation helpers
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    return (
        <div className="space-y-4">
            {/* Filters Bar */}
            <Card className="border-gray-200">
                <CardContent className="p-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">
                                BOMs: {selectedBOMs.includes('all') ? 'All' : selectedBOMs.length + ' selected'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">
                                Vendors: {selectedVendors.includes('all') ? 'All' : `${selectedVendors.length} selected`}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">
                                Tags: {selectedTags.includes('all') ? 'All' : `${selectedTags.length} selected`}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">Min % Quote:</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={percentThreshold === 0 ? '' : percentThreshold}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setPercentThreshold(0);
                                    } else {
                                        const num = Number(val);
                                        if (!isNaN(num)) {
                                            setPercentThreshold(Math.min(100, Math.max(0, num)));
                                        }
                                    }
                                }}
                                placeholder="0"
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-500">%</span>
                        </div>

                        {/* Sort Mode Toggle */}
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded border border-blue-200">
                            <span className="text-sm font-semibold text-blue-900">Sort By:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setSortMode('with-ac')}
                                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                        sortMode === 'with-ac'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white text-gray-700 hover:bg-blue-100'
                                    }`}
                                >
                                    With Item AC
                                </button>
                                <button
                                    onClick={() => setSortMode('rate-only')}
                                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                        sortMode === 'rate-only'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white text-gray-700 hover:bg-blue-100'
                                    }`}
                                >
                                    Rate Only
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setFiltersExpanded(!filtersExpanded)}
                            className="ml-auto px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                        >
                            {filtersExpanded ? '▲ Less' : '▼ More Filters'}
                        </button>

                        {(!selectedBOMs.includes('all') || !selectedVendors.includes('all') || !selectedTags.includes('all') || percentThreshold !== 0 || sortMode !== 'with-ac') && (
                            <button
                                onClick={() => {
                                    setSelectedBOMs(['all']);
                                    setSelectedVendors(['all']);
                                    setSelectedTags(['all']);
                                    setPercentThreshold(0);
                                    setSortMode('with-ac');
                                }}
                                className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>

                    {/* Advanced Filters (Collapsible) */}
                    {filtersExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                            <div className="grid grid-cols-3 gap-4">
                                {/* BOMs */}
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-gray-700 mb-2">BOMs:</div>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedBOMs.includes('all')}
                                            onChange={() => setSelectedBOMs(['all'])}
                                            className="rounded"
                                        />
                                        <span className="font-medium">All</span>
                                    </label>
                                    {uniqueBOMPaths.map(bomPath => (
                                        <label key={bomPath} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedBOMs.includes(bomPath)}
                                                onChange={() => setSelectedBOMs(toggleSelection(selectedBOMs, bomPath))}
                                                className="rounded"
                                            />
                                            <span>{bomPath.replace(/ > /g, ' → ')}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Vendors */}
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-gray-700 mb-2">Vendors:</div>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedVendors.includes('all')}
                                            onChange={() => setSelectedVendors(['all'])}
                                            className="rounded"
                                        />
                                        <span className="font-medium">All</span>
                                    </label>
                                    {vendors.map(vendor => (
                                        <label key={vendor.vendor_id} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedVendors.includes(vendor.vendor_name)}
                                                onChange={() => setSelectedVendors(toggleSelection(selectedVendors, vendor.vendor_name))}
                                                className="rounded"
                                            />
                                            <span className="truncate">{vendor.vendor_name}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Tags */}
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-gray-700 mb-2">Tags:</div>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedTags.includes('all')}
                                            onChange={() => setSelectedTags(['all'])}
                                            className="rounded"
                                        />
                                        <span className="font-medium">All</span>
                                    </label>
                                    {uniqueTags.slice(0, 10).map(tag => (
                                        <label key={tag} className="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedTags.includes(tag)}
                                                onChange={() => setSelectedTags(toggleSelection(selectedTags, tag))}
                                                className="rounded"
                                            />
                                            <span className="truncate">{tag}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Key Insights Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-gray-200">
                    <CardContent className="p-5">
                        <div className="text-sm font-bold text-gray-700 mb-2">
                            {sortMode === 'with-ac' ? 'Total (With Item AC)' : 'Total (Rate Only)'}
                        </div>
                        <div className="text-3xl font-bold text-blue-600">₹{insights.total.toLocaleString()}</div>
                        <div className="text-sm text-gray-600 mt-2">{insights.percent.toFixed(1)}% of quote</div>
                        <div className="text-sm text-gray-600">{insights.count} items</div>
                    </CardContent>
                </Card>

                <Card className="border-gray-200">
                    <CardContent className="p-5">
                        <div className="text-sm font-bold text-gray-700 mb-2">Item Additional Costs</div>
                        <div className="text-3xl font-bold text-orange-600">₹{insights.totalAC.toLocaleString()}</div>
                        <div className="text-sm text-gray-600 mt-2">
                            {insights.total > 0 ? ((insights.totalAC / insights.total) * 100).toFixed(1) : 0}% of total
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-gray-200">
                    <CardContent className="p-5">
                        <div className="text-sm font-bold text-gray-700 mb-2">Highest Cost</div>
                        <div className="text-3xl font-bold text-green-600">₹{insights.maxCost.toLocaleString()}</div>
                        {filteredItems.length > 0 && (
                            <div className="text-sm font-semibold text-gray-600 mt-2">{filteredItems[0].item_code}</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-gray-200">
                    <CardContent className="p-5">
                        <div className="text-sm font-bold text-gray-700 mb-2">Items Shown</div>
                        <div className="text-3xl font-bold text-purple-600">{insights.count}</div>
                        <div className="text-sm text-gray-600 mt-2">of {costViewData.summary.total_costing_sheet_items} total</div>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Charts */}
            <div className="grid grid-cols-2 gap-4">
                {/* Cost Distribution Bar Chart */}
                <Card className="border-gray-200">
                    <CardContent className="p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                            Top Items by {sortMode === 'with-ac' ? 'Total Cost (With Item AC)' : 'Item Cost (Rate Only)'}
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={costDistributionData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value: number, _name: string, props: any) => {
                                        if (sortMode === 'with-ac') {
                                            return [
                                                `Total: ₹${value.toLocaleString()} | Item Cost: ₹${props.payload.itemCost.toLocaleString()} | AC: ₹${props.payload.ac.toLocaleString()} (${props.payload.percent.toFixed(2)}% of quote)`,
                                                'Total Cost'
                                            ];
                                        } else {
                                            return [
                                                `Item Cost: ₹${value.toLocaleString()} | AC: ₹${props.payload.ac.toLocaleString()} (${props.payload.percent.toFixed(2)}% of quote)`,
                                                'Item Cost Only'
                                            ];
                                        }
                                    }}
                                    labelFormatter={(label) => `Item: ${label}`}
                                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                                />
                                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* BOM Breakdown Pie Chart */}
                <Card className="border-gray-200">
                    <CardContent className="p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                            {sortMode === 'with-ac' ? 'Total Cost' : 'Item Cost'} Split by BOM
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={bomBreakdownData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry) => `${entry.name}: ₹${(entry.value / 1000).toFixed(0)}k`}
                                    outerRadius={70}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {bomBreakdownData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => {
                                        const percent = insights.total > 0 ? (value / insights.total) * 100 : 0;
                                        return [`₹${value.toLocaleString()} - ${percent.toFixed(1)}%`, 'Cost in this BOM'];
                                    }}
                                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Items Table */}
            <Card className="border-gray-300 shadow-sm">
                <CardContent className="p-0">
                    {/* Table Header with Pagination Controls */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-300 flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900 text-sm">
                            Item Details - {sortMode === 'with-ac' ? 'Sorted by Total (With Item AC)' : 'Sorted by Rate Only'}
                        </h4>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                >
                                    {PAGE_SIZE_OPTIONS.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-sm text-gray-600">
                                Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} of {filteredItems.length}
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-400">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">#</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Code</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Item Name</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-xs">Tags</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">Vendor</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs">BOM</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-xs">Source</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Quantity</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Rate</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Additional Cost</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700 border-r border-gray-300 text-xs">Total</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">% of Quote</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {paginatedItems.map((item, idx) => (
                                    <tr key={`${item.item_id}-${item.bom_path}`} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">{startIndex + idx + 1}</td>
                                        <td className="px-3 py-2 font-mono text-xs text-gray-900 border-r border-gray-200 font-medium">{item.item_code}</td>
                                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 max-w-xs truncate text-xs" title={item.item_name}>
                                            {item.item_name}
                                        </td>

                                        {/* Tags - show count with hover */}
                                        <td className="px-3 py-2 border-r border-gray-200 text-center">
                                            {item.tags.length > 0 ? (
                                                <span
                                                    className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold cursor-default"
                                                    title={item.tags.join(', ')}
                                                >
                                                    {item.tags.length}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>

                                        {/* Vendor - Clickable */}
                                        <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer">
                                            <button
                                                onClick={() => {
                                                    if (setSelectedView && item.vendor_name) {
                                                        setSelectedView('vendor');
                                                        navigateToTab('items', { selectedVendor: item.vendor_name, selectedItem: item.item_code });
                                                    }
                                                }}
                                                className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                                            >
                                                {item.vendor_name || '-'}
                                            </button>
                                        </td>

                                        {/* BOM - Clickable */}
                                        <td className="px-3 py-2 border-r border-gray-200 group cursor-pointer">
                                            <button
                                                onClick={() => navigateToTab('bom', { selectedBOM: item.bom_path })}
                                                className="text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-medium w-full text-left"
                                            >
                                                {item.bom_path.replace(/ > /g, ' → ')}
                                            </button>
                                        </td>

                                        {/* Source */}
                                        <td className="px-3 py-2 text-center border-r border-gray-200">
                                            <span
                                                className="inline-block px-2 py-1 rounded text-xs font-semibold"
                                                style={{
                                                    backgroundColor: SOURCE_COLORS[item.item_source]?.bg || '#f3f4f6',
                                                    color: SOURCE_COLORS[item.item_source]?.text || '#374151'
                                                }}
                                            >
                                                {item.item_source}
                                            </span>
                                        </td>

                                        <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200 text-xs">
                                            {item.quantity} {item.unit}
                                        </td>

                                        {/* Rate - Clickable */}
                                        <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer">
                                            <button
                                                onClick={() => {
                                                    if (setSelectedView) {
                                                        setSelectedView('rate');
                                                        navigateToTab('items', { selectedItem: item.item_code });
                                                    }
                                                }}
                                                className="font-mono text-xs text-blue-700 group-hover:text-blue-900 group-hover:underline font-semibold w-full text-right"
                                            >
                                                ₹{item.quoted_rate.toFixed(2)}
                                            </button>
                                        </td>

                                        {/* Item AC - Clickable */}
                                        <td className="px-3 py-2 text-right border-r border-gray-200 group cursor-pointer">
                                            <button
                                                onClick={() => {
                                                    if (setSelectedView) {
                                                        setSelectedView('additional-costs');
                                                        navigateToTab('items', { selectedItem: item.item_code });
                                                    }
                                                }}
                                                className="font-mono text-xs text-orange-700 group-hover:text-orange-900 group-hover:underline font-semibold block w-full text-right"
                                            >
                                                ₹{item.total_additional_cost.toLocaleString()}
                                            </button>
                                        </td>

                                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 border-r border-gray-200 text-xs">
                                            ₹{item.total_amount.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600 text-xs">{item.percent_of_quote.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls at Bottom */}
                    {totalPages > 1 && (
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-300 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    First
                                </button>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Prev
                                </button>

                                {/* Page Numbers */}
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => goToPage(pageNum)}
                                                className={`px-3 py-1 text-sm rounded ${
                                                    currentPage === pageNum
                                                        ? 'bg-blue-600 text-white'
                                                        : 'border border-gray-300 hover:bg-gray-100'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                                <button
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Last
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-sm text-gray-600">
                        <span className="font-medium">Note:</span> Click on Vendor, BOM, Rate, or Additional Cost values to navigate to respective views.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
