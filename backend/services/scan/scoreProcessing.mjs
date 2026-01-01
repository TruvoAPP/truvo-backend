import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { classifyIngredients } from '../../utils/classifyIngredients.mjs';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load processing rules
const processingRulesPath = path.join(
  __dirname,
  '../../rules/processingRules.json'
);

const processingRules = JSON.parse(
  fs.readFileSync(processingRulesPath, 'utf-8')
);

/* -------------------------------------------------
   Seed oil calorie dominance
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

// Extract clean ingredient text from OFF junk format
function extractBestIngredientsText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  if (!raw.startsWith('[{')) return raw;

  try {
    const json = raw
      .replace(/'/g, '"')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

    const arr = JSON.parse(json);
    const en = arr.find(x => x.lang === 'en');
    return (en?.text || arr[0]?.text || '').toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function parseDeclaredPercentages(text) {
  const matches = [...text.matchAll(/([a-z0-9\s\-]+)\s(\d+(?:\.\d+)?)\s?%/g)];
  return matches.map(m => ({
    name: m[1].trim(),
    pct: Number(m[2]),
  })).filter(x => x.pct >= 0 && x.pct <= 100);
}

function estimateIndustrialFatCalorieRatio(ingredientsText) {
  const text = ingredientsText.toLowerCase();

  if (!INDUSTRIAL_SEED_OILS.some(k => text.includes(k))) return 0;

  const declared = parseDeclaredPercentages(text);
  const declaredTotal = declared.reduce((a, b) => a + b.pct, 0);
  const remainder = Math.max(0, 100 - declaredTotal);

  let seedOilPct = declared.find(d =>
    INDUSTRIAL_SEED_OILS.some(k => d.name.includes(k))
  )?.pct;

  if (seedOilPct == null) seedOilPct = remainder;
  if (!seedOilPct || seedOilPct <= 0) return 0;

  const oilCalories = seedOilPct * 9;
  const otherCalories = (100 - seedOilPct) * 4;
  const totalCalories = oilCalories + otherCalories;

  return oilCalories / totalCalories;
}

/* -------------------------------------------------
   MAIN SCORING
------------------------------------------------- */

export const scoreProcessing = (product) => {
  try {
    if (!product?.ingredients || typeof product.ingredients !== 'string') {
      return { level: null, confidence: 'LOW', reason: 'missing_ingredients', classified: [], ratio: 0 };
    }

    const ingredientsText = extractBestIngredientsText(product.ingredients);
    const nameText = (product.name || '').toLowerCase();

    // 🔥 Seed-oil calorie override
    const industrialFatCalorieRatio = estimateIndustrialFatCalorieRatio(ingredientsText);

    if (industrialFatCalorieRatio >= 0.10) {
      return { level: 'L4', confidence: 'HIGH', reason: 'industrial_seed_oil_calorie_dominance', classified: [], ratio: 1 };
    }

    if (industrialFatCalorieRatio >= 0.02) {
      return { level: 'L3', confidence: 'MEDIUM', reason: 'industrial_seed_oil_present', classified: [], ratio: 0.5 };
    }

    let classified = [];
    try {
      classified = classifyIngredients(ingredientsText);
      if (!Array.isArray(classified)) classified = [];
    } catch {}

    const isDeepFried = processingRules.deepFryKeywords?.some(word =>
      ingredientsText.includes(word.toLowerCase())
    );

    if (isDeepFried) {
      return { level: 'L4', confidence: 'HIGH', reason: 'deep_fry_rule', classified, ratio: 1 };
    }

    const isIdentityL2 = processingRules.identityL2?.some(word =>
      nameText.includes(word.toLowerCase())
    );

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
    console.error('💥 scoreProcessing crash:', err);
    return { level: null, confidence: 'LOW', reason: 'processing_error', classified: [], ratio: 0 };
  }
};
