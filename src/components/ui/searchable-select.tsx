import { useState, useMemo } from 'react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Search...', className = '' }: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedOption?.label || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          placeholder={placeholder}
          className={`${className} cursor-pointer`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No results found</div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                    option.value === value ? 'bg-blue-100 font-semibold' : ''
                  }`}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
