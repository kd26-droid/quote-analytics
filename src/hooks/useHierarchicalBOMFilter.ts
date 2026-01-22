import { useMemo, useState, useCallback } from 'react';
import type { BOMDetailData } from '../services/api';

export interface HierarchicalBOMNode {
  entryId: string;           // BOMItemModuleLinkage.entry_id or BOMModuleLinkage.entry_id
  bomInstanceId: string;     // Main BOM's BOMModuleLinkage.entry_id
  code: string;              // BOM code
  name: string;              // BOM name
  path: string;              // Full path like "QAB1_R4 > QASB1 > QASSB1"
  level: number;             // 0 = Main, 1 = Sub, 2 = Sub-Sub
  quantity: number;          // BOM quantity
  parentEntryId: string | null;  // Parent's entry_id for hierarchy traversal
  ancestorEntryIds: string[];    // All ancestor entry_ids (for filtering)
  instanceLabel: string;     // e.g., " (#1)" for volume scenarios
  displayLabel: string;      // Full display label with hierarchy arrows
}

export interface HierarchicalBOMFilterState {
  selectedEntryId: string | null;  // null = All BOMs
}

export interface UseHierarchicalBOMFilterResult {
  // All BOM nodes in hierarchy order
  allNodes: HierarchicalBOMNode[];

  // Main BOMs only (for instance selection)
  mainBOMs: HierarchicalBOMNode[];

  // Filter state
  selectedEntryId: string | null;
  setSelectedEntryId: (entryId: string | null) => void;

  // Filter helpers
  isNodeVisible: (nodeEntryId: string) => boolean;
  isNodeVisibleByPath: (nodePath: string) => boolean;
  getVisibleNodes: () => HierarchicalBOMNode[];

  // Selected node info
  selectedNode: HierarchicalBOMNode | null;

  // Dropdown options (hierarchically organized)
  dropdownOptions: Array<{
    entryId: string | null;
    label: string;
    level: number;
    isSelected: boolean;
  }>;
}

export function useHierarchicalBOMFilter(
  bomDetailData: BOMDetailData | null | undefined
): UseHierarchicalBOMFilterResult {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Build hierarchical BOM structure from API data
  const { allNodes, mainBOMs, nodeMap, pathToNodeMap } = useMemo(() => {
    if (!bomDetailData?.bom_instances?.length) {
      return { allNodes: [], mainBOMs: [], nodeMap: new Map(), pathToNodeMap: new Map() };
    }

    const nodes: HierarchicalBOMNode[] = [];
    const nMap = new Map<string, HierarchicalBOMNode>();
    const pMap = new Map<string, HierarchicalBOMNode>();
    const mains: HierarchicalBOMNode[] = [];

    bomDetailData.bom_instances.forEach((instance, instanceIdx) => {
      const instanceLabel = bomDetailData.bom_instances.length > 1
        ? ` (#${instance.instance_index})`
        : '';

      // Process hierarchy in order (it should be depth-first from API)
      instance.hierarchy.forEach((bomLevel) => {
        const isMain = bomLevel.bom_level === 0;

        // For main BOM, entry_id is the BOMModuleLinkage.entry_id
        // For sub-BOMs, we need to use the path as key since entry_id isn't directly available
        // We'll use a composite key: instanceId + path
        const entryId = isMain
          ? instance.main_bom.entry_id
          : `${instance.main_bom.entry_id}::${bomLevel.bom_path}`;

        // Determine parent entry_id
        let parentEntryId: string | null = null;
        if (!isMain && bomLevel.parent_bom_code) {
          // Find parent in the current instance
          const parentPath = bomLevel.bom_path.split(' > ').slice(0, -1).join(' > ');
          // Check if parentPath is a sub-BOM path (contains " > ") or just the main BOM code
          if (parentPath && parentPath.includes(' > ')) {
            // Parent is a sub-BOM
            parentEntryId = `${instance.main_bom.entry_id}::${parentPath}`;
          } else {
            // Direct child of main BOM (parentPath is just the main BOM code)
            parentEntryId = instance.main_bom.entry_id;
          }
        }

        // Build ancestor chain
        const ancestorEntryIds: string[] = [];
        if (parentEntryId) {
          ancestorEntryIds.push(parentEntryId);
          // Walk up the path to collect all ancestors
          const pathParts = bomLevel.bom_path.split(' > ');
          for (let i = pathParts.length - 2; i >= 1; i--) {
            const ancestorPath = pathParts.slice(0, i + 1).join(' > ');
            ancestorEntryIds.push(`${instance.main_bom.entry_id}::${ancestorPath}`);
          }
          // Add main BOM as root ancestor
          if (!ancestorEntryIds.includes(instance.main_bom.entry_id)) {
            ancestorEntryIds.push(instance.main_bom.entry_id);
          }
        }

        // Build display label with arrows
        const indent = '  '.repeat(bomLevel.bom_level);
        const arrow = bomLevel.bom_level > 0 ? '→ ' : '';
        const displayLabel = `${indent}${arrow}${bomLevel.bom_code}${isMain ? instanceLabel : ''} (${bomLevel.bom_quantity})`;

        const node: HierarchicalBOMNode = {
          entryId,
          bomInstanceId: instance.main_bom.entry_id,
          code: bomLevel.bom_code + (isMain ? instanceLabel : ''),
          name: bomLevel.bom_name,
          path: bomLevel.bom_path,
          level: bomLevel.bom_level,
          quantity: bomLevel.bom_quantity,
          parentEntryId,
          ancestorEntryIds,
          instanceLabel: isMain ? instanceLabel : '',
          displayLabel
        };

        nodes.push(node);
        nMap.set(entryId, node);
        pMap.set(bomLevel.bom_path + (isMain ? instanceLabel : ''), node);

        if (isMain) {
          mains.push(node);
        }
      });
    });

    return { allNodes: nodes, mainBOMs: mains, nodeMap: nMap, pathToNodeMap: pMap };
  }, [bomDetailData]);

  // Selected node
  const selectedNode = useMemo(() => {
    if (!selectedEntryId) return null;
    return nodeMap.get(selectedEntryId) || null;
  }, [selectedEntryId, nodeMap]);

  // Check if a node should be visible based on current filter
  const isNodeVisible = useCallback((nodeEntryId: string): boolean => {
    if (!selectedEntryId) return true; // All BOMs selected

    const node = nodeMap.get(nodeEntryId);
    if (!node) return false;

    // Node is visible if:
    // 1. It IS the selected node
    // 2. It has the selected node as an ancestor (it's a descendant of selected)

    if (nodeEntryId === selectedEntryId) return true;
    if (node.ancestorEntryIds.includes(selectedEntryId)) return true;

    return false;
  }, [selectedEntryId, nodeMap]);

  // Check visibility by path (for compatibility with existing code)
  const isNodeVisibleByPath = useCallback((nodePath: string): boolean => {
    if (!selectedEntryId) return true;

    // Find the node by path
    const node = Array.from(nodeMap.values()).find(n =>
      n.path === nodePath || n.path.startsWith(nodePath + ' > ')
    );

    if (!node) return false;
    return isNodeVisible(node.entryId);
  }, [selectedEntryId, nodeMap, isNodeVisible]);

  // Get all visible nodes
  const getVisibleNodes = useCallback((): HierarchicalBOMNode[] => {
    if (!selectedEntryId) return allNodes;
    return allNodes.filter(node => isNodeVisible(node.entryId));
  }, [selectedEntryId, allNodes, isNodeVisible]);

  // Build dropdown options
  const dropdownOptions = useMemo(() => {
    const options: Array<{
      entryId: string | null;
      label: string;
      level: number;
      isSelected: boolean;
    }> = [
      { entryId: null, label: 'All BOMs', level: -1, isSelected: selectedEntryId === null }
    ];

    allNodes.forEach(node => {
      options.push({
        entryId: node.entryId,
        label: node.displayLabel,
        level: node.level,
        isSelected: selectedEntryId === node.entryId
      });
    });

    return options;
  }, [allNodes, selectedEntryId]);

  return {
    allNodes,
    mainBOMs,
    selectedEntryId,
    setSelectedEntryId,
    isNodeVisible,
    isNodeVisibleByPath,
    getVisibleNodes,
    selectedNode,
    dropdownOptions
  };
}

// Level labels for display
export const BOM_LEVEL_LABELS: Record<number, string> = {
  0: 'Main BOM',
  1: 'Sub-BOM',
  2: 'Sub-Sub-BOM',
  3: 'L3-BOM',
  4: 'L4-BOM',
};

// Level colors for badges
export const BOM_LEVEL_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: 'bg-blue-100', text: 'text-blue-700' },
  1: { bg: 'bg-green-100', text: 'text-green-700' },
  2: { bg: 'bg-purple-100', text: 'text-purple-700' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700' },
  4: { bg: 'bg-pink-100', text: 'text-pink-700' },
};
