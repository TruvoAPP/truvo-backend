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

export const scoreProcessing = (product) => {
  try {
    // 🛡 HARD GUARD — OFF data is often incomplete
    if (!product?.ingredients || typeof product.ingredients !== 'string') {
      return {
        level: null,
        confidence: 'LOW',
        reason: 'missing_ingredients',
        classified: [],
        ratio: 0
      };
    }

    const ingredientsText = product.ingredients.toLowerCase();
    const nameText = (product.name || '').toLowerCase();

    let classified = [];

    try {
      classified = classifyIngredients(product.ingredients);
      if (!Array.isArray(classified)) classified = [];
    } catch (e) {
      console.warn('⚠️ classifyIngredients failed:', e.message);
      classified = [];
    }

    // 1️⃣ Deep-fry rule
    const isDeepFried = processingRules.deepFryKeywords?.some(word =>
      ingredientsText.includes(word.toLowerCase())
    );

    if (isDeepFried) {
      return {
        level: 'L4',
        confidence: 'HIGH',
        reason: 'deep_fry_rule',
        classified,
        ratio: 1
      };
    }

    // 2️⃣ Identity rule
    const isIdentityL2 = processingRules.identityL2?.some(word =>
      nameText.includes(word.toLowerCase())
    );

    if (isIdentityL2) {
      return {
        level: 'L2',
        confidence: 'MEDIUM',
        reason: 'identity_rule',
        classified,
        ratio: 0
      };
    }

    // 3️⃣ Industrial dominance logic
    const industrialCount = classified.filter(i => i?.industrial === true).length;
    const total = classified.length;
    const ratio = total ? industrialCount / total : 0;

    const firstIsIndustrial = classified[0]?.industrial === true;

    if (firstIsIndustrial) {
      return {
        level: 'L4',
        confidence: 'HIGH',
        reason: 'first_ingredient_industrial',
        classified,
        ratio
      };
    }

    if (industrialCount > 0 || ratio >= processingRules.thresholdDominant) {
      return {
        level: 'L4',
        confidence: 'MEDIUM',
        reason: 'dominant_industrial',
        classified,
        ratio
      };
    }

    if (ratio > 0) {
      return {
        level: 'L3',
        confidence: 'MEDIUM',
        reason: 'minor_industrial',
        classified,
        ratio
      };
    }

    return {
      level: 'L2',
      confidence: 'HIGH',
      reason: 'natural_processing',
      classified,
      ratio: 0
    };

  } catch (err) {
    console.error('💥 scoreProcessing hard crash — returning safe fallback:', err);

    return {
      level: null,
      confidence: 'LOW',
      reason: 'processing_error',
      classified: [],
      ratio: 0
    };
  }
};