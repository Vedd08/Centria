import React, { useState } from 'react';
import { MedicineItem } from './MedicineList';
import { Pill, Box, AlertCircle, Info, PackageOpen, Layers } from 'lucide-react';
import { money } from '../Queue/types';

interface ShelfViewProps {
  medicines: MedicineItem[];
}

export const ShelfView: React.FC<ShelfViewProps> = ({ medicines }) => {
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineItem | null>(null);

  // Group medicines by shelf
  const shelves = medicines.reduce((acc, med) => {
    const shelfName = med.shelf && med.shelf.trim() ? med.shelf.trim() : 'Unassigned';
    if (!acc[shelfName]) acc[shelfName] = [];
    acc[shelfName].push(med);
    return acc;
  }, {} as Record<string, MedicineItem[]>);

  const shelfNames = Object.keys(shelves).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8 font-sans mt-4">
      {shelfNames.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center flex flex-col items-center shadow-sm">
          <Layers className="w-10 h-10 text-ink-secondary/50 mb-3" />
          <h3 className="text-sm font-semibold text-ink-primary">No Medicines Found</h3>
          <p className="text-xs text-ink-secondary mt-1">
            Medicines added to the catalog will appear on their assigned shelves here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {shelfNames.map((shelfName) => (
            <div key={shelfName} className="flex flex-col">
              <div className="flex items-center justify-between bg-gradient-to-r from-surface-card to-surface-page px-5 py-3 rounded-t-[12px] border border-b-0 border-border shadow-sm">
                <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand" /> {shelfName}
                </h3>
                <span className="text-[10px] uppercase font-bold text-ink-secondary tracking-wider bg-surface-card px-2 py-1 rounded-md border border-border/50">
                  {shelves[shelfName].length} items
                </span>
              </div>
              
              <div className="bg-[#1a1c23] border border-border rounded-b-[12px] p-6 shadow-inner relative overflow-hidden">
                {/* Subtle backlighting effect */}
                <div className="absolute top-0 left-1/4 w-1/2 h-full bg-brand/5 blur-[80px] pointer-events-none rounded-full" />
                
                <div className="flex flex-wrap gap-4 items-end min-h-[140px] relative z-10 pb-4 border-b-4 border-[#2a2c35] shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
                  {shelves[shelfName].map((med) => {
                    const isLowStock = med.stockQty <= med.reorderPoint;
                    const isSelected = selectedMedicine?.id === med.id;
                    
                    return (
                      <div 
                        key={med.id}
                        onClick={() => setSelectedMedicine(isSelected ? null : med)}
                        className={`relative group cursor-pointer transition-all duration-300 ease-out transform ${
                          isSelected ? 'scale-110 z-20 -translate-y-2' : 'hover:scale-105 hover:-translate-y-1 z-10'
                        }`}
                      >
                        {/* Shadow on the shelf */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/40 blur-[3px] rounded-[100%]" />
                        
                        {/* Medicine Bottle / Box Representation */}
                        <div className={`relative flex flex-col items-center justify-center w-12 h-16 rounded-md border-2 overflow-hidden shadow-lg transition-colors ${
                          isSelected 
                            ? 'border-brand bg-gradient-to-b from-brand/20 to-brand/5' 
                            : isLowStock 
                              ? 'border-rose-500/50 bg-gradient-to-b from-rose-500/10 to-transparent hover:border-rose-400' 
                              : 'border-white/10 bg-gradient-to-b from-white/5 to-transparent hover:border-white/30'
                        }`}>
                          <div className="absolute top-0 w-full h-3 bg-white/10" /> {/* Cap reflection */}
                          {['tablet', 'capsule'].includes(med.unit.toLowerCase()) ? (
                            <Pill className={`w-5 h-5 ${isLowStock ? 'text-rose-400' : 'text-sky-300'}`} />
                          ) : (
                            <Box className={`w-5 h-5 ${isLowStock ? 'text-rose-400' : 'text-emerald-300'}`} />
                          )}
                          
                          {/* Label mock */}
                          <div className="absolute bottom-2 w-[70%] h-4 bg-white/90 rounded-[2px] flex items-center justify-center overflow-hidden">
                            <span className="text-[6px] font-bold text-gray-800 truncate px-0.5 w-full text-center">
                              {med.name.substring(0, 5)}
                            </span>
                          </div>
                        </div>

                        {/* Low Stock Pulsing Dot */}
                        {isLowStock && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-[#1a1c23]"></span>
                          </span>
                        )}

                        {/* Info Popover (shows on click) */}
                        {isSelected && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-surface-card border border-border rounded-lg shadow-xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-xs font-bold text-ink-primary leading-tight pr-4">{med.name}</h4>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedMedicine(null); }}
                                className="absolute top-2 right-2 text-ink-secondary hover:text-ink-primary"
                              >
                                &times;
                              </button>
                            </div>
                            
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-ink-secondary">In Stock:</span>
                                <span className={`font-mono font-bold ${isLowStock ? 'text-status-danger' : 'text-ink-primary'}`}>
                                  {med.stockQty} {med.unit}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ink-secondary">Reorder At:</span>
                                <span className="font-mono">{med.reorderPoint}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-ink-secondary">Price:</span>
                                <span className="font-mono font-bold text-brand-deep">{money(med.unitPrice)}</span>
                              </div>
                            </div>
                            
                            {isLowStock && (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-status-danger bg-status-danger/10 px-2 py-1 rounded">
                                <AlertCircle className="w-3 h-3" /> Reorder required
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Multiple shelves in the same rack if there are too many items? 
                    For now, flex-wrap will push them to new lines, but visually they might float if we don't draw intermediate borders. 
                    Let's assume a single long shelf with flex-wrap. We can add a repeating background to simulate multiple shelves. */}
                <div className="absolute bottom-0 left-0 w-full h-[4px] bg-[#333] shadow-[0_2px_4px_rgba(0,0,0,0.5)_inset]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
