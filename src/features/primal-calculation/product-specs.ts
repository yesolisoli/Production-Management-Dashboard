import type { PrimalCategory, ProductSpec } from "./types";

// =====================================================================
// PRODUCT_SPECS — single source of truth for every primal product.
//
// This is a mock/config data layer. When the backend product catalog is
// ready, replace the contents of this file (or hydrate it from an API)
// without touching any UI or calculation code — everything downstream
// reads ProductSpec only.
//
// Counts per category intentionally match the production reference:
//   Butts 7 · Legs 13 · Loins 19 · Spareribs 3 · Ribbons/Ribs 13 · Picnic 4
// =====================================================================

export const PRODUCT_SPECS: ProductSpec[] = [
  // ---------------------------- Butts (7) ----------------------------
  { sku: "10005", name: "PORK BUTTS", category: "Butts", casePack: "6 (20-22 KG)", piecesPerCase: 6 },
  { sku: "10020", name: "PORK BUTTS - BONELESS", category: "Butts", casePack: "6 (20-22 KG)", piecesPerCase: 6 },
  { sku: "10023", name: "PORK BUTTS - BONELESS - VP", category: "Butts", casePack: "6 (20-22 KG)", piecesPerCase: 6 },
  { sku: "10010", name: "PORK BUTTS - RIND ON", category: "Butts", casePack: "6 (22-24 KG)", piecesPerCase: 6 },
  { sku: "10013", name: "PORK BUTTS - RIND ON - BONELESS", category: "Butts", casePack: "6 (22-24 KG)", piecesPerCase: 6 },
  { sku: "10021", name: "PORK BUTTS - BONELESS - TOTE", category: "Butts", casePack: "240 (TOTE)", piecesPerCase: 240 },
  { sku: "10025", name: "PORK EYE OF BUTTS", category: "Butts", casePack: "8 (12-14 KG)", piecesPerCase: 8 },

  // ---------------------------- Legs (13) ----------------------------
  { sku: "11005", name: "PORK LEG - BONE IN", category: "Legs", casePack: "4 (24-26 KG)", piecesPerCase: 4 },
  { sku: "11006", name: "PORK LEG - BONE IN - RIND ON", category: "Legs", casePack: "4 (24-26 KG)", piecesPerCase: 4 },
  { sku: "11010", name: "PORK LEG - BONELESS", category: "Legs", casePack: "4 (22-24 KG)", piecesPerCase: 4 },
  { sku: "11011", name: "PORK LEG - BONELESS - VP", category: "Legs", casePack: "4 (22-24 KG)", piecesPerCase: 4 },
  { sku: "11015", name: "PORK LEG - INSIDE", category: "Legs", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "11016", name: "PORK LEG - INSIDE - VP", category: "Legs", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "11020", name: "PORK LEG - OUTSIDE", category: "Legs", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "11021", name: "PORK LEG - OUTSIDE - VP", category: "Legs", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "11025", name: "PORK LEG - KNUCKLE", category: "Legs", casePack: "8 (4-6 KG)", piecesPerCase: 8 },
  { sku: "11026", name: "PORK LEG - KNUCKLE - VP", category: "Legs", casePack: "8 (4-6 KG)", piecesPerCase: 8 },
  { sku: "11030", name: "PORK LEG - SHANK", category: "Legs", casePack: "10 (3-4 KG)", piecesPerCase: 10 },
  { sku: "11035", name: "PORK LEG - RUMP", category: "Legs", casePack: "8 (5-7 KG)", piecesPerCase: 8 },
  { sku: "11040", name: "PORK LEG - TOTE", category: "Legs", casePack: "240 (TOTE)", piecesPerCase: 240 },

  // ---------------------------- Loins (19) ---------------------------
  { sku: "12005", name: "PORK LOIN - BONE IN", category: "Loins", casePack: "4 (20-22 KG)", piecesPerCase: 4 },
  { sku: "12006", name: "PORK LOIN - BONE IN - RIND ON", category: "Loins", casePack: "4 (20-22 KG)", piecesPerCase: 4 },
  { sku: "12010", name: "PORK LOIN - BONELESS", category: "Loins", casePack: "4 (8-10 KG)", piecesPerCase: 4 },
  { sku: "12011", name: "PORK LOIN - BONELESS - VP", category: "Loins", casePack: "4 (8-10 KG)", piecesPerCase: 4 },
  { sku: "12012", name: "PORK LOIN - BONELESS - C/C", category: "Loins", casePack: "4 (8-10 KG)", piecesPerCase: 4 },
  { sku: "12015", name: "PORK LOIN - CENTER CUT", category: "Loins", casePack: "6 (6-8 KG)", piecesPerCase: 6 },
  { sku: "12016", name: "PORK LOIN - CENTER CUT - VP", category: "Loins", casePack: "6 (6-8 KG)", piecesPerCase: 6 },
  { sku: "12020", name: "PORK TENDERLOIN", category: "Loins", casePack: "12 (4-6 KG)", piecesPerCase: 12 },
  { sku: "12021", name: "PORK TENDERLOIN - VP", category: "Loins", casePack: "12 (4-6 KG)", piecesPerCase: 12 },
  { sku: "12025", name: "PORK BACK RIBS", category: "Loins", casePack: "10 (2-3 KG)", piecesPerCase: 10 },
  { sku: "12026", name: "PORK BACK RIBS - VP", category: "Loins", casePack: "10 (2-3 KG)", piecesPerCase: 10 },
  { sku: "12030", name: "PORK BABY BACK RIBS", category: "Loins", casePack: "12 (1-2 KG)", piecesPerCase: 12 },
  { sku: "12035", name: "PORK COLLAR - BONELESS", category: "Loins", casePack: "6 (6-8 KG)", piecesPerCase: 6 },
  { sku: "12036", name: "PORK COLLAR - VP", category: "Loins", casePack: "6 (6-8 KG)", piecesPerCase: 6 },
  { sku: "12040", name: "PORK LOIN - SADDLE", category: "Loins", casePack: "2 (28-30 KG)", piecesPerCase: 2 },
  { sku: "12045", name: "PORK LOIN - STRAP OFF", category: "Loins", casePack: "4 (8-10 KG)", piecesPerCase: 4 },
  { sku: "12050", name: "PORK CHOP - BONE IN", category: "Loins", casePack: "12 (5-6 KG)", piecesPerCase: 12 },
  { sku: "12051", name: "PORK CHOP - BONELESS", category: "Loins", casePack: "12 (4-5 KG)", piecesPerCase: 12 },
  { sku: "12055", name: "PORK LOIN - TOTE", category: "Loins", casePack: "240 (TOTE)", piecesPerCase: 240 },

  // -------------------------- Spareribs (3) --------------------------
  { sku: "13005", name: "PORK SPARERIBS", category: "Spareribs", casePack: "10 (3-4 KG)", piecesPerCase: 10 },
  { sku: "13006", name: "PORK SPARERIBS - VP", category: "Spareribs", casePack: "10 (3-4 KG)", piecesPerCase: 10 },
  { sku: "13010", name: "PORK SPARERIBS - ST LOUIS", category: "Spareribs", casePack: "10 (2-3 KG)", piecesPerCase: 10 },

  // ------------------------ Ribbons/Ribs (13) ------------------------
  { sku: "14005", name: "PORK RIBLETS", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14006", name: "PORK RIBLETS - VP", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14010", name: "PORK RIB TIPS", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14011", name: "PORK RIB TIPS - VP", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14015", name: "PORK BRISKET BONE", category: "Ribbons/Ribs", casePack: "10 (3-4 KG)", piecesPerCase: 10 },
  { sku: "14020", name: "PORK RIBBONS", category: "Ribbons/Ribs", casePack: "10 (2-3 KG)", piecesPerCase: 10 },
  { sku: "14021", name: "PORK RIBBONS - VP", category: "Ribbons/Ribs", casePack: "10 (2-3 KG)", piecesPerCase: 10 },
  { sku: "14025", name: "PORK FLANK", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14026", name: "PORK FLANK - VP", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },
  { sku: "14030", name: "PORK SKIRT", category: "Ribbons/Ribs", casePack: "12 (1-2 KG)", piecesPerCase: 12 },
  { sku: "14035", name: "PORK NECK BONE", category: "Ribbons/Ribs", casePack: "10 (4-5 KG)", piecesPerCase: 10 },
  { sku: "14036", name: "PORK NECK BONE - VP", category: "Ribbons/Ribs", casePack: "10 (4-5 KG)", piecesPerCase: 10 },
  { sku: "14040", name: "PORK SOFT BONE", category: "Ribbons/Ribs", casePack: "12 (2-3 KG)", piecesPerCase: 12 },

  // --------------------------- Picnic (4) ----------------------------
  { sku: "15005", name: "PORK PICNIC - BONE IN", category: "Picnic", casePack: "4 (14-16 KG)", piecesPerCase: 4 },
  { sku: "15010", name: "PORK PICNIC - BONELESS", category: "Picnic", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "15011", name: "PORK PICNIC - BONELESS - VP", category: "Picnic", casePack: "6 (8-10 KG)", piecesPerCase: 6 },
  { sku: "15015", name: "PORK PICNIC - RIND ON", category: "Picnic", casePack: "4 (14-16 KG)", piecesPerCase: 4 },
];

// Lookup by SKU. Built once at module load.
export const PRODUCT_SPEC_BY_SKU: Record<string, ProductSpec> =
  Object.fromEntries(PRODUCT_SPECS.map((spec) => [spec.sku, spec]));

// Products for a category, in definition order.
export function specsForCategory(category: PrimalCategory): ProductSpec[] {
  return PRODUCT_SPECS.filter((spec) => spec.category === category);
}
