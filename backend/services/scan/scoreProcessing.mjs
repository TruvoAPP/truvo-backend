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
   Seed oil calorie dominance (NEW)
   - We treat refined seed oils as industrial inputs
   - Use caloric weighting (fat=9 kcal/g, non-fat≈4 kcal/g)
   - If industrial fat ≥10% of estimated calories → L4
   - If industrial fat ≥2% of estimated calories → L3
------------------------------------------------- */

// Keep this list small + obvious for v1. Expand later.
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

function parseDeclaredPercentages(text) {
  // Matches "potatoes 69%" or "sea salt 1.3%"
  // Returns [{ name, pct }]
  const matches = [...text.matchAll(/([a-z0-9\s\-]+)\s(\d+(?:\.\d+)?)\s?%/g)];
  return matches.map((m) => ({
    name: (m[1] || '').trim(),
    pct: Number(m[2]),
  })).filter(x => Number.isFinite(x.pct) && x.pct >= 0 && x.pct <= 100);
}

function containsSeedOil(text) {
  return INDUSTRIAL_SEED_OILS.some((k) => text.includes(k));
}

function findDeclaredSeedOilPct(declared) {
  for (const d of declared) {
    if (INDUSTRIAL_SEED_OILS.some((k) => d.name.includes(k))) {
      return d.pct;
    }
  }
  return null;
}

function estimateIndustrialFatCalorieRatio(ingredientsTextRaw) {
  const text = String(ingredientsTextRaw || '').toLowerCase();

  // If no seed oil keyword at all → ratio 0
  if (!containsSeedOil(text)) return 0;

  const declared = parseDeclaredPercentages(text);
  const declaredTotal = declared.reduce((sum, x) => sum + x.pct, 0);
  const remainder = Math.max(0, 100 - declaredTotal);

  // If seed oil appears with a declared %, use it.
  // Otherwise, assume seed oil is the "remainder" (common in chips: potatoes X%, salt Y%, oil remainder).
  let seedOilPct = findDeclaredSeedOilPct(declared);
  if (seedOilPct === null) seedOilPct = remainder;

  // Guard: if we still can't estimate meaningfully, return 0 (fall through)
  if (!Number.isFinite(seedOilPct) || seedOilPct <= 0) return 0;

  // Calorie estimate (very effective for snacks):
  // - Seed oil: fat → 9 kcal/g
  // - Everything else: assume ~4 kcal/g average
  const oilCalories = seedOilPct * 9;
  const otherCalories = (100 - seedOilPct) * 4;
  const totalCalories = oilCalories + otherCalories;

  if (totalCalories <= 0) return 0;

  return oilCalories / totalCalories; // fraction 0..1
}

export const scoreProcessing = (product) => {
  try {
    // 🛡 HARD GUARD — OFF data is often incomplete
    if (!product?.ingredients || typeof product.ingredients !== 'string') {
      return {
        level: null,
        confidence: 'LOW',
        reason: 'missing_ingredients',
        classified: [],
        ratio: 0,
      };
    }

    const ingredientsText = product.ingredients.toLowerCase();
    const nameText = (product.name || '').toLowerCase();

    /* -------------------------------------------------
       NEW RULE: Seed oil calorie dominance
       - If industrial seed oil calories dominate, it is L4
       - If meaningful presence, it is at least L3
       NOTE: this runs before other rules by design.
    ------------------------------------------------- */
    const industrialFatCalorieRatio = estimateIndustrialFatCalorieRatio(ingredientsText);

    if (industrialFatCalorieRatio >= 0.10) {
      return {
        level: 'L4',
        confidence: 'HIGH',
        reason: 'industrial_seed_oil_calorie_dominance',
        classified: [],
        ratio: 1,
        industrialFatCalorieRatio,
      };
    }

    if (industrialFatCalorieRatio >= 0.02) {
      // Don’t force L4; but ensure it can’t be L1/L2.
      // We keep confidence MEDIUM because % parsing can be incomplete.
      // If it’s declared explicitly, it will often still compute confidently.
      return {
        level: 'L3',
        confidence: 'MEDIUM',
        reason: 'industrial_seed_oil_present',
        classified: [],
        ratio: 0.5,
        industrialFatCalorieRatio,
      };
    }

    let classified = [];

    try {
      classified = classifyIngredients(product.ingredients);
      if (!Array.isArray(classified)) classified = [];
    } catch (e) {
      console.warn('⚠️ classifyIngredients failed:', e.message);
      classified = [];
    }

    // 1️⃣ Deep-fry rule
    const isDeepFried = processingRules.deepFryKeywords?.some((word) =>
      ingredientsText.includes(word.toLowerCase())
    );

    if (isDeepFried) {
      return {
        level: 'L4',
        confidence: 'HIGH',
        reason: 'deep_fry_rule',
        classified,
        ratio: 1,
      };
    }

    // 2️⃣ Identity rule
    const isIdentityL2 = processingRules.identityL2?.some((word) =>
      nameText.includes(word.toLowerCase())
    );

    if (isIdentityL2) {
      return {
        level: 'L2',
        confidence: 'MEDIUM',
        reason: 'identity_rule',
        classified,
        ratio: 0,
      };
    }

    // 3️⃣ Industrial dominance logic
    const industrialCount = classified.filter((i) => i?.industrial === true).length;
    const total = classified.length;
    const ratio = total ? industrialCount / total : 0;

    const firstIsIndustrial = classified[0]?.industrial === true;

    if (firstIsIndustrial) {
      return {
        level: 'L4',
        confidence: 'HIGH',
        reason: 'first_ingredient_industrial',
        classified,
        ratio,
      };
    }

    if (industrialCount > 0 || ratio >= processingRules.thresholdDominant) {
      return {
        level: 'L4',
        confidence: 'MEDIUM',
        reason: 'dominant_industrial',
        classified,
        ratio,
      };
    }

    if (ratio > 0) {
      return {
        level: 'L3',
        confidence: 'MEDIUM',
        reason: 'minor_industrial',
        classified,
        ratio,
      };
    }

    return {
      level: 'L2',
      confidence: 'HIGH',
      reason: 'natural_processing',
      classified,
      ratio: 0,
    };
  } catch (err) {
    console.error('💥 scoreProcessing hard crash — returning safe fallback:', err);

    return {
      level: null,
      confidence: 'LOW',
      reason: 'processing_error',
      classified: [],
      ratio: 0,
    };
  }
};
