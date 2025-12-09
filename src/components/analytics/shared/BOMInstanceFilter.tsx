import { useState } from 'react';
import type { BOMInstanceInfo } from '../../../hooks/useBOMInstances';

interface BOMInstanceFilterProps {
  bomInstances: BOMInstanceInfo[];
  selectedInstances: string[];
  onSelectionChange: (selected: string[]) => void;
  hasVolumeScenarios: boolean;
}

/**
 * Shared BOM Instance Filter dropdown component.
 * Only renders when hasVolumeScenarios is true (same BOM with different quantities).
 */
export default function BOMInstanceFilter({
  bomInstances,
  selectedInstances,
  onSelectionChange,
  hasVolumeScenarios
}: BOMInstanceFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if no volume scenarios
  if (!hasVolumeScenarios) {
    return null;
  }

  const toggleSelection = (instanceId: string) => {
    if (instanceId === 'all') {
      onSelectionChange(['all']);
      return;
    }

    let newSelection = selectedInstances.filter(id => id !== 'all');

    if (newSelection.includes(instanceId)) {
      newSelection = newSelection.filter(id => id !== instanceId);
      if (newSelection.length === 0) {
        onSelectionChange(['all']);
        return;
      }
    } else {
      newSelection.push(instanceId);
    }

    onSelectionChange(newSelection);
  };

  const isActive = !selectedInstances.includes('all');

  return (
    <div className="relative filter-dropdown">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>BOM Instance</span>
        <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
          {selectedInstances.includes('all') ? 'All' : selectedInstances.length}
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80">
          {/* Volume Scenarios Notice */}
          <div className="px-3 py-2 bg-cyan-50 border-b border-cyan-100 text-xs text-cyan-700">
            <strong>Volume scenarios:</strong> Same BOM with different quantities
          </div>

          {/* Select All */}
          <div className="px-2 py-2 border-b border-gray-100">
            <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedInstances.includes('all')}
                onChange={() => onSelectionChange(['all'])}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-900">All Instances</span>
              <span className="text-xs text-gray-500 ml-auto">{bomInstances.length}</span>
            </label>
          </div>

          {/* BOM Instances List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {bomInstances.map(instance => {
              const isSelected = selectedInstances.includes(instance.instanceId);
              return (
                <label
                  key={instance.instanceId}
                  className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                    isSelected ? 'bg-cyan-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(instance.instanceId)}
                    className="rounded border-gray-300"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-gray-900">{instance.label}</span>
                    <span className="text-xs text-gray-500 truncate">{instance.bomName}</span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Actions */}
          <div className="p-2 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => onSelectionChange(['all'])}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter pill component to show active BOM instance filters
 */
export function BOMInstanceFilterPills({
  bomInstances,
  selectedInstances,
  onSelectionChange,
  hasVolumeScenarios
}: BOMInstanceFilterProps) {
  // Don't render if no volume scenarios or all selected
  if (!hasVolumeScenarios || selectedInstances.includes('all')) {
    return null;
  }

  const removeInstance = (instanceId: string) => {
    const newSelection = selectedInstances.filter(id => id !== instanceId);
    onSelectionChange(newSelection.length > 0 ? newSelection : ['all']);
  };

  return (
    <>
      {selectedInstances.map(instId => {
        const instance = bomInstances.find(b => b.instanceId === instId);
        return (
          <span
            key={`inst-${instId}`}
            className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs"
          >
            Instance: {instance?.label || instId}
            <button
              onClick={() => removeInstance(instId)}
              className="hover:text-cyan-900 font-bold"
            >
              ×
            </button>
          </span>
        );
      })}
    </>
  );
}

/**
 * Helper to get filter display text for BOM instances
 */
export function getBOMInstanceFilterText(
  bomInstances: BOMInstanceInfo[],
  selectedInstances: string[]
): string {
  if (selectedInstances.includes('all')) return '';

  const labels = selectedInstances.map(instId => {
    const instance = bomInstances.find(b => b.instanceId === instId);
    return instance?.label || instId;
  });

  return ` • Instance: ${labels.join(', ')}`;
}
