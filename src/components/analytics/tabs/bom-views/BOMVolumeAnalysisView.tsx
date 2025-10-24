import { useState, useMemo } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TopItemsAnalytics, BOMCostComparison } from '../../../../types/quote.types';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface BOMVolumeAnalysisViewProps {
  bomCostComparison: BOMCostComparison[];
  data: TopItemsAnalytics;
  totalQuoteValue: number;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
}

interface BOMInstance {
  bomCode: string;
  bomName: string;
  bomInstanceId: string;
  bomQuantity: number;
  itemsSubtotal: number;
  bomAdditionalCosts: number;
  bomTotalWithAC: number;
  perUnitCost: number;
  additionalCostsBreakdown: {
    name: string;
    amount: number;
    perUnit: number;
  }[];
  subBOMs: SubBOMData[];
}

interface SubBOMData {
  bomCode: string;
  bomName: string;
  level: number;
  itemsSubtotal: number;
  bomAC: number;
  total: number;
  perUnit: number;
  children: SubBOMData[];
}

interface VolumeBOM {
  bomCode: string;
  instances: BOMInstance[];
  perUnitChange: number;
  perUnitChangePercent: number;
}

export default function BOMVolumeAnalysisView({
  bomCostComparison,
  data,
  totalQuoteValue,
  navigateToTab
}: BOMVolumeAnalysisViewProps) {
  const [selectedBOM, setSelectedBOM] = useState<string>('');
  const [selectedVolumes, setSelectedVolumes] = useState<number[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  // Detect volume scenarios
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

  // Get BOM instance headers
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

  // Parse BOMs with hierarchical structure
  const volumeBOMs = useMemo((): VolumeBOM[] => {
    if (volumeScenarios.size === 0) return [];

    const result: VolumeBOM[] = [];

    volumeScenarios.forEach((boms, bomCode) => {
      const instances: BOMInstance[] = [];

      boms.forEach((bom, idx) => {
        const isHighVolume = idx > 0;

        // Mock BOM AC breakdown with variety - some increase, some decrease at scale
        const additionalCostsBreakdown = [];

        // Assembly Labor - decreases significantly at scale (efficiency)
        const assemblyLaborBase = bom.bomAdditionalCosts * 0.35;
        additionalCostsBreakdown.push({
          name: 'Assembly Labor',
          amount: isHighVolume ? assemblyLaborBase * 0.6 : assemblyLaborBase,
          perUnit: isHighVolume ? (assemblyLaborBase * 0.6) / bom.bomQuantity : assemblyLaborBase / bom.bomQuantity
        });

        // Quality Inspection - decreases at scale
        const qcBase = bom.bomAdditionalCosts * 0.25;
        additionalCostsBreakdown.push({
          name: 'Quality Inspection',
          amount: isHighVolume ? qcBase * 0.7 : qcBase,
          perUnit: isHighVolume ? (qcBase * 0.7) / bom.bomQuantity : qcBase / bom.bomQuantity
        });

        // Packaging - INCREASES at high volume (special packaging required for bulk)
        const packagingBase = bom.bomAdditionalCosts * 0.2;
        additionalCostsBreakdown.push({
          name: 'Packaging',
          amount: isHighVolume ? packagingBase * 1.4 : packagingBase,
          perUnit: isHighVolume ? (packagingBase * 1.4) / bom.bomQuantity : packagingBase / bom.bomQuantity
        });

        // Testing - stays relatively same per unit
        const testingBase = bom.bomAdditionalCosts * 0.15;
        additionalCostsBreakdown.push({
          name: 'Testing',
          amount: testingBase,
          perUnit: testingBase / bom.bomQuantity
        });

        // Surface Treatment - INCREASES at high volume (better finish required)
        if (isHighVolume) {
          additionalCostsBreakdown.push({
            name: 'Surface Treatment',
            amount: bom.bomQuantity * 30,
            perUnit: 30
          });
        }

        // Welding Inspection - only at low volume (manual checks)
        if (!isHighVolume) {
          additionalCostsBreakdown.push({
            name: 'Welding Inspection',
            amount: bom.bomQuantity * 20,
            perUnit: 20
          });
        }

        // Bulk Handling - only at high volume
        if (isHighVolume) {
          additionalCostsBreakdown.push({
            name: 'Bulk Handling',
            amount: bom.bomQuantity * 25,
            perUnit: 25
          });
        }

        // Build sub-BOM structure with multiple levels (mock data - in real implementation this would parse bomPath)
        const subBOMs: SubBOMData[] = [];

        // Mock sub-BOMs with hierarchy
        if (bom.bomCode === 'D') {
          // Apply variety to sub-BOM costs based on volume
          const motorMultiplier = isHighVolume ? 0.88 : 1; // Motors get cheaper at scale
          const controlMultiplier = isHighVolume ? 1.12 : 1; // Control panel gets MORE expensive (special components)
          const sensorMultiplier = isHighVolume ? 0.75 : 1; // Sensors dramatically cheaper at scale
          const housingMultiplier = isHighVolume ? 1.05 : 1; // Housing slightly more expensive (better finish)

          // Level 1: Motor Assembly
          const motorItemsBase = bom.itemsSubtotal * 0.4;
          const motorACBase = bom.bomAdditionalCosts * 0.3;
          const motorItems = motorItemsBase * motorMultiplier;
          const motorAC = motorACBase * motorMultiplier;

          const motorSubBOM: SubBOMData = {
            bomCode: 'D.1',
            bomName: 'Motor Assembly',
            level: 1,
            itemsSubtotal: motorItems,
            bomAC: motorAC,
            total: motorItems + motorAC,
            perUnit: (motorItems + motorAC) / bom.bomQuantity,
            children: [
              // Level 2: Motor sub-components
              {
                bomCode: 'D.1.1',
                bomName: 'Rotor Assembly',
                level: 2,
                itemsSubtotal: motorItems * 0.5,
                bomAC: motorAC * 0.4,
                total: (motorItems * 0.5) + (motorAC * 0.4),
                perUnit: ((motorItems * 0.5) + (motorAC * 0.4)) / bom.bomQuantity,
                children: []
              },
              {
                bomCode: 'D.1.2',
                bomName: 'Stator Assembly',
                level: 2,
                itemsSubtotal: motorItems * 0.35,
                bomAC: motorAC * 0.3,
                total: (motorItems * 0.35) + (motorAC * 0.3),
                perUnit: ((motorItems * 0.35) + (motorAC * 0.3)) / bom.bomQuantity,
                children: []
              }
            ]
          };
          subBOMs.push(motorSubBOM);

          // Level 1: Control Panel
          const controlItemsBase = bom.itemsSubtotal * 0.3;
          const controlACBase = bom.bomAdditionalCosts * 0.2;
          const controlItems = controlItemsBase * controlMultiplier;
          const controlAC = controlACBase * controlMultiplier;

          const controlSubBOM: SubBOMData = {
            bomCode: 'D.2',
            bomName: 'Control Panel',
            level: 1,
            itemsSubtotal: controlItems,
            bomAC: controlAC,
            total: controlItems + controlAC,
            perUnit: (controlItems + controlAC) / bom.bomQuantity,
            children: [
              // Level 2: Control Panel sub-components
              {
                bomCode: 'D.2.1',
                bomName: 'PCB Assembly',
                level: 2,
                itemsSubtotal: controlItems * 0.6,
                bomAC: controlAC * 0.5,
                total: (controlItems * 0.6) + (controlAC * 0.5),
                perUnit: ((controlItems * 0.6) + (controlAC * 0.5)) / bom.bomQuantity,
                children: [
                  // Level 3: PCB sub-components
                  {
                    bomCode: 'D.2.1.1',
                    bomName: 'Microcontroller Unit',
                    level: 3,
                    itemsSubtotal: controlItems * 0.6 * 0.7,
                    bomAC: controlAC * 0.5 * 0.3,
                    total: (controlItems * 0.6 * 0.7) + (controlAC * 0.5 * 0.3),
                    perUnit: ((controlItems * 0.6 * 0.7) + (controlAC * 0.5 * 0.3)) / bom.bomQuantity,
                    children: []
                  }
                ]
              },
              {
                bomCode: 'D.2.2',
                bomName: 'Sensor Array',
                level: 2,
                itemsSubtotal: (controlItems * 0.4) * sensorMultiplier,
                bomAC: (controlAC * 0.3) * sensorMultiplier,
                total: ((controlItems * 0.4) + (controlAC * 0.3)) * sensorMultiplier,
                perUnit: (((controlItems * 0.4) + (controlAC * 0.3)) * sensorMultiplier) / bom.bomQuantity,
                children: []
              }
            ]
          };
          subBOMs.push(controlSubBOM);

          // Level 1: Housing
          const housingItemsBase = bom.itemsSubtotal * 0.2;
          const housingACBase = bom.bomAdditionalCosts * 0.15;
          const housingItems = housingItemsBase * housingMultiplier;
          const housingAC = housingACBase * housingMultiplier;

          subBOMs.push({
            bomCode: 'D.3',
            bomName: 'Enclosure Housing',
            level: 1,
            itemsSubtotal: housingItems,
            bomAC: housingAC,
            total: housingItems + housingAC,
            perUnit: (housingItems + housingAC) / bom.bomQuantity,
            children: []
          });
        }

        instances.push({
          bomCode: bom.bomCode,
          bomName: bom.bomName,
          bomInstanceId: `${bomCode}_${idx}`,
          bomQuantity: bom.bomQuantity,
          itemsSubtotal: bom.itemsSubtotal,
          bomAdditionalCosts: bom.bomAdditionalCosts,
          bomTotalWithAC: bom.bomTotalWithAC,
          perUnitCost: bom.bomTotalWithAC / bom.bomQuantity,
          additionalCostsBreakdown,
          subBOMs
        });
      });

      const firstInstance = instances[0];
      const lastInstance = instances[instances.length - 1];
      const perUnitChange = lastInstance.perUnitCost - firstInstance.perUnitCost;
      const perUnitChangePercent = (perUnitChange / firstInstance.perUnitCost) * 100;

      result.push({
        bomCode,
        instances,
        perUnitChange,
        perUnitChangePercent
      });
    });

    return result;
  }, [volumeScenarios]);

  // Filter for dropdown
  const filteredForDropdown = useMemo(() => {
    if (!searchTerm.trim()) return volumeBOMs;

    const filter = searchTerm.toLowerCase();
    return volumeBOMs.filter(bom =>
      bom.bomCode.toLowerCase().includes(filter)
    );
  }, [volumeBOMs, searchTerm]);

  // Filter for display
  const filteredBOMs = useMemo(() => {
    if (!selectedBOM) return volumeBOMs;
    return volumeBOMs.filter(bom => bom.bomCode === selectedBOM);
  }, [volumeBOMs, selectedBOM]);

  // Get all unique volumes across all BOMs
  const allVolumes = useMemo(() => {
    const volumes = new Set<number>();
    volumeScenarios.forEach(boms => {
      boms.forEach(bom => volumes.add(bom.bomQuantity));
    });
    return Array.from(volumes).sort((a, b) => a - b);
  }, [volumeScenarios]);

  // Auto-select first BOM and all volumes
  useMemo(() => {
    if (volumeBOMs.length > 0 && !selectedBOM) {
      setSelectedBOM(volumeBOMs[0].bomCode);
    }
    if (allVolumes.length > 0 && selectedVolumes.length === 0) {
      setSelectedVolumes(allVolumes);
    }
  }, [volumeBOMs, selectedBOM, allVolumes, selectedVolumes]);

  // Get selected BOM data FIRST before using it in other memos
  const selectedBOMData = volumeBOMs.find(b => b.bomCode === selectedBOM);

  // Helper to flatten sub-BOMs recursively
  const flattenSubBOMs = (subBOMs: SubBOMData[], parentPath = ''): SubBOMData[] => {
    const result: SubBOMData[] = [];
    subBOMs.forEach(sub => {
      result.push(sub);
      if (sub.children && sub.children.length > 0) {
        result.push(...flattenSubBOMs(sub.children, sub.bomCode));
      }
    });
    return result;
  };

  // Get all sub-BOMs with their hierarchy levels
  const allSubBOMsFlattened = useMemo(() => {
    if (!selectedBOMData || selectedBOMData.instances.length === 0) return [];
    return flattenSubBOMs(selectedBOMData.instances[0].subBOMs);
  }, [selectedBOMData]);

  // Get unique levels from sub-BOMs
  const availableLevels = useMemo(() => {
    const levels = new Set<number>();
    allSubBOMsFlattened.forEach(sub => levels.add(sub.level));
    return Array.from(levels).sort((a, b) => a - b);
  }, [allSubBOMsFlattened]);

  // Chart data - recalculate to match actual displayed costs and filter by selected volumes and level
  const chartData = useMemo(() => {
    if (!selectedBOMData) return [];

    return selectedBOMData.instances
      .filter(inst => selectedVolumes.includes(inst.bomQuantity))
      .map(instance => {
        let itemsPerUnit = 0;
        let bomACPerUnit = 0;

        if (selectedLevel === 'all' || selectedLevel === 'main') {
          // Show main BOM costs (includes all sub-BOMs)
          itemsPerUnit = instance.itemsSubtotal / instance.bomQuantity;
          bomACPerUnit = instance.additionalCostsBreakdown.reduce((sum, ac) => sum + ac.perUnit, 0);
        } else if (selectedLevel.startsWith('level-')) {
          // Show only specific level costs
          const levelNum = parseInt(selectedLevel.replace('level-', ''));
          const subBOMsAtLevel = flattenSubBOMs(instance.subBOMs).filter(sub => sub.level === levelNum);

          if (subBOMsAtLevel.length > 0) {
            itemsPerUnit = subBOMsAtLevel.reduce((sum, sub) => sum + (sub.itemsSubtotal / instance.bomQuantity), 0);
            bomACPerUnit = subBOMsAtLevel.reduce((sum, sub) => sum + (sub.bomAC / instance.bomQuantity), 0);
          }
        }

        return {
          name: `${instance.bomQuantity} units`,
          itemsSubtotal: itemsPerUnit,
          bomAC: bomACPerUnit,
          total: itemsPerUnit + bomACPerUnit
        };
      });
  }, [selectedBOMData, selectedVolumes, selectedLevel]);

  if (volumeScenarios.size === 0) {
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
              <h3 className="font-semibold text-blue-900 text-sm">BOM VOLUME ANALYSIS</h3>
              <p className="text-blue-700 text-xs mt-1">
                Comparing BOMs across different quantities
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-700">BOMs Found</div>
              <div className="text-2xl font-bold text-blue-900">{volumeBOMs.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* BOM Selector */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-gray-700 w-24">Select BOM:</label>
              <select
                value={selectedBOM}
                onChange={(e) => setSelectedBOM(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {volumeBOMs.map(bom => (
                  <option key={bom.bomCode} value={bom.bomCode}>
                    BOM {bom.bomCode} ({bom.instances.length} volume scenarios)
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Filter */}
            <div className="flex items-start gap-4">
              <label className="text-xs font-semibold text-gray-700 w-24 pt-1">Show Volumes:</label>
              <div className="flex flex-wrap gap-3">
                {allVolumes.map(vol => (
                  <label key={vol} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedVolumes.includes(vol)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVolumes([...selectedVolumes, vol].sort((a, b) => a - b));
                        } else {
                          setSelectedVolumes(selectedVolumes.filter(v => v !== vol));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{vol} units</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Level Filter */}
            {availableLevels.length > 0 && (
              <div className="flex items-center gap-4">
                <label className="text-xs font-semibold text-gray-700 w-24">View Level:</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Levels (Hierarchical)</option>
                  <option value="main">Main BOM Only</option>
                  {availableLevels.map(level => (
                    <option key={level} value={`level-${level}`}>
                      Level {level} Sub-BOMs Only
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedBOMData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Volume Scenarios</div>
                <div className="text-2xl font-bold text-blue-600">{selectedBOMData.instances.length}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedBOMData.instances.map(i => i.bomQuantity).join(' → ')} units
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Per-Unit Change</div>
                <div className={`text-2xl font-bold ${
                  selectedBOMData.perUnitChangePercent < 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedBOMData.perUnitChange < 0 ? '-' : '+'}${Math.abs(selectedBOMData.perUnitChange).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ({selectedBOMData.perUnitChangePercent.toFixed(1)}%) at high volume
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Total Cost Range</div>
                <div className="text-xl font-bold text-purple-600">
                  ${selectedBOMData.instances[0].bomTotalWithAC.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  to ${selectedBOMData.instances[selectedBOMData.instances.length - 1].bomTotalWithAC.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Cost Breakdown by Volume</h4>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 80, left: 80 }} barGap={8} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Volume', position: 'insideBottom', offset: -15, style: { fontSize: 12 } }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    label={{ value: 'Per-Unit Cost', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="square"
                  />
                  <Bar dataKey="itemsSubtotal" name="Items Subtotal" fill="#3b82f6" stackId="a" barSize={60} />
                  <Bar dataKey="bomAC" name="BOM Additional Costs" fill="#f59e0b" stackId="a" barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Comparison Table */}
          <Card className="border-gray-300 shadow-sm">
            <CardContent className="p-0">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
                <h4 className="font-semibold text-gray-900 text-sm">Hierarchical BOM Breakdown</h4>
                <p className="text-xs text-gray-600 mt-1">Complete cost breakdown across all volume scenarios</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-400">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 text-xs" style={{ minWidth: '250px' }}>
                        BOM Component
                      </th>
                      {bomInstances
                        .filter(b => b.bomCode === selectedBOM && selectedVolumes.includes(b.bomQuantity))
                        .map((bom, idx) => (
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
                    {(() => {
                      // Main rendering function - similar to AC tab
                      const renderBOMNode = (bomCode: string, level: number = 0): JSX.Element[] => {
                        const isExpanded = expandedBOMs.has(`main-${bomCode}`);
                        const hasSubBOMs = selectedBOMData.instances[0].subBOMs.length > 0;
                        const indent = level * 24;
                        const rows: JSX.Element[] = [];

                        // MAIN BOM ROW with expandable arrow
                        rows.push(
                          <tr key={`main-${bomCode}`} className="border-b border-gray-300 bg-white font-semibold">
                            <td className="px-3 py-2 border-r border-gray-200 text-xs" style={{ paddingLeft: `${indent + 12}px` }}>
                              <div className="flex items-center gap-2">
                                {hasSubBOMs && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedBOMs);
                                      if (isExpanded) {
                                        newExpanded.delete(`main-${bomCode}`);
                                      } else {
                                        newExpanded.add(`main-${bomCode}`);
                                      }
                                      setExpandedBOMs(newExpanded);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 text-xs"
                                  >
                                    {isExpanded ? '▼' : '▶'}
                                  </button>
                                )}
                                <span className="font-mono text-gray-900 font-bold">BOM {bomCode}</span>
                                {hasSubBOMs && <span className="text-gray-500 text-xs font-normal">({selectedBOMData.instances[0].subBOMs.length} sub-BOMs)</span>}
                              </div>
                            </td>
                            {selectedBOMData.instances
                              .filter(inst => selectedVolumes.includes(inst.bomQuantity))
                              .map((instance, idx) => {
                                const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                const firstInstance = filteredInstances[0];
                                const isDifferent = Math.abs(instance.perUnitCost - firstInstance.perUnitCost) > 0.01;
                                return (
                                  <td key={idx} className={`px-3 py-2 text-center font-mono font-bold text-gray-900 border-r border-gray-200 text-xs ${
                                    isDifferent ? (instance.perUnitCost < firstInstance.perUnitCost ? 'bg-green-50' : 'bg-red-50') : ''
                                  }`}>
                                    ${instance.perUnitCost.toFixed(2)}/unit
                                  </td>
                                );
                              })}
                            <td className="px-3 py-2 text-center font-mono font-bold text-xs">
                              {(() => {
                                const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                if (filteredInstances.length < 2) return '—';
                                const first = filteredInstances[0].perUnitCost;
                                const last = filteredInstances[filteredInstances.length - 1].perUnitCost;
                                const change = ((last - first) / first) * 100;
                                return (
                                  <span className={change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-gray-600'}>
                                    {change.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );

                        // If expanded, show breakdown
                        if (isExpanded || selectedLevel === 'main') {
                          // Items Subtotal row
                          rows.push(
                            <tr key={`items-subtotal-${bomCode}`} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs" style={{ paddingLeft: `${indent + 36}px` }}>
                                Items Subtotal
                              </td>
                              {selectedBOMData.instances
                                .filter(inst => selectedVolumes.includes(inst.bomQuantity))
                                .map((instance, idx) => {
                                  const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                  const firstInstance = filteredInstances[0];
                                  const perUnit = instance.itemsSubtotal / instance.bomQuantity;
                                  const firstPerUnit = firstInstance.itemsSubtotal / firstInstance.bomQuantity;
                                  const isDifferent = Math.abs(perUnit - firstPerUnit) > 0.01;
                                  return (
                                    <td key={idx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                                      isDifferent ? (perUnit < firstPerUnit ? 'bg-green-50' : 'bg-red-50') : ''
                                    }`}>
                                      ${perUnit.toFixed(2)}
                                    </td>
                                  );
                                })}
                              <td className="px-3 py-2 text-center font-mono text-xs">
                                {(() => {
                                  const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                  if (filteredInstances.length < 2) return '—';
                                  const first = filteredInstances[0].itemsSubtotal / filteredInstances[0].bomQuantity;
                                  const last = filteredInstances[filteredInstances.length - 1].itemsSubtotal / filteredInstances[filteredInstances.length - 1].bomQuantity;
                                  const change = ((last - first) / first) * 100;
                                  return (
                                    <span className={change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-gray-600'}>
                                      {change.toFixed(1)}%
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          );

                          // Sub-BOMs - show when expanded
                          if (hasSubBOMs) {
                            const renderSubBOM = (subBOM: SubBOMData, subLevel: number): JSX.Element[] => {
                              const subRows: JSX.Element[] = [];
                              const subExpanded = expandedBOMs.has(subBOM.bomCode);
                              const hasChildren = subBOM.children && subBOM.children.length > 0;
                              const subIndent = subLevel * 24;

                              // Check if this level should be shown based on filter
                              const shouldShow = selectedLevel === 'all' || selectedLevel === `level-${subBOM.level}`;

                              if (shouldShow) {
                                subRows.push(
                                  <tr key={`sub-${subBOM.bomCode}`} className="border-b border-gray-200 hover:bg-gray-50 bg-gray-50">
                                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs" style={{ paddingLeft: `${subIndent + 36}px` }}>
                                      <div className="flex items-center gap-2">
                                        {hasChildren && (
                                          <button
                                            onClick={() => {
                                              const newExpanded = new Set(expandedBOMs);
                                              if (subExpanded) {
                                                newExpanded.delete(subBOM.bomCode);
                                              } else {
                                                newExpanded.add(subBOM.bomCode);
                                              }
                                              setExpandedBOMs(newExpanded);
                                            }}
                                            className="text-gray-500 hover:text-gray-700 text-xs"
                                          >
                                            {subExpanded ? '▼' : '▶'}
                                          </button>
                                        )}
                                        <span className="font-medium">{subBOM.bomCode}</span>
                                        <span className="text-gray-600">({subBOM.bomName})</span>
                                        {hasChildren && <span className="text-gray-500 text-xs">({subBOM.children.length} sub)</span>}
                                      </div>
                                    </td>
                                    {selectedBOMData.instances
                                      .filter(inst => selectedVolumes.includes(inst.bomQuantity))
                                      .map((instance, idx) => {
                                        const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                        const sub = flattenSubBOMs(instance.subBOMs).find(s => s.bomCode === subBOM.bomCode);
                                        const firstSub = flattenSubBOMs(filteredInstances[0].subBOMs).find(s => s.bomCode === subBOM.bomCode);
                                        const isDifferent = sub && firstSub && Math.abs(sub.perUnit - firstSub.perUnit) > 0.01;
                                        return (
                                          <td key={idx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                                            isDifferent ? (sub.perUnit < firstSub.perUnit ? 'bg-green-50' : 'bg-red-50') : ''
                                          }`}>
                                            {sub ? `$${sub.perUnit.toFixed(2)}` : '—'}
                                          </td>
                                        );
                                      })}
                                    <td className="px-3 py-2 text-center font-mono text-xs">
                                      {(() => {
                                        const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                        if (filteredInstances.length < 2) return '—';
                                        const firstSub = flattenSubBOMs(filteredInstances[0].subBOMs).find(s => s.bomCode === subBOM.bomCode);
                                        const lastSub = flattenSubBOMs(filteredInstances[filteredInstances.length - 1].subBOMs).find(s => s.bomCode === subBOM.bomCode);
                                        if (firstSub && lastSub) {
                                          const change = ((lastSub.perUnit - firstSub.perUnit) / firstSub.perUnit * 100);
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
                                );
                              }

                              // Render children if expanded
                              if (subExpanded && hasChildren) {
                                subBOM.children.forEach(child => {
                                  subRows.push(...renderSubBOM(child, subLevel + 1));
                                });
                              } else if (!shouldShow && hasChildren) {
                                // If this level is filtered out, still check children
                                subBOM.children.forEach(child => {
                                  subRows.push(...renderSubBOM(child, subLevel));
                                });
                              }

                              return subRows;
                            };

                            // Render all sub-BOMs
                            selectedBOMData.instances[0].subBOMs.forEach(subBOM => {
                              rows.push(...renderSubBOM(subBOM, 1));
                            });
                          }

                          // BOM AC breakdown
                          rows.push(
                            <tr key={`bom-ac-header-${bomCode}`} className="bg-gray-100 border-b border-gray-300">
                              <td colSpan={selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity)).length + 2} className="px-3 py-2 font-semibold text-gray-800 text-xs" style={{ paddingLeft: `${indent + 36}px` }}>
                                BOM Additional Costs (Per Unit):
                              </td>
                            </tr>
                          );

                          // Each BOM AC type
                          const firstFilteredInstance = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity))[0];
                          firstFilteredInstance.additionalCostsBreakdown.forEach((ac, acIdx) => {
                            rows.push(
                              <tr key={`ac-${bomCode}-${acIdx}`} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs" style={{ paddingLeft: `${indent + 60}px` }}>
                                  {ac.name}
                                </td>
                                {selectedBOMData.instances
                                  .filter(inst => selectedVolumes.includes(inst.bomQuantity))
                                  .map((instance, idx) => {
                                    const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                    const instanceAC = instance.additionalCostsBreakdown.find(a => a.name === ac.name);
                                    const firstInstanceAC = filteredInstances[0].additionalCostsBreakdown.find(a => a.name === ac.name);
                                    const isDifferent = instanceAC && firstInstanceAC && Math.abs(instanceAC.perUnit - firstInstanceAC.perUnit) > 0.01;
                                    return (
                                      <td key={idx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                                        isDifferent ? (instanceAC.perUnit < firstInstanceAC.perUnit ? 'bg-green-50' : 'bg-red-50') : ''
                                      }`}>
                                        {instanceAC ? `$${instanceAC.perUnit.toFixed(2)}` : '—'}
                                      </td>
                                    );
                                  })}
                                <td className="px-3 py-2 text-center font-mono text-xs">
                                  {(() => {
                                    const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                                    if (filteredInstances.length < 2) return '—';
                                    const firstAC = filteredInstances[0].additionalCostsBreakdown.find(a => a.name === ac.name);
                                    const lastAC = filteredInstances[filteredInstances.length - 1].additionalCostsBreakdown.find(a => a.name === ac.name);

                                    if (!firstAC && lastAC) return <span className="text-blue-600">NEW</span>;
                                    if (firstAC && !lastAC) return <span className="text-orange-600">REMOVED</span>;
                                    if (firstAC && lastAC) {
                                      const change = ((lastAC.perUnit - firstAC.perUnit) / firstAC.perUnit * 100);
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
                            );
                          });

                          // NEW AC types at high volume
                          const filteredInstances = selectedBOMData.instances.filter(inst => selectedVolumes.includes(inst.bomQuantity));
                          if (filteredInstances.length >= 2) {
                            filteredInstances[filteredInstances.length - 1].additionalCostsBreakdown
                              .filter(ac => !filteredInstances[0].additionalCostsBreakdown.find(a => a.name === ac.name))
                              .forEach((ac, acIdx) => {
                                rows.push(
                                  <tr key={`new-ac-${bomCode}-${acIdx}`} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs" style={{ paddingLeft: `${indent + 60}px` }}>
                                      {ac.name}
                                    </td>
                                    {filteredInstances.map((instance, idx) => {
                                      const instanceAC = instance.additionalCostsBreakdown.find(a => a.name === ac.name);
                                      return (
                                        <td key={idx} className={`px-3 py-2 text-center font-mono text-gray-700 border-r border-gray-200 text-xs ${
                                          instanceAC ? 'bg-blue-50' : ''
                                        }`}>
                                          {instanceAC ? `$${instanceAC.perUnit.toFixed(2)}` : '—'}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-center text-xs">
                                      <span className="text-blue-600">NEW</span>
                                    </td>
                                  </tr>
                                );
                              });
                          }
                        }

                        return rows;
                      };

                      // Render main BOM
                      return renderBOMNode(selectedBOM, 0);
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
