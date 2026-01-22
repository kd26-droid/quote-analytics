import { useState, useRef, useEffect } from 'react';
import { BOM_LEVEL_COLORS } from '../../../hooks/useHierarchicalBOMFilter';

interface DropdownOption {
  entryId: string | null;
  label: string;
  level: number;
  isSelected: boolean;
}

interface HierarchicalBOMDropdownProps {
  options: DropdownOption[];
  selectedEntryId: string | null;
  onSelect: (entryId: string | null) => void;
  placeholder?: string;
}

export default function HierarchicalBOMDropdown({
  options,
  selectedEntryId,
  onSelect,
  placeholder = 'Select BOM'
}: HierarchicalBOMDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options by search
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected option label
  const selectedOption = options.find(opt => opt.entryId === selectedEntryId);
  const buttonLabel = selectedOption
    ? (selectedOption.level === -1 ? 'All BOMs' : selectedOption.label.trim())
    : placeholder;

  const isFiltered = selectedEntryId !== null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors min-w-[200px] ${
          isFiltered
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="truncate flex-1 text-left">{buttonLabel}</span>
        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80 max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search BOMs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-72 overflow-y-auto">
            {filteredOptions.map((option) => {
              const isAll = option.level === -1;
              const levelColors = BOM_LEVEL_COLORS[option.level] || { bg: 'bg-gray-100', text: 'text-gray-700' };

              return (
                <button
                  key={option.entryId || 'all'}
                  onClick={() => {
                    onSelect(option.entryId);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                    option.isSelected ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                  style={{ paddingLeft: isAll ? 12 : 12 + option.level * 16 }}
                >
                  {/* Level badge */}
                  {!isAll && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${levelColors.bg} ${levelColors.text}`}>
                      {option.level === 0 ? 'M' : option.level === 1 ? 'S' : 'SS'}
                    </span>
                  )}

                  {/* Label */}
                  <span className={`truncate ${option.isSelected ? 'font-medium' : ''}`}>
                    {isAll ? (
                      <span className="font-medium">All BOMs</span>
                    ) : (
                      option.label.trim()
                    )}
                  </span>

                  {/* Checkmark */}
                  {option.isSelected && (
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No BOMs found matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Footer */}
          {isFiltered && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => {
                  onSelect(null);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium"
              >
                Clear Filter (Show All)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
