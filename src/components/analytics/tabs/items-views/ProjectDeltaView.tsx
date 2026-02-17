import { useState } from 'react';
import { Card, CardContent } from '../../../ui/card';
import type { ProjectDeltaData, ProjectDeltaBOMInstance, ProjectDeltaBOMItem } from '../../../../services/api';
import type { TabType, NavigationContext } from '../../QuoteAnalyticsDashboard';

interface ProjectDeltaViewProps {
  projectDeltaData?: ProjectDeltaData | null;
  currencySymbol: string;
  navigateToTab: (tab: TabType, context?: NavigationContext) => void;
  navigationContext?: NavigationContext;
  filterResetKey?: number;
  onClearAllFilters?: () => void;
}

export default function ProjectDeltaView({ projectDeltaData }: ProjectDeltaViewProps) {
  const [expandedBOMs, setExpandedBOMs] = useState<Set<string>>(new Set());

  if (!projectDeltaData) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-10 text-center text-gray-400">
          <p className="text-base font-medium">No Project Linked</p>
          <p className="text-sm mt-1">This quote was not created from a project.</p>
        </CardContent>
      </Card>
    );
  }

  const { overall_summary: os, standalone_items, bom_instances, project, quote, quote_only_items, quote_only_boms } = projectDeltaData;

  // Totals
  const totalProjectItems = os.total_project_standalone_items + os.total_project_bom_items;
  const totalExported = (os.standalone_matched + os.standalone_qty_changed) + (os.bom_items_matched + os.bom_items_qty_changed);
  const totalMissing = os.standalone_missing + os.bom_items_missing;
  const totalQtyChanged = os.standalone_qty_changed + os.bom_items_qty_changed;
  const coveragePct = totalProjectItems > 0 ? Math.round((totalExported / totalProjectItems) * 100) : 100;

  // Collect all "not exported" items across standalone + BOMs
  const missingStandalone = standalone_items.items.filter(i => i.status === 'NOT_IN_QUOTE');
  const missingBOMSlabs = bom_instances.instances.filter(i => i.status === 'NOT_IN_QUOTE');

  // Collect all qty changed items
  const changedStandalone = standalone_items.items.filter(i => i.status === 'QTY_CHANGED');
  const changedBOMItems: { bomCode: string; bomQty: number; item: ProjectDeltaBOMItem }[] = [];
  bom_instances.instances.forEach(inst => {
    inst.items.forEach(item => {
      if (item.status === 'QTY_CHANGED' && !item.is_sub_bom_ref) {
        changedBOMItems.push({ bomCode: inst.bom_code, bomQty: inst.project_quantity, item });
      }
    });
  });

  // BOM slabs that are matched (for the "all good" section)
  const matchedBOMSlabs = bom_instances.instances.filter(i => i.status !== 'NOT_IN_QUOTE');

  const toggleBOM = (id: string) => {
    setExpandedBOMs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasIssues = totalMissing > 0 || totalQtyChanged > 0;
  const hasQuoteOnlyItems = quote_only_items && quote_only_items.count > 0;
  const hasQuoteOnlyBOMs = quote_only_boms && quote_only_boms.count > 0;
  const hasQuoteOnly = hasQuoteOnlyItems || hasQuoteOnlyBOMs;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Project</span>
            <span className="font-semibold text-gray-900">{project.project_code}</span>
            <span className="text-gray-400">({project.project_name})</span>
            <span className="text-gray-300 mx-1">&rarr;</span>
            <span className="text-gray-500">Quote</span>
            <span className="font-semibold text-gray-900">{quote.quote_name}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Coverage Bar ── */}
      <Card className="border-gray-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Export Coverage</span>
            <span className="text-2xl font-bold text-gray-900">{coveragePct}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${coveragePct === 100 ? 'bg-green-500' : coveragePct >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          {/* Counts below bar */}
          <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
            <span>{totalExported} of {totalProjectItems} items exported</span>
            {os.total_project_bom_instances > 0 && (
              <span>{os.bom_instances_matched} of {os.total_project_bom_instances} BOMs exported</span>
            )}
            {totalMissing > 0 && <span className="text-red-600 font-medium">{totalMissing} missing</span>}
            {totalQtyChanged > 0 && <span className="text-amber-600 font-medium">{totalQtyChanged} qty changed</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Issues: Not Exported ── */}
      {totalMissing > 0 && (
        <Card className="border-red-200">
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-red-50 border-b border-red-200">
              <span className="text-sm font-semibold text-red-800">Not Exported</span>
              <span className="ml-2 text-xs text-red-600">
                {totalMissing} item{totalMissing !== 1 ? 's' : ''} from the project didn't make it into the quote
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Missing standalone items */}
              {missingStandalone.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Standalone Items</div>
                  <div className="space-y-1">
                    {missingStandalone.map(item => (
                      <div key={item.project_item_id} className="flex items-center justify-between py-1.5 px-3 bg-red-50/50 rounded text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-gray-800">{item.item_code}</span>
                          <span className="text-gray-600">{item.item_name}</span>
                        </div>
                        <span className="text-gray-500 text-xs">Qty: {item.project_quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing BOM slabs */}
              {missingBOMSlabs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">BOM Slabs</div>
                  <div className="space-y-2">
                    {missingBOMSlabs.map(inst => (
                      <MissingBOMCard key={inst.project_bom_entry_id} inst={inst} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Issues: Qty Changed ── */}
      {totalQtyChanged > 0 && (
        <Card className="border-amber-200">
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
              <span className="text-sm font-semibold text-amber-800">Quantity Changed</span>
              <span className="ml-2 text-xs text-amber-600">
                {totalQtyChanged} item{totalQtyChanged !== 1 ? 's' : ''} have different quantities in the quote
              </span>
            </div>
            <div className="p-4 space-y-1">
              {changedStandalone.map(item => (
                <div key={item.project_item_id} className="flex items-center justify-between py-1.5 px-3 bg-amber-50/50 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-800">{item.item_code}</span>
                    <span className="text-gray-600">{item.item_name}</span>
                  </div>
                  <span className="font-mono text-xs">
                    <span className="text-gray-400 line-through">{item.project_quantity}</span>
                    <span className="mx-1.5 text-gray-300">&rarr;</span>
                    <span className="text-amber-700 font-semibold">{item.quote_quantity}</span>
                  </span>
                </div>
              ))}
              {changedBOMItems.map(({ bomCode, bomQty, item }, idx) => (
                <div key={`bom-${idx}`} className="flex items-center justify-between py-1.5 px-3 bg-amber-50/50 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-800">{item.item_code || '—'}</span>
                    <span className="text-gray-600">{item.item_name || '—'}</span>
                    <span className="text-[10px] text-gray-400">in {bomCode} (Qty: {bomQty})</span>
                  </div>
                  <span className="font-mono text-xs">
                    <span className="text-gray-400 line-through">{item.project_quantity}</span>
                    <span className="mx-1.5 text-gray-300">&rarr;</span>
                    <span className="text-amber-700 font-semibold">{item.quote_quantity}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Added to Quote (items & BOMs not from project) ── */}
      {hasQuoteOnly && (
        <Card className="border-blue-200">
          <CardContent className="p-0">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-semibold text-blue-800">Added to Quote</span>
              <span className="ml-2 text-xs text-blue-600">
                Items & BOMs in the quote that weren't in the project
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Quote-only BOMs */}
              {hasQuoteOnlyBOMs && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">BOMs ({quote_only_boms!.count})</div>
                  <div className="space-y-1">
                    {quote_only_boms!.boms.map(bom => (
                      <div key={bom.quote_bom_entry_id} className="flex items-center justify-between py-1.5 px-3 bg-blue-50/30 rounded text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-gray-800">{bom.bom_code}</span>
                          <span className="text-gray-600">{bom.bom_name}</span>
                        </div>
                        <span className="text-gray-500 text-xs">Qty: {bom.quantity} &middot; {bom.items_count} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quote-only items */}
              {hasQuoteOnlyItems && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Standalone Items ({quote_only_items!.count})</div>
                  <div className="space-y-1">
                    {quote_only_items!.items.map(item => (
                      <div key={item.costing_sheet_item_id} className="flex items-center justify-between py-1.5 px-3 bg-blue-50/30 rounded text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-gray-800">{item.item_code}</span>
                          <span className="text-gray-600 truncate max-w-[300px]" title={item.item_name}>{item.item_name}</span>
                        </div>
                        <span className="text-gray-500 text-xs">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── All Good message ── */}
      {!hasIssues && !hasQuoteOnly && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-5 text-center">
            <span className="text-green-700 font-semibold text-sm">Everything from the project is in the quote.</span>
          </CardContent>
        </Card>
      )}

      {/* ── BOM Breakdown ── */}
      {bom_instances.instances.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-gray-700">All BOMs</span>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setExpandedBOMs(new Set(bom_instances.instances.map(i => i.project_bom_entry_id)))}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >Expand All</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setExpandedBOMs(new Set())} className="text-blue-600 hover:text-blue-800 font-medium">Collapse All</button>
            </div>
          </div>

          {bom_instances.instances.map(inst => {
            const isExpanded = expandedBOMs.has(inst.project_bom_entry_id);
            const isMissing = inst.status === 'NOT_IN_QUOTE';
            const itemsOk = inst.items_summary.matched;
            const itemsTotal = inst.items_summary.project_count;

            return (
              <Card
                key={inst.project_bom_entry_id}
                className={`border-gray-200 ${isMissing ? 'border-l-4 border-l-red-300' : ''}`}
              >
                <CardContent className="p-0">
                  {/* BOM header row */}
                  <div
                    className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 text-sm"
                    onClick={() => toggleBOM(inst.project_bom_entry_id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                      <span className="font-mono font-semibold text-gray-900">{inst.bom_code}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-gray-600">{inst.bom_name}</span>
                      <span className="text-gray-400 text-xs">(Qty: {inst.project_quantity})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">{itemsOk}/{itemsTotal} items</span>
                      <StatusTag status={inst.status} />
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                            <th className="px-4 py-2 text-left font-medium">Item</th>
                            <th className="px-4 py-2 text-right font-medium">Project Qty</th>
                            <th className="px-4 py-2 text-right font-medium">Quote Qty</th>
                            <th className="px-4 py-2 text-center font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inst.items.map((item, idx) => (
                            <BOMItemRow key={idx} item={item} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Standalone Items (if any, shown as simple list) ── */}
      {standalone_items.items.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-semibold text-gray-700 px-1">
            Standalone Items
            <span className="ml-1 font-normal text-gray-400 text-xs">({standalone_items.items.length})</span>
          </span>
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">Item Code</th>
                    <th className="px-4 py-2 text-left font-medium">Item Name</th>
                    <th className="px-4 py-2 text-right font-medium">Project Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Quote Qty</th>
                    <th className="px-4 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {standalone_items.items.map(item => (
                    <tr
                      key={item.project_item_id}
                      className={`border-b border-gray-100 ${item.status === 'NOT_IN_QUOTE' ? 'bg-red-50' : item.status === 'QTY_CHANGED' ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-4 py-2 font-mono text-gray-800">{item.item_code}</td>
                      <td className="px-4 py-2 text-gray-600 truncate max-w-[250px]">{item.item_name}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-700">{item.project_quantity}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {item.quote_quantity !== null ? item.quote_quantity : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center"><StatusTag status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


/* ── Status Tag ── */
function StatusTag({ status }: { status: string }) {
  if (status === 'MATCHED') return <span className="text-green-600 text-xs font-medium">&#10003; Matched</span>;
  if (status === 'QTY_CHANGED') return <span className="text-amber-600 text-xs font-medium">&#9651; Changed</span>;
  return <span className="text-red-600 text-xs font-medium">&#10007; Missing</span>;
}


/* ── Missing BOM Card ── */
function MissingBOMCard({ inst }: { inst: ProjectDeltaBOMInstance }) {
  const [showItems, setShowItems] = useState(false);
  return (
    <div className="bg-red-50/50 rounded-lg border border-red-100 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold text-gray-800">{inst.bom_code}</span>
          <span className="text-gray-500">— {inst.bom_name}</span>
          <span className="text-gray-400 text-xs">(Qty: {inst.project_quantity})</span>
        </div>
        <span className="text-xs text-red-600">{inst.items_summary.project_count} items not exported</span>
      </div>
      {inst.items.length > 0 && (
        <button onClick={() => setShowItems(!showItems)} className="text-[10px] text-red-500 hover:text-red-700 mt-1">
          {showItems ? 'Hide items' : 'Show items'}
        </button>
      )}
      {showItems && (
        <div className="mt-2 space-y-0.5">
          {inst.items.filter(i => !i.is_sub_bom_ref).map((item, idx) => (
            <div key={idx} className="text-xs text-gray-600 pl-2">
              <span className="font-mono">{item.item_code || '—'}</span> — {item.item_name || '—'} (Qty: {item.project_quantity})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── BOM Item Row ── */
function BOMItemRow({ item }: { item: ProjectDeltaBOMItem }) {
  const indent = item.bom_level === 'SUB' ? 20 : item.bom_level === 'SUB_SUB' ? 40 : 0;

  if (item.is_sub_bom_ref) {
    const name = item.sub_bom_code || item.bom_path.split(' > ').pop() || '';
    return (
      <tr className="bg-gray-50/50 border-b border-gray-100">
        <td className="px-4 py-1.5 text-gray-400 italic" style={{ paddingLeft: `${16 + indent}px` }}>
          &#9495; {name}
        </td>
        <td className="px-4 py-1.5 text-right font-mono text-gray-400">{item.project_quantity}</td>
        <td className="px-4 py-1.5 text-right font-mono text-gray-400">
          {item.quote_quantity !== null ? item.quote_quantity : '—'}
        </td>
        <td className="px-4 py-1.5 text-center"><StatusTag status={item.status} /></td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-gray-100 ${item.status === 'NOT_IN_QUOTE' ? 'bg-red-50/50' : item.status === 'QTY_CHANGED' ? 'bg-amber-50/50' : ''}`}>
      <td className="px-4 py-1.5 text-gray-700" style={{ paddingLeft: `${16 + indent}px` }}>
        <span className="font-mono text-gray-800">{item.item_code || '—'}</span>
        {item.item_name && <span className="text-gray-500 ml-2">{item.item_name}</span>}
      </td>
      <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.project_quantity}</td>
      <td className="px-4 py-1.5 text-right font-mono">
        {item.quote_quantity !== null ? item.quote_quantity : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-1.5 text-center"><StatusTag status={item.status} /></td>
    </tr>
  );
}
