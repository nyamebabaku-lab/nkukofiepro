// Common poultry drugs in Ghana with typical withdrawal periods (days after the LAST dose before
// meat or eggs may be sold). Brands differ — the label on the product always wins.
// eggs: null = not allowed for laying hens producing eggs for people.
export const DRUGS = [
  { name: 'Oxytetracycline 20%', use: 'Bacterial infections, CRD, after stress', meat: 7, eggs: 7, days: 5 },
  { name: 'Doxycycline', use: 'Respiratory infections, CRD', meat: 7, eggs: null, days: 5 },
  { name: 'Tylosin', use: 'CRD / mycoplasma', meat: 5, eggs: 0, days: 5 },
  { name: 'Enrofloxacin 10%', use: 'E. coli, salmonella, fowl typhoid', meat: 7, eggs: null, days: 5 },
  { name: 'Ciprofloxacin', use: 'E. coli, salmonella', meat: 7, eggs: null, days: 5 },
  { name: 'Neomycin + Oxytetracycline (Neoxyvital)', use: 'Diarrhoea, bacterial infections', meat: 7, eggs: 7, days: 5 },
  { name: 'Amoxicillin', use: 'Bacterial infections', meat: 3, eggs: null, days: 5 },
  { name: 'Sulfadimidine / Sulfa drugs', use: 'Coccidiosis, fowl cholera', meat: 10, eggs: null, days: 5 },
  { name: 'Trimethoprim + Sulfa (Trimeto-sulfa)', use: 'Bacterial infections, coccidiosis', meat: 10, eggs: null, days: 5 },
  { name: 'Amprolium', use: 'Coccidiosis prevention & treatment', meat: 1, eggs: 0, days: 5 },
  { name: 'Toltrazuril (Baycox)', use: 'Coccidiosis', meat: 18, eggs: null, days: 2 },
  { name: 'Diclazuril', use: 'Coccidiosis', meat: 5, eggs: null, days: 3 },
  { name: 'Piperazine', use: 'Roundworms', meat: 7, eggs: 7, days: 1 },
  { name: 'Levamisole', use: 'Worms', meat: 7, eggs: null, days: 1 },
  { name: 'Albendazole', use: 'Worms', meat: 7, eggs: 7, days: 1 },
  { name: 'Fenbendazole', use: 'Worms', meat: 7, eggs: 0, days: 3 },
  { name: 'Ivermectin', use: 'Mites, lice, worms', meat: 14, eggs: null, days: 1 },
  { name: 'Furazolidone', use: '— banned for food animals in many countries; avoid', meat: 30, eggs: null, days: 0 },
  { name: 'Vitamins & electrolytes', use: 'Stress, heat, after vaccination', meat: 0, eggs: 0, days: 3 },
  { name: 'Glucose', use: 'Arrival, stress', meat: 0, eggs: 0, days: 1 },
];

export const drugByName = (name) => {
  const n = String(name || '').toLowerCase();
  return DRUGS.find((d) => n.includes(d.name.toLowerCase().split(/[ (/+]/)[0]));
};

/** Withdrawal days to use for a flock: eggs for laying flocks, meat otherwise (longest when not allowed). */
export function withdrawalFor(drug, laying) {
  if (!drug) return null;
  if (laying) return drug.eggs == null ? Math.max(drug.meat, 30) : Math.max(drug.eggs, 0);
  return drug.meat;
}
