import { useState, useMemo } from 'react';
import * as React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import type { TopItemsAnalytics } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';
import { useBOMInstances } from '../../../../hooks/useBOMInstances';
import BOMInstanceFilter, { BOMInstanceFilterPills, getBOMInstanceFilterText } from '../../shared/BOMInstanceFilter';

interface ItemSourceViewProps {
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  navigationContext?: NavigationContext;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

type SourceType = 'Event' | 'Project' | 'Quote';
type StatusType = 'Present' | 'Removed';

interface ItemWithSource {
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  totalCost: number;
  pipeline: SourceType[];
  currentStatus: StatusType;
  removedAt?: SourceType;
  removedBy?: string;
  removalReason?: string;
  bomPath: string;
  category: string;
  vendor: string;
  bom_instance_id: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const STAGE_COLORS: Record<SourceType, string> = {
  'Event': '#8b5cf6',
  'Project': '#3b82f6',
  'Quote': '#10b981'
};

export default function ItemSourceView({
  data,
  totalQuoteValue,
  navigationContext,
  navigateToTab
}: ItemSourceViewProps) {
  const [selectedBOMInstances, setSelectedBOMInstances] = useState<string[]>(['all']);
  const [selectedSources, setSelectedSources] = useState<string[]>(['all']);
  const [selectedStatus, setSelectedStatus] = useState<StatusType | 'All'>('All');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Auto-select source from navigation context
  React.useEffect(() => {
    if (navigationContext?.selectedSource) {
      setSelectedSources([navigationContext.selectedSource]);
      setFiltersExpanded(true); // Expand filters to show what's selected
    }
  }, [navigationContext]);

  // Helper function to toggle multi-select (same as CostView)
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

  // Generate mock item source data
  const itemsWithSource = useMemo<ItemWithSource[]>(() => {
    const items: ItemWithSource[] = [];

    // Current quote items (Present)
    data.overall.forEach((item, idx) => {
      // 70% from full pipeline (Project → Event → RFQ → Quote)
      // 20% from Event → RFQ → Quote (no Project)
      // 10% added directly in Quote
      const rand = Math.random();
      let pipeline: SourceType[];

      if (rand < 0.7) {
        pipeline = ['Project', 'Event', 'Quote'];
      } else if (rand < 0.9) {
        pipeline = ['Event', 'Quote'];
      } else {
        pipeline = ['Quote'];
      }

      items.push({
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        totalCost: item.totalCost,
        pipeline,
        currentStatus: 'Present',
        bomPath: item.bomPath,
        category: item.category,
        vendor: item.vendor,
        bom_instance_id: item.bom_instance_id || 'default'
      });
    });

    // Generate removed items (these never made it to Quote)
    // Use variations of actual item names to make them realistic
    const removedItemsCount = Math.floor(data.overall.length * 2.3); // 350 removed if 150 present

    const itemPrefixes = [
      'Motor', 'Pump', 'Valve', 'Bearing', 'Seal', 'Gasket', 'Coupling', 'Shaft',
      'Gear', 'Switch', 'Sensor', 'Cable', 'Connector', 'Housing', 'Bracket',
      'Bolt', 'Nut', 'Washer', 'Spring', 'Pin', 'Clip', 'Clamp', 'Hose',
      'Filter', 'Fan', 'Heater', 'Cooler', 'Tank', 'Pipe', 'Fitting'
    ];

    const itemSuffixes = [
      '2HP', '5HP', '10HP', '15mm', '20mm', '25mm', '50mm', '100mm',
      'Heavy Duty', 'Standard', 'Premium', 'Industrial', 'Commercial',
      'Type A', 'Type B', 'Grade 304', 'Grade 316', 'Carbon Steel',
      'Stainless', 'Aluminum', 'Brass', 'Plastic', 'Rubber'
    ];

    for (let i = 0; i < removedItemsCount; i++) {
      const rand = Math.random();
      let pipeline: SourceType[];
      let removedAt: SourceType;

      // Distribute removals across stages (Project → Event → Quote)
      if (rand < 0.3) {
        // Removed after Project (never made it to Event)
        pipeline = ['Project'];
        removedAt = 'Project';
      } else {
        // Removed after Event (never made it to Quote)
        pipeline = ['Project', 'Event'];
        removedAt = 'Event';
      }

      // Generate realistic item name and code
      const prefix = itemPrefixes[Math.floor(Math.random() * itemPrefixes.length)];
      const suffix = itemSuffixes[Math.floor(Math.random() * itemSuffixes.length)];
      const itemName = `${prefix} ${suffix}`;
      const itemCode = `${prefix.toUpperCase().slice(0, 4)}-${String(i + 1).padStart(3, '0')}`;

      const avgCost = data.overall.reduce((sum, item) => sum + item.totalCost, 0) / data.overall.length;
      const mockCost = avgCost * (0.5 + Math.random());

      // Pick a random actual item to copy realistic data from
      const templateItem = data.overall[Math.floor(Math.random() * data.overall.length)];

      items.push({
        itemCode,
        itemName,
        quantity: Math.floor(Math.random() * 50) + 1,
        unit: templateItem.unit,
        totalCost: mockCost,
        pipeline,
        currentStatus: 'Removed',
        removedAt,
        removedBy: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Sarah Wilson', 'Mike Chen'][Math.floor(Math.random() * 5)],
        removalReason: ['Cost too high', 'Not needed', 'Vendor unavailable', 'Replaced with alternative', 'Out of stock', 'Lead time too long', 'Specification changed'][Math.floor(Math.random() * 7)],
        bomPath: templateItem.bomPath,
        category: templateItem.category,
        vendor: templateItem.vendor,
        bom_instance_id: templateItem.bom_instance_id || 'default'
      });
    }

    return items;
  }, [data]);

  // Use shared BOM instances hook for volume scenario detection
  const { bomInstances, hasVolumeScenarios, filterByInstance } = useBOMInstances(itemsWithSource);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = itemsWithSource;

    // Apply BOM Instance filter (for volume scenarios)
    if (!selectedBOMInstances.includes('all')) {
      result = result.filter(item =>
        selectedBOMInstances.includes(item.bom_instance_id)
      );
    }

    return result.filter(item => {
      // Source filter - filter by ORIGIN SOURCE (first stage in pipeline)
      if (!selectedSources.includes('all')) {
        const originSource = item.pipeline[0]; // First stage = origin
        if (!selectedSources.includes(originSource)) return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && item.currentStatus !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [itemsWithSource, selectedBOMInstances, selectedSources, selectedStatus]);

  // Calculate insights
  const insights = useMemo(() => {
    const presentItems = itemsWithSource.filter(i => i.currentStatus === 'Present');
    const removedItems = itemsWithSource.filter(i => i.currentStatus === 'Removed');

    const presentCount = presentItems.length;
    const removedCount = removedItems.length;
    const totalStarted = presentCount + removedCount;

    const presentValue = presentItems.reduce((sum, item) => sum + item.totalCost, 0);
    const removedValue = removedItems.reduce((sum, item) => sum + item.totalCost, 0);

    // Count by removal stage (Project → Event → Quote)
    const removedAtProject = removedItems.filter(i => i.removedAt === 'Project').length;
    const removedAtEvent = removedItems.filter(i => i.removedAt === 'Event').length;

    // Source distribution (for present items)
    const fromProject = presentItems.filter(i => i.pipeline.includes('Project')).length;
    const fromEvent = presentItems.filter(i => i.pipeline.includes('Event') && !i.pipeline.includes('Project')).length;
    const fromQuote = presentItems.filter(i => i.pipeline.length === 1 && i.pipeline[0] === 'Quote').length;

    return {
      presentCount,
      removedCount,
      totalStarted,
      presentValue,
      removedValue,
      totalValue: presentValue + removedValue,
      removalRate: ((removedCount / totalStarted) * 100).toFixed(1),
      removedAtProject,
      removedAtEvent,
      fromProject,
      fromEvent,
      fromQuote
    };
  }, [itemsWithSource]);

  // Waterfall chart data - shows progressive drop-off (Project → Event → Quote)
  const waterfallData = useMemo(() => {
    // Use FILTERED data so charts respond to filters
    const allItems = filteredItems;
    const removedItems = allItems.filter(i => i.currentStatus === 'Removed');
    const presentItems = allItems.filter(i => i.currentStatus === 'Present');

    // Calculate removals at each stage
    const removedAtProject = removedItems.filter(i => i.removedAt === 'Project').length;
    const removedAtEvent = removedItems.filter(i => i.removedAt === 'Event').length;

    // Start with total items
    const totalStarted = allItems.length;

    // Progressive counts (remaining after each removal)
    const afterProjectRemoval = totalStarted - removedAtProject;
    const afterEventRemoval = afterProjectRemoval - removedAtEvent;
    const finalQuote = presentItems.length; // Items in final quote

    // Waterfall structure: each bar shows remaining items at that stage
    return [
      {
        stage: 'Started\n(Project)',
        remaining: totalStarted,
        removed: 0
      },
      {
        stage: 'After Project',
        remaining: afterProjectRemoval,
        removed: removedAtProject
      },
      {
        stage: 'After Event',
        remaining: afterEventRemoval,
        removed: removedAtEvent
      },
      {
        stage: 'Final Quote',
        remaining: finalQuote,
        removed: 0
      }
    ];
  }, [filteredItems]);

  // Source distribution pie chart - should reflect filtered data
  const sourceDistribution = useMemo(() => {
    // Use filteredItems so it responds to filters
    const presentItems = filteredItems.filter(i => i.currentStatus === 'Present');

    return [
      {
        name: 'Project',
        value: presentItems.filter(i => i.pipeline.includes('Project')).length,
        color: STAGE_COLORS.Project
      },
      {
        name: 'Event',
        value: presentItems.filter(i => i.pipeline.includes('Event')).length,
        color: STAGE_COLORS.Event
      },
      {
        name: 'Quote',
        value: presentItems.filter(i => i.pipeline.includes('Quote')).length,
        color: STAGE_COLORS.Quote
      }
    ].filter(d => d.value > 0);
  }, [filteredItems]);

  // Items missing from projects - Mock data showing items in projects but not in quote
  const missingFromProjects = useMemo(() => {
    // Mock: Different categories have different missing counts
    const categories = ['Electronics', 'Mechanical', 'Hardware', 'Software', 'Tooling'];
    return categories.map(cat => ({
      category: cat,
      inProject: Math.floor(Math.random() * 50) + 20,
      inQuote: Math.floor(Math.random() * 40) + 10,
      missing: 0
    })).map(item => ({
      ...item,
      missing: item.inProject - item.inQuote
    }));
  }, []);

  // Items with no bids - Mock data
  const noBidsData = useMemo(() => {
    const presentItems = itemsWithSource.filter(i => i.currentStatus === 'Present');
    const total = presentItems.length;

    // Mock: 15% have no bids, 70% have bids, 15% have partial bids
    const noBids = Math.floor(total * 0.15);
    const hasBids = Math.floor(total * 0.70);
    const partialBids = total - noBids - hasBids;

    return [
      { name: 'No Bids Received', value: noBids, color: '#ef4444' },
      { name: 'All Bids Received', value: hasBids, color: '#10b981' },
      { name: 'Partial Bids', value: partialBids, color: '#f59e0b' }
    ];
  }, [itemsWithSource]);

  // Items with bids but not exported - Mock data by vendor
  const bidsNotExported = useMemo(() => {
    const vendors = ['Vendor A', 'Vendor B', 'Vendor C', 'Vendor D', 'Vendor E'];
    return vendors.map(vendor => ({
      vendor,
      totalBids: Math.floor(Math.random() * 40) + 20,
      exported: Math.floor(Math.random() * 35) + 15,
      notExported: 0
    })).map(item => ({
      ...item,
      notExported: item.totalBids - item.exported
    }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-gray-200">
        <CardContent className="p-3">
          <div className="space-y-3">
            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="font-semibold text-gray-700">
                Showing: {filteredItems.length} items
              </span>

              {hasVolumeScenarios && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">
                    {getBOMInstanceFilterText(selectedBOMInstances, bomInstances)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">
                  Sources: {selectedSources.includes('all') ? 'All' : selectedSources.join(', ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">
                  Status: {selectedStatus}
                </span>
              </div>

              {/* Expand/Collapse Advanced Filters */}
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="ml-auto px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {filtersExpanded ? '▲ Less' : '▼ More Filters'}
              </button>

              {(!selectedBOMInstances.includes('all') || !selectedSources.includes('all') || selectedStatus !== 'All') && (
                <button
                  onClick={() => {
                    setSelectedBOMInstances(['all']);
                    setSelectedSources(['all']);
                    setSelectedStatus('All');
                  }}
                  className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            {filtersExpanded && (
              <div className="pt-3 border-t border-gray-200 space-y-3">
                {/* BOM Instance Filter */}
                <BOMInstanceFilter
                  bomInstances={bomInstances}
                  selectedInstances={selectedBOMInstances}
                  onSelectionChange={setSelectedBOMInstances}
                  hasVolumeScenarios={hasVolumeScenarios}
                />

                {/* Source Filter - Multi-select */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Filter by Source:</div>
                  <div className="flex flex-wrap gap-2">
                    <label
                      className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer text-xs ${
                        selectedSources.includes('all')
                          ? 'bg-blue-100 border-blue-500 text-blue-900'
                          : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSources.includes('all')}
                        onChange={() => setSelectedSources(['all'])}
                      />
                      <span>All</span>
                    </label>
                    {(['Project', 'Event', 'Quote'] as SourceType[]).map(source => (
                      <label
                        key={source}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer text-xs ${
                          selectedSources.includes(source)
                            ? 'bg-blue-100 border-blue-500 text-blue-900'
                            : 'bg-gray-50 border-gray-300 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(source)}
                          onChange={() => setSelectedSources(toggleSelection(selectedSources, source))}
                        />
                        <span>{source}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Filter by Status:</div>
                  <div className="flex flex-wrap gap-2">
                    {(['All', 'Present', 'Removed'] as (StatusType | 'All')[]).map(status => (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(status)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          selectedStatus === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'All' ? 'All Status' : status === 'Present' ? 'Present in Quote' : 'Removed'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Filter Pills */}
      <BOMInstanceFilterPills
        selectedInstances={selectedBOMInstances}
        bomInstances={bomInstances}
        onRemove={(instanceId) => {
          const newSelection = selectedBOMInstances.filter(id => id !== instanceId);
          setSelectedBOMInstances(newSelection.length === 0 ? ['all'] : newSelection);
        }}
        onClear={() => setSelectedBOMInstances(['all'])}
      />

      {/* Summary Cards - Clickable to filter */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          className="border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => setSelectedStatus('All')}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Started</div>
            <div className="text-2xl font-bold text-gray-900">{insights.totalStarted}</div>
            <div className="text-xs text-gray-500 mt-1">${(insights.totalValue / 1000).toFixed(0)}k value</div>
            <div className="text-xs text-blue-600 hover:underline mt-1 font-medium">
              Click to show all →
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-green-400 transition-colors cursor-pointer"
          onClick={() => setSelectedStatus('Present')}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Present in Quote</div>
            <div className="text-2xl font-bold text-green-600">{insights.presentCount}</div>
            <div className="text-xs text-gray-500 mt-1">${(insights.presentValue / 1000).toFixed(0)}k value</div>
            <div className="text-xs text-blue-600 hover:underline mt-1 font-medium">
              Click to filter →
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-gray-200 hover:border-red-400 transition-colors cursor-pointer"
          onClick={() => setSelectedStatus('Removed')}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Removed Items</div>
            <div className="text-2xl font-bold text-red-600">{insights.removedCount}</div>
            <div className="text-xs text-gray-500 mt-1">{insights.removalRate}% removal rate</div>
            <div className="text-xs text-blue-600 hover:underline mt-1 font-medium">
              Click to filter →
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Funnel Visualization */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">Pipeline Funnel</h4>
            <p className="text-xs text-gray-600 mb-3">Item flow through project stages</p>
            <div className="relative" style={{ height: '220px' }}>
              {/* Custom Funnel */}
              <div className="flex flex-col justify-between h-full py-2">
                {waterfallData.map((stage, index) => {
                  const maxWidth = 90;
                  const minWidth = 35;
                  const widthPercent = minWidth + ((maxWidth - minWidth) * (stage.remaining / waterfallData[0].remaining));
                  const color = index === 0 ? '#8b5cf6' : index === waterfallData.length - 1 ? '#10b981' : '#3b82f6';
                  const isLast = index === waterfallData.length - 1;

                  return (
                    <div key={stage.stage} className="relative flex-1 flex flex-col justify-center">
                      {/* Funnel segment */}
                      <div className="flex items-center justify-center">
                        <div
                          className="relative rounded shadow-sm transition-all hover:shadow-md"
                          style={{
                            width: `${widthPercent}%`,
                            height: '40px',
                            backgroundColor: color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 12px'
                          }}
                        >
                          <div className="text-white text-xs font-semibold flex-1">
                            {stage.stage.replace('\n', ' ')}
                          </div>
                          <div className="text-white text-sm font-bold">
                            {stage.remaining}
                          </div>
                          {stage.removed > 0 && (
                            <div className="text-white text-xs ml-2 bg-red-500 bg-opacity-30 px-1.5 py-0.5 rounded">
                              -{stage.removed}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Arrow between stages */}
                      {!isLast && (
                        <div className="flex justify-center my-0.5">
                          <div className="text-gray-400 text-sm">↓</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-semibold">Conversion Rate:</span>
                <span className="font-bold text-green-600">
                  {waterfallData[0]?.remaining > 0
                    ? ((waterfallData[3]?.remaining / waterfallData[0]?.remaining) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">Items by Origin Source</h4>
            <p className="text-xs text-gray-600 mb-3">Where items in the quote originated</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sourceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.value}`}
                  outerRadius={70}
                  dataKey="value"
                >
                  {sourceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2 justify-center text-xs">
              {sourceDistribution.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-gray-700">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analysis Charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Items Missing from Projects */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-1 text-sm">Missing from Projects</h4>
            <p className="text-xs text-gray-600 mb-3">Items not included in quote</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={missingFromProjects} margin={{ top: 10, right: 10, bottom: 60, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                <Bar dataKey="inProject" name="In Project" fill="#3b82f6" />
                <Bar dataKey="inQuote" name="In Quote" fill="#10b981" />
                <Bar dataKey="missing" name="Missing" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Missing:</span>
                <span className="font-bold text-red-600">
                  {missingFromProjects.reduce((sum, item) => sum + item.missing, 0)} items
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items with No Bids */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-1 text-sm">Bid Status</h4>
            <p className="text-xs text-gray-600 mb-3">Vendor bid coverage</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={noBidsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.value}`}
                  outerRadius={65}
                  dataKey="value"
                >
                  {noBidsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2 justify-center text-xs">
              {noBidsData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-gray-700 truncate">{entry.name.replace(' Received', '')}: <span className="font-semibold">{entry.value}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bids Not Exported */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-1 text-sm">Bids Not Exported</h4>
            <p className="text-xs text-gray-600 mb-3">By vendor</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bidsNotExported} margin={{ top: 10, right: 10, bottom: 60, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="vendor"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                <Bar dataKey="exported" name="Exported" fill="#10b981" />
                <Bar dataKey="notExported" name="Not Exported" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Not Exported:</span>
                <span className="font-bold text-orange-600">
                  {bidsNotExported.reduce((sum, item) => sum + item.notExported, 0)} bids
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">Item Source Details</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 text-sm">Item Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 text-sm">Item Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 text-sm">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 text-sm">Vendor</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">Source</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 text-sm">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 text-sm">Total Cost</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">Removal Info</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredItems.slice(0, 100).map((item) => {
                  // Get the source (FIRST stage in pipeline = origin source)
                  const source = item.pipeline[0];

                  return (
                    <tr key={item.itemCode} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="px-4 py-3 font-mono text-gray-900 border-r border-gray-200 text-sm">
                        {item.itemCode}
                      </td>
                      <td className="px-4 py-3 text-gray-900 border-r border-gray-200 text-sm">
                        {item.itemName}
                      </td>
                      <td className="px-4 py-3 text-gray-700 border-r border-gray-200 text-sm">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-gray-700 border-r border-gray-200 text-sm">
                        {item.vendor}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200 text-sm">
                        <span
                          className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: STAGE_COLORS[source] }}
                        >
                          {source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200 text-sm">
                        {item.currentStatus === 'Present' ? (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            ✓ Present
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                            ✗ Removed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 border-r border-gray-200 text-sm">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 border-r border-gray-200 text-sm">
                        ${item.totalCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {item.currentStatus === 'Removed' ? (
                          <div className="text-xs">
                            <div><strong>Stage:</strong> {item.removedAt}</div>
                            <div><strong>By:</strong> {item.removedBy}</div>
                            <div><strong>Reason:</strong> {item.removalReason}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={6} className="px-4 py-3 font-bold text-gray-900 text-sm">
                    TOTAL ({filteredItems.length} items)
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-sm">
                    {filteredItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 border-r border-gray-300 text-sm">
                    ${filteredItems.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    Showing first 100 items
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
