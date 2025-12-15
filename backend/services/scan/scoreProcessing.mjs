import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { classifyIngredients } from '../../utils/classifyIngredients.mjs';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load processing rules JSON (Node 22 compatible)
const processingRulesPath = path.join(
  __dirname,
  '../../rules/processingRules.json'
);

const processingRules = JSON.parse(
  fs.readFileSync(processingRulesPath, 'utf-8')
);

export const scoreProcessing = (product) => {
  if (!product?.ingredients || !product?.name) {
    return {
      level: 'L4',
      reason: 'missing_data',
      classified: [],
      ratio: 1
    };
  }

  const ingredientsText = product.ingredients.toLowerCase();
  const nameText = product.name.toLowerCase();

  const classified = classifyIngredients(product.ingredients);

  // 1️⃣ Deep-fry rule
  const isDeepFried = processingRules.deepFryKeywords?.some(word =>
    ingredientsText.includes(word.toLowerCase())
  );

  if (isDeepFried) {
    return {
      level: 'L4',
      reason: 'deep_fry_rule',
      classified,
      ratio: 1
    };
  }

  // 2️⃣ Identity rule (L2 traditional)
  const isIdentityL2 = processingRules.identityL2?.some(word =>
    nameText.includes(word.toLowerCase())
  );

  if (isIdentityL2) {
    return {
      level: 'L2',
      reason: 'identity_rule',
      classified,
      ratio: 0
    };
  }

  // 3️⃣ Industrial dominance logic
  const industrialCount = classified.filter(i => i.industrial).length;
  const total = classified.length;
  const ratio = total ? industrialCount / total : 0;

  // ⭐ First ingredient industrial rule
  const first = classified[0];
  const firstIsIndustrial = first?.industrial === true;

  if (firstIsIndustrial) {
    return {
      level: 'L4',
      reason: 'first_ingredient_industrial',
      classified,
      ratio
    };
  }

  // Dominant industrial
  if (
    industrialCount > 0 ||
    ratio >= processingRules.thresholdDominant
  ) {
    return {
      level: 'L4',
      reason: 'dominant_industrial',
      classified,
      ratio
    };
  }

  // Minor industrial presence
  if (ratio > 0) {
    return {
      level: 'L3',
      reason: 'minor_industrial',
      classified,
      ratio
    };
  }

  // Default: minimally processed
  return {
    level: 'L2',
    reason: 'natural_processing',
    classified,
    ratio: 0
  };
};
