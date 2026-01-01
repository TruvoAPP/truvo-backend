import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyIngredients } from '../../utils/classifyIngredients.mjs';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load processing rules
const processingRulesPath = path.join(__dirname, '../../rules/processingRules.json');
const processingRules = JSON.parse(fs.readFileSync(processingRulesPath, 'utf-8'));

/* -------------------------------------------------
   Industrial Seed Oil Detection (Calorie Weighted)
------------------------------------------------- */

const INDUSTRIAL_SEED_OILS = [
  'sunflower oil',
  'soybean oil',
  'soy oil',
  'canola oil',
  'rapeseed oil',
  'corn oil',
  'maize oil',
  'cottonseed oil',
  'safflower oil',
  'grapeseed oil',
  'rice bran oil',
  'vegetable oil',
];

// 🔥 FIXED OFF INGREDIENT EXTRACTION
function extractBestIngredientsText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const matches = [...raw.matchAll(/'text'\s*:\s*'([^']+)'/g)];
  if (matches.length === 0) return raw.toLowerCase();

  const texts = matches.map(m => m[1].toLowerCase());
  const en = texts.find(t => t.match(/potatoes|sunflower|salt|oil/));
  return (en || texts.join(', ')).toLowerCase();
}

function parseDeclaredPercentages(text) {
  const matches = [...text.matchAll(/([a-z0-9\s\-]+)\s(\d+(?:\.\d+)?)\s?%/g)];
  return matches.map(m => ({
    name: m[1].trim(),
    pct: Number(m[2])
  })).filter(x => x.pct >= 0 && x.pct <= 100);
}

function estimateIndustrialFatCalorieRatio(text) {
  if (!INDUSTRIAL_SEED_OILS.some(o => text.includes(o))) return 0;

  const declared = parseDeclaredPercentages(text);
  const declaredTotal = declared.reduce((s, x) => s + x.pct, 0);
  const remainder = Math.max(0, 100 - declaredTotal);

  let seedOilPct = null;
  for (const d of declared) {
    if (INDUSTRIAL_SEED_OILS.some(o => d.name.includes(o))) {
      seedOilPct = d.pct;
      break;
    }
  }

  if (seedOilPct === null) seedOilPct = remainder;
  if (!seedOilPct || seedOilPct <= 0) return 0;

  const oilCalories = seedOilPct * 9;
  const otherCalories = (100 - seedOilPct) * 4;
  return oilCalories / (oilCalories + otherCalories);
}

/* -------------------------------------------------
   MAIN SCORING ENGINE
------------------------------------------------- */

export const scoreProcessing = (product) => {
  try {
    if (!product?.ingredients) {
      return { level: null, confidence: 'LOW', reason: 'missing_ingredients', classified: [], ratio: 0 };
    }

    const ingredientsText = extractBestIngredientsText(product.ingredients);
    const nameText = (product.name || '').toLowerCase();

    // 🧨 SEED OIL DOMINANCE (Runs first)
    const fatRatio = estimateIndustrialFatCalorieRatio(ingredientsText);

    if (fatRatio >= 0.10) {
      return { level: 'L4', confidence: 'HIGH', reason: 'industrial_seed_oil_calorie_dominance', classified: [], ratio: 1, fatRatio };
    }

    if (fatRatio >= 0.02) {
      return { level: 'L3', confidence: 'MEDIUM', reason: 'industrial_seed_oil_present', classified: [], ratio: 0.5, fatRatio };
    }

    let classified = [];
    try {
      classified = classifyIngredients(ingredientsText) || [];
    } catch {}

    const isDeepFried = processingRules.deepFryKeywords?.some(w => ingredientsText.includes(w));
    if (isDeepFried) {
      return { level: 'L4', confidence: 'HIGH', reason: 'deep_fry_rule', classified, ratio: 1 };
    }

    const isIdentityL2 = processingRules.identityL2?.some(w => nameText.includes(w));
    if (isIdentityL2) {
      return { level: 'L2', confidence: 'MEDIUM', reason: 'identity_rule', classified, ratio: 0 };
    }

    const industrialCount = classified.filter(i => i?.industrial).length;
    const total = classified.length;
    const ratio = total ? industrialCount / total : 0;

    if (classified[0]?.industrial) {
      return { level: 'L4', confidence: 'HIGH', reason: 'first_ingredient_industrial', classified, ratio };
    }

    if (industrialCount > 0 || ratio >= processingRules.thresholdDominant) {
      return { level: 'L4', confidence: 'MEDIUM', reason: 'dominant_industrial', classified, ratio };
    }

    if (ratio > 0) {
      return { level: 'L3', confidence: 'MEDIUM', reason: 'minor_industrial', classified, ratio };
    }

    return { level: 'L2', confidence: 'HIGH', reason: 'natural_processing', classified, ratio: 0 };

  } catch (err) {
    console.error('💥 Processing crash:', err);
    return { level: null, confidence: 'LOW', reason: 'processing_error', classified: [], ratio: 0 };
  }
};
