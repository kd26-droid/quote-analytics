import { useMemo } from 'react';
import type { CostViewItem } from '../services/api';

export interface BOMInstanceInfo {
  instanceId: string;
  bomCode: string;
  bomName: string;
  instanceQty: number;
  label: string; // e.g., "QAB1 @ 10 units"
}

export interface UseBOMInstancesResult {
  bomInstances: BOMInstanceInfo[];
  hasVolumeScenarios: boolean;
  filterByInstance: (items: CostViewItem[], selectedInstanceIds: string[]) => CostViewItem[];
}

/**
 * Hook to extract BOM instances from items and detect volume scenarios.
 * Volume scenarios occur when the same BOM is added multiple times with different quantities.
 *
 * @param items - Array of CostViewItem from the API
 * @returns BOM instances info, volume scenario detection, and filter function
 */
export function useBOMInstances(items: CostViewItem[]): UseBOMInstancesResult {
  const { bomInstances, hasVolumeScenarios } = useMemo(() => {
    const instanceMap = new Map<string, BOMInstanceInfo>();

    items.forEach(item => {
      if (item.bom_instance_id && !instanceMap.has(item.bom_instance_id)) {
        // Get root BOM code from path (first segment)
        const rootBomCode = item.bom_path ? item.bom_path.split(' > ')[0] : item.bom_code;

        instanceMap.set(item.bom_instance_id, {
          instanceId: item.bom_instance_id,
          bomCode: rootBomCode,
          bomName: item.bom_name,
          instanceQty: item.bom_instance_qty,
          label: `${rootBomCode} @ ${item.bom_instance_qty} units`
        });
      }
    });

    // Sort instances by BOM code then by quantity
    const sortedInstances = Array.from(instanceMap.values()).sort((a, b) => {
      if (a.bomCode !== b.bomCode) return a.bomCode.localeCompare(b.bomCode);
      return a.instanceQty - b.instanceQty;
    });

    // Check for volume scenarios (same BOM code with different quantities)
    const bomCodeCounts = new Map<string, number>();
    sortedInstances.forEach(inst => {
      bomCodeCounts.set(inst.bomCode, (bomCodeCounts.get(inst.bomCode) || 0) + 1);
    });
    const hasVolume = Array.from(bomCodeCounts.values()).some(count => count > 1);

    return { bomInstances: sortedInstances, hasVolumeScenarios: hasVolume };
  }, [items]);

  // Filter function to apply BOM instance filter
  const filterByInstance = useMemo(() => {
    return (itemsToFilter: CostViewItem[], selectedInstanceIds: string[]): CostViewItem[] => {
      if (selectedInstanceIds.includes('all')) {
        return itemsToFilter;
      }
      return itemsToFilter.filter(item =>
        selectedInstanceIds.includes(item.bom_instance_id)
      );
    };
  }, []);

  return {
    bomInstances,
    hasVolumeScenarios,
    filterByInstance
  };
}
