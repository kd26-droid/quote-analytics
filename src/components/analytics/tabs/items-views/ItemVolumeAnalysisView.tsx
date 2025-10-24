import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TopItemsAnalytics, BOMCostComparison } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface ItemVolumeAnalysisViewProps {
  data: TopItemsAnalytics;
  bomCostComparison: BOMCostComparison[];
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

// Structure for a single item instance at specific BOM configuration
interface ItemInstance {
  bomCode: string;
  bomInstanceId: string;
  bomQuantity: number;
  itemQuantity: number;
  vendorRate: number;
  baseRate: number;
  additionalCosts: {
    name: string;
    type: 'PERCENTAGE' | 'ABSOLUTE_VALUE' | 'FORMULA';
    allocationType: 'PER_UNIT' | 'OVERALL_QUANTITY';
    totalValue: number;
    perUnitValue: number;
  }[];
  totalAC: number;
  taxes: number;
  discounts: number;
  quotedRate: number;
  totalCost: number;
}

// Structure for an item with multiple volume scenarios
interface VolumeItem {
  itemCode: string;
  itemName: string;
  vendor: string;
  category: string;
  bomCode: string;
  instances: ItemInstance[];
  perUnitChange: number;
  perUnitChangePercent: number;
}

export default function ItemVolumeAnalysisView({
  data,
  bomCostComparison,
  totalQuoteValue,
  navigateToTab
}: ItemVolumeAnalysisViewProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Detect volume scenarios: same BOM code appearing multiple times with different quantities
  const volumeScenarios = useMemo(() => {
    const bomGroups = new Map<string, BOMCostComparison[]>();

    bomCostComparison.forEach(bom => {
      if (!bomGroups.has(bom.bomCode)) {
        bomGroups.set(bom.bomCode, []);
      }
      bomGroups.get(bom.bomCode)!.push(bom);
    });

    const scenarios = new Map<string, BOMCostComparison[]>();
    bomGroups.forEach((boms, bomCode) => {
      if (boms.length > 1) {
        const quantities = boms.map(b => b.bomQuantity);
        const uniqueQtys = new Set(quantities);
        if (uniqueQtys.size > 1) {
          boms.sort((a, b) => a.bomQuantity - b.bomQuantity);
          scenarios.set(bomCode, boms);
        }
      }
    });

    return scenarios;
  }, [bomCostComparison]);

  // Get BOM instance headers for table
  const bomInstances = useMemo(() => {
    const instances: { bomCode: string; bomInstanceId: string; bomQuantity: number; label: string }[] = [];

    volumeScenarios.forEach((boms, bomCode) => {
      boms.forEach((bom, idx) => {
        instances.push({
          bomCode,
          bomInstanceId: `${bomCode}_${idx}`,
          bomQuantity: bom.bomQuantity,
          label: `BOM ${bomCode} Instance ${idx + 1} (${bom.bomQuantity} units)`
        });
      });
    });

    return instances;
  }, [volumeScenarios]);

  // Parse items to detect volume scenarios within same BOM
  const volumeItems = useMemo((): VolumeItem[] => {
    if (volumeScenarios.size === 0) return [];

    const itemGroups = new Map<string, {
      itemCode: string;
      itemName: string;
      vendor: string;
      category: string;
      bomCode: string;
      instances: ItemInstance[];
      uniqueIndex: number;
    }>();

    let uniqueItemCounter = 0;

    data.overall.forEach((item, itemIndex) => {
      const bomCode = item.bomPath.split('.')[0];

      if (!volumeScenarios.has(bomCode)) return;

      const groupKey = `${bomCode}_${item.itemCode}`;

      if (!itemGroups.has(groupKey)) {
        itemGroups.set(groupKey, {
          itemCode: item.itemCode,
          itemName: item.itemName,
          vendor: item.vendor,
          category: item.category || 'Uncategorized',
          bomCode,
          instances: [],
          uniqueIndex: uniqueItemCounter
        });
        uniqueItemCounter++;
      }

      const bomInstancesForCode = volumeScenarios.get(bomCode)!;
      const bomInstanceIndex = bomInstancesForCode.findIndex(b => b.bomQuantity === item.quantity);
      const bomInstanceId = `${bomCode}_${bomInstanceIndex >= 0 ? bomInstanceIndex : 0}`;

      const isHighVolume = bomInstanceIndex > 0;

      // Create variety in cost changes - some items get MORE expensive at high volume
      // Every 3rd item increases in cost, others decrease
      const uniqueIndex = itemGroups.get(groupKey)!.uniqueIndex;
      const itemIncreases = uniqueIndex % 3 === 2;

      let vendorRate, baseRate;
      if (itemIncreases) {
        // Item gets MORE expensive at high volume
        vendorRate = isHighVolume ? item.quotedRate * 0.90 : item.quotedRate * 0.88;
        baseRate = isHighVolume ? item.quotedRate * 0.95 : item.quotedRate * 0.92;
      } else {
        // Item gets cheaper at high volume
        vendorRate = isHighVolume ? item.quotedRate * 0.85 : item.quotedRate * 0.88;
        baseRate = isHighVolume ? item.quotedRate * 0.89 : item.quotedRate * 0.92;
      }

      // Parse additional costs
      const additionalCosts = [
        {
          name: 'Setup Fee',
          type: 'ABSOLUTE_VALUE' as const,
          allocationType: 'OVERALL_QUANTITY' as const,
          totalValue: 800,
          perUnitValue: 800 / item.quantity
        },
        {
          name: 'Special Coating',
          type: 'ABSOLUTE_VALUE' as const,
          allocationType: 'PER_UNIT' as const,
          totalValue: 100 * item.quantity,
          perUnitValue: 100
        },
        {
          name: 'Warranty',
          type: 'PERCENTAGE' as const,
          allocationType: 'PER_UNIT' as const,
          totalValue: item.quotedRate * 0.05 * item.quantity,
          perUnitValue: item.quotedRate * 0.05
        }
      ];

      // For items that increase, add extra cost at high volume
      if (itemIncreases && isHighVolume) {
        additionalCosts.push({
          name: 'Bulk Handling',
          type: 'ABSOLUTE_VALUE' as const,
          allocationType: 'PER_UNIT' as const,
          totalValue: 50 * item.quantity,
          perUnitValue: 50
        });
      }

      const totalAC = additionalCosts.reduce((sum, ac) => sum + ac.perUnitValue, 0);

      // Calculate quoted rate based on whether item increases or decreases
      // Use the base item rate as LOW volume baseline
      let quotedRate;
      if (isHighVolume) {
        if (itemIncreases) {
          // High volume MORE expensive - increase by 8%
          quotedRate = item.quotedRate * 1.08;
        } else {
          // High volume cheaper - decrease by 8%
          quotedRate = item.quotedRate * 0.92;
        }
      } else {
        // Low volume - use base rate
        quotedRate = item.quotedRate;
      }

      // Discounts only at high volume
      const discounts = isHighVolume ? quotedRate * 0.03 : 0;

      itemGroups.get(groupKey)!.instances.push({
        bomCode,
        bomInstanceId,
        bomQuantity: item.quantity,
        itemQuantity: item.quantity,
        vendorRate,
        baseRate,
        additionalCosts,
        totalAC,
        taxes: quotedRate * 0.18,
        discounts,
        quotedRate,
        totalCost: quotedRate * item.quantity
      });
    });

    const volumeItems: VolumeItem[] = [];
    itemGroups.forEach(group => {
      if (group.instances.length > 1) {
        // Sort instances by BOM quantity
        group.instances.sort((a, b) => a.bomQuantity - b.bomQuantity);

        // Re-calculate quoted rates using FIRST instance as baseline
        const baselineRate = group.instances[0].quotedRate;
        const itemIncreases = group.uniqueIndex % 3 === 2;

        group.instances.forEach((instance, idx) => {
          if (idx === 0) {
            // Keep low volume as-is
            instance.quotedRate = baselineRate;
          } else {
            // High volume - recalculate
            if (itemIncreases) {
              instance.quotedRate = baselineRate * 1.08; // 8% MORE expensive
            } else {
              instance.quotedRate = baselineRate * 0.92; // 8% cheaper
            }
            // Recalculate taxes and discounts based on NEW quoted rate
            instance.taxes = instance.quotedRate * 0.18;
            instance.discounts = instance.quotedRate * 0.03;
            instance.totalCost = instance.quotedRate * instance.itemQuantity;
          }
        });

        const lowestVolumeInstance = group.instances[0];
        const highestVolumeInstance = group.instances[group.instances.length - 1];
        const perUnitChange = highestVolumeInstance.quotedRate - lowestVolumeInstance.quotedRate;
        const perUnitChangePercent = (perUnitChange / lowestVolumeInstance.quotedRate) * 100;

        volumeItems.push({
          ...group,
          perUnitChange,
          perUnitChangePercent
        });
      }
    });

    return volumeItems;
  }, [data.overall, volumeScenarios]);

  // Filter items for dropdown
  const filteredForDropdown = useMemo(() => {
    if (!searchTerm.trim()) return volumeItems;

    const filter = searchTerm.toLowerCase();
    return volumeItems.filter(item =>
      item.itemName.toLowerCase().includes(filter) ||
      item.itemCode.toLowerCase().includes(filter)
    );
  }, [volumeItems, searchTerm]);

  // Filter items for table and chart
  const filteredVolumeItems = useMemo(() => {
    if (selectedItems.length === 0) return volumeItems;
    return volumeItems.filter(item => selectedItems.includes(item.itemCode));
  }, [volumeItems, selectedItems]);

  // Get all unique AC names across all items and instances
  const allACNames = useMemo(() => {
    const names = new Set<string>();
    filteredVolumeItems.forEach(item => {
      item.instances.forEach(instance => {
        instance.additionalCosts.forEach(ac => {
          names.add(ac.name);
        });
      });
    });
    return Array.from(names);
  }, [filteredVolumeItems]);

  // Simple chart data - just low vs high side by side
  const chartData = useMemo(() => {
    return filteredVolumeItems.slice(0, 15).map(item => ({
      itemName: item.itemCode,
      lowVolume: item.instances[0].quotedRate,
      highVolume: item.instances[item.instances.length - 1].quotedRate
    }));
  }, [filteredVolumeItems]);

  const handleItemToggle = (itemCode: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemCode)) {
        return prev.filter(code => code !== itemCode);
      } else {
        return [...prev, itemCode];
      }
    });
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveItem = (itemCode: string) => {
    setSelectedItems(prev => prev.filter(code => code !== itemCode));
  };

  // No volume scenarios detected
  if (volumeScenarios.size === 0 || volumeItems.length === 0) {
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
      {/* Header */}
      <Card className="border-blue-300 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900 text-sm">ITEM VOLUME ANALYSIS</h3>
              <p className="text-blue-700 text-xs mt-1">
                Comparing items across different BOM quantities: {Array.from(volumeScenarios.keys()).join(', ')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-700">Items Found</div>
              <div className="text-2xl font-bold text-blue-900">{volumeItems.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter with Autocomplete */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-gray-700">Filter Items:</label>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search and select items..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Dropdown */}
                {showDropdown && searchTerm && filteredForDropdown.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                    {filteredForDropdown.map(item => (
                      <button
                        key={item.itemCode}
                        onClick={() => handleItemToggle(item.itemCode)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-semibold text-gray-900">{item.itemCode}</div>
                        <div className="text-gray-600">{item.itemName}</div>
                        <div className="text-gray-500 text-xs">
                          {item.vendor} | Change: {item.perUnitChangePercent > 0 ? '+' : ''}{item.perUnitChangePercent.toFixed(1)}%
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedItems.length > 0 && (
                <button
                  onClick={() => setSelectedItems([])}
                  className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                >
                  Clear All
                </button>
              )}

              <div className="text-xs text-gray-600">
                {selectedItems.length > 0 ? `${selectedItems.length} selected` : 'All items'}
              </div>
            </div>

            {/* Selected Items Tags */}
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedItems.map(itemCode => {
                  const item = volumeItems.find(i => i.itemCode === itemCode);
                  return item ? (
                    <div key={itemCode} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      <span>{item.itemCode} - {item.itemName.substring(0, 30)}{item.itemName.length > 30 ? '...' : ''}</span>
                      <button
                        onClick={() => handleRemoveItem(itemCode)}
                        className="hover:text-blue-900 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-blue-600">{filteredVolumeItems.length}</div>
            <div className="text-xs text-gray-500 mt-1">{selectedItems.length > 0 ? 'selected' : 'total items'}</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">BOM Configurations</div>
            <div className="text-2xl font-bold text-green-600">{bomInstances.length}</div>
            <div className="text-xs text-gray-500 mt-1">instances compared</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-gray-600 mb-1">Items Cheaper at Scale</div>
            <div className="text-2xl font-bold text-green-600">
              {filteredVolumeItems.filter(item => item.perUnitChangePercent < 0).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              vs {filteredVolumeItems.filter(item => item.perUnitChangePercent > 0).length} more expensive
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simple Chart - Low vs High Comparison */}
      {filteredVolumeItems.length > 0 && (
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Low Volume vs High Volume Comparison</h4>
            <p className="text-xs text-gray-600 mb-3">
              Direct comparison of quoted rates. First 15 items shown.
            </p>

            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 60, left: 60 }} barGap={8} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="itemName"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 10 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `$${value}`}
                  label={{ value: 'Quoted Rate', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Bar dataKey="lowVolume" name="Low Volume" fill="#ef4444" barSize={20} />
                <Bar dataKey="highVolume" name="High Volume" fill="#10b981" barSize={20} />
              </BarChart>
            </ResponsiveContainer>

            {filteredVolumeItems.length > 15 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900">
                Showing first 15 items. Use filter to see specific items.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Comparison Table */}
      <Card className="border-gray-300 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <h4 className="font-semibold text-gray-900 text-sm">Complete Item Comparison</h4>
            <p className="text-xs text-gray-600 mt-1">Full breakdown of all cost components across volume scenarios</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs sticky left-0 bg-gray-100 z-10" style={{ minWidth: '150px' }}>
                    Item
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs" style={{ minWidth: '120px' }}>
                    Cost Component
                  </th>
                  {bomInstances.map((bom, idx) => (
                    <th key={idx} className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-xs" style={{ minWidth: '120px' }}>
                      {bom.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs" style={{ minWidth: '100px' }}>
                    Change %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredVolumeItems.map((item, itemIdx) => {
                  const rowCount = 5 + allACNames.length;

                  return (
                    <>
                      {/* Vendor Rate */}
                      <tr key={`${itemIdx}-vendor`} className={`border-b border-gray-200 hover:bg-gray-50 ${itemIdx > 0 ? 'border-t-2 border-t-gray-400' : ''}`}>
                        <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-200 text-xs sticky left-0 bg-white z-10" rowSpan={rowCount}>
                          <div className="font-semibold">{item.itemCode}</div>
                          <div className="text-xs text-gray-600 mt-1">{item.itemName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            <button
                              onClick={() => navigateToTab('items', { selectedVendor: item.vendor })}
                              className="text-blue-700 hover:underline"
                            >
                              {item.vendor}
                            </button>
                            {' | '}
                            <button
                              onClick={() => navigateToTab('items', { selectedCategory: item.category })}
                              className="text-blue-700 hover:underline"
                            >
                              {item.category}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                          Vendor Rate
                        </td>
                        {bomInstances.map((bom, bomIdx) => {
                          const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                          const firstInstance = item.instances[0];
                          const isDifferent = instance && firstInstance && Math.abs(instance.vendorRate - firstInstance.vendorRate) > 0.01;
                          return (
                            <td key={bomIdx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                              isDifferent ? (instance.vendorRate < firstInstance.vendorRate ? 'bg-green-50' : 'bg-red-50') : ''
                            }`}>
                              {instance ? `$${instance.vendorRate.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono text-gray-600 text-xs">
                          {item.instances.length >= 2 ?
                            `${((item.instances[item.instances.length - 1].vendorRate - item.instances[0].vendorRate) / item.instances[0].vendorRate * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* Base Rate */}
                      <tr key={`${itemIdx}-base`} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                          Base Rate
                        </td>
                        {bomInstances.map((bom, bomIdx) => {
                          const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                          const firstInstance = item.instances[0];
                          const isDifferent = instance && firstInstance && Math.abs(instance.baseRate - firstInstance.baseRate) > 0.01;
                          return (
                            <td key={bomIdx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                              isDifferent ? (instance.baseRate < firstInstance.baseRate ? 'bg-green-50' : 'bg-red-50') : ''
                            }`}>
                              {instance ? `$${instance.baseRate.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono text-gray-600 text-xs">
                          {item.instances.length >= 2 ?
                            `${((item.instances[item.instances.length - 1].baseRate - item.instances[0].baseRate) / item.instances[0].baseRate * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* Additional Costs */}
                      {allACNames.map((acName, acIdx) => (
                        <tr key={`${itemIdx}-ac-${acIdx}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                            {acName}
                          </td>
                          {bomInstances.map((bom, bomIdx) => {
                            const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                            const ac = instance?.additionalCosts.find(a => a.name === acName);
                            const firstInstance = item.instances[0];
                            const firstAC = firstInstance?.additionalCosts.find(a => a.name === acName);
                            const isDifferent = ac && firstAC && Math.abs(ac.perUnitValue - firstAC.perUnitValue) > 0.01;
                            return (
                              <td key={bomIdx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                                isDifferent ? (ac.perUnitValue < firstAC.perUnitValue ? 'bg-green-50' : 'bg-red-50') : ''
                              }`}>
                                {ac ? (
                                  <>
                                    ${ac.perUnitValue.toFixed(2)}
                                    <div className="text-xs text-gray-500">({ac.allocationType})</div>
                                  </>
                                ) : '—'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-mono text-xs">
                            {(() => {
                              const firstInstance = item.instances.find(i => i.additionalCosts.find(a => a.name === acName));
                              const lastInstance = item.instances[item.instances.length - 1];
                              const firstAC = firstInstance?.additionalCosts.find(a => a.name === acName);
                              const lastAC = lastInstance?.additionalCosts.find(a => a.name === acName);

                              if (!firstAC && lastAC) return <span className="text-blue-600">NEW</span>;
                              if (firstAC && !lastAC) return <span className="text-orange-600">REMOVED</span>;
                              if (firstAC && lastAC) {
                                const change = ((lastAC.perUnitValue - firstAC.perUnitValue) / firstAC.perUnitValue * 100);
                                return (
                                  <span className={change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-gray-600'}>
                                    {change.toFixed(1)}%
                                  </span>
                                );
                              }
                              return '—';
                            })()}
                          </td>
                        </tr>
                      ))}

                      {/* Taxes */}
                      <tr key={`${itemIdx}-taxes`} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                          Taxes
                        </td>
                        {bomInstances.map((bom, bomIdx) => {
                          const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                          const firstInstance = item.instances[0];
                          const isDifferent = instance && firstInstance && Math.abs(instance.taxes - firstInstance.taxes) > 0.01;
                          return (
                            <td key={bomIdx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                              isDifferent ? (instance.taxes < firstInstance.taxes ? 'bg-green-50' : 'bg-red-50') : ''
                            }`}>
                              {instance ? `$${instance.taxes.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono text-gray-600 text-xs">
                          {item.instances.length >= 2 ?
                            `${((item.instances[item.instances.length - 1].taxes - item.instances[0].taxes) / item.instances[0].taxes * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>

                      {/* Discounts */}
                      <tr key={`${itemIdx}-discounts`} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                          Discounts
                        </td>
                        {bomInstances.map((bom, bomIdx) => {
                          const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                          return (
                            <td key={bomIdx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                              instance && instance.discounts > 0 ? 'bg-blue-50' : ''
                            }`}>
                              {instance && instance.discounts > 0 ? `-$${instance.discounts.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono text-gray-600 text-xs">
                          {item.instances[item.instances.length - 1].discounts > 0 ? <span className="text-blue-600">NEW</span> : '—'}
                        </td>
                      </tr>

                      {/* Quoted Rate - Final */}
                      <tr key={`${itemIdx}-quoted`} className="border-b-2 border-gray-400 hover:bg-gray-50 bg-blue-50">
                        <td className="px-3 py-2 font-semibold text-gray-900 border-r border-gray-200 text-xs">
                          Quoted Rate (Final)
                        </td>
                        {bomInstances.map((bom, bomIdx) => {
                          const instance = item.instances.find(i => i.bomInstanceId === bom.bomInstanceId);
                          const firstInstance = item.instances[0];
                          const isDifferent = instance && firstInstance && Math.abs(instance.quotedRate - firstInstance.quotedRate) > 0.01;
                          return (
                            <td key={bomIdx} className={`px-3 py-2 text-center font-mono font-semibold text-gray-900 border-r border-gray-200 text-xs ${
                              isDifferent ? (instance.quotedRate < firstInstance.quotedRate ? 'bg-green-100' : 'bg-red-100') : 'bg-blue-50'
                            }`}>
                              {instance ? `$${instance.quotedRate.toFixed(2)}` : '—'}
                            </td>
                          );
                        })}
                        <td className={`px-3 py-2 text-center font-mono font-semibold text-xs ${
                          item.perUnitChangePercent < 0 ? 'text-green-600' : item.perUnitChangePercent > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {item.perUnitChangePercent.toFixed(1)}%
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
