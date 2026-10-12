/**
 * Drugs and consumables a dermatology / paediatric / plastic-surgery pharmacy restocks
 * all the time, so a wholesaler bill can be keyed in with one click per line instead
 * of a catalogue search. Anything not yet in the catalogue is created on submit.
 */
export interface CommonMedicine {
  name: string;
  unit: string;
  category: MedicineCategory;
}

export type MedicineCategory = 'TABLETS' | 'SYRUPS' | 'CREAMS' | 'LOTIONS' | 'INJECTIONS' | 'DRESSINGS';

export const CATEGORY_LABEL: Record<MedicineCategory, string> = {
  TABLETS: 'Tablets & Capsules',
  SYRUPS: 'Syrups & Drops',
  CREAMS: 'Creams, Ointments & Gels',
  LOTIONS: 'Lotions & Shampoos',
  INJECTIONS: 'Injections',
  DRESSINGS: 'Dressings & Surgical',
};

/** Starting rack per category — the pharmacist can rename these on the refill screen. */
export const DEFAULT_CATEGORY_RACK: Record<MedicineCategory, string> = {
  TABLETS: 'Rack A',
  SYRUPS: 'Rack B',
  CREAMS: 'Rack C',
  LOTIONS: 'Rack D',
  INJECTIONS: 'Rack E',
  DRESSINGS: 'Rack F',
};

/** Suggestions for a new medicine's dispensing unit. */
export const COMMON_UNITS = ['tablet', 'capsule', 'bottle', 'tube', 'vial', 'ampoule', 'sachet', 'piece', 'roll', 'pack', 'pair'];

const m = (category: MedicineCategory, unit: string, names: string[]): CommonMedicine[] =>
  names.map((name) => ({ name, unit, category }));

export const COMMON_MEDICINES: CommonMedicine[] = [
  ...m('TABLETS', 'tablet', [
    'Paracetamol 500mg',
    'Paracetamol 650mg',
    'Cetirizine 10mg',
    'Levocetirizine 5mg',
    'Fexofenadine 120mg',
    'Ibuprofen 400mg',
    'Amoxicillin + Clavulanic Acid 625mg',
    'Azithromycin 500mg',
    'Cefuroxime 500mg',
    'Fluconazole 150mg',
    'Terbinafine 250mg',
    'Pantoprazole 40mg',
    'Ondansetron 4mg',
    'Prednisolone 10mg',
  ]),
  ...m('TABLETS', 'capsule', ['Doxycycline 100mg', 'Itraconazole 100mg', 'Isotretinoin 20mg']),
  ...m('SYRUPS', 'bottle', [
    'Paracetamol Syrup 120mg/5ml',
    'Paracetamol Drops 100mg/ml',
    'Ibuprofen Syrup 100mg/5ml',
    'Cetirizine Syrup 5mg/5ml',
    'Amoxicillin + Clavulanic Acid Dry Syrup 228.5mg/5ml',
    'Azithromycin Syrup 200mg/5ml',
    'Ondansetron Syrup 2mg/5ml',
    'Zinc Syrup 20mg/5ml',
    'Multivitamin Drops',
    'Saline Nasal Drops',
  ]),
  ...m('SYRUPS', 'sachet', ['ORS Powder']),
  ...m('CREAMS', 'tube', [
    'Mupirocin 2% Ointment',
    'Fusidic Acid 2% Cream',
    'Clotrimazole 1% Cream',
    'Luliconazole 1% Cream',
    'Ketoconazole 2% Cream',
    'Hydrocortisone 1% Cream',
    'Mometasone 0.1% Cream',
    'Clobetasol 0.05% Cream',
    'Silver Sulfadiazine 1% Cream',
    'Permethrin 5% Cream',
    'Adapalene 0.1% Gel',
    'Benzoyl Peroxide 2.5% Gel',
    'Tretinoin 0.025% Cream',
    'Silicone Scar Gel',
  ]),
  ...m('LOTIONS', 'bottle', [
    'Calamine Lotion',
    'Ketoconazole 2% Shampoo',
    'Sunscreen SPF 50 Lotion',
    'Emollient Moisturising Lotion',
    'Povidone Iodine 5% Solution',
  ]),
  ...m('INJECTIONS', 'vial', ['Lignocaine 2% Injection', 'Ceftriaxone 1g Injection', 'Triamcinolone 40mg Injection']),
  ...m('INJECTIONS', 'ampoule', [
    'Dexamethasone 4mg Injection',
    'Diclofenac 75mg Injection',
    'Ondansetron 4mg Injection',
    'Tetanus Toxoid Injection',
  ]),
  ...m('DRESSINGS', 'pack', ['Sterile Gauze Pads']),
  ...m('DRESSINGS', 'roll', ['Crepe Bandage 10cm', 'Micropore Tape 1 inch']),
  ...m('DRESSINGS', 'piece', ['Paraffin Gauze Dressing', 'Nylon Suture 4-0', 'Disposable Syringe 5ml']),
  ...m('DRESSINGS', 'pair', ['Sterile Surgical Gloves']),
];
