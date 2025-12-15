import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load diet rules JSON safely (Node 22 compatible)
const dietRulesPath = path.join(__dirname, '../../rules/dietRules.json');
const dietRules = JSON.parse(fs.readFileSync(dietRulesPath, 'utf-8'));

export const scoreDiet = (product) => {
  if (!product?.ingredients) {
    return {
      score: 0,
      reason: 'no-ingredients',
      _loaded: true
    };
  }

  const ingredients = product.ingredients.toLowerCase();

  // prohibited
  const hasProhibited = dietRules.prohibited.some(i =>
    ingredients.includes(i.toLowerCase())
  );

  if (hasProhibited) {
    return {
      score: 0,
      reason: 'prohibited',
      _loaded: true
    };
  }

  // discouraged
  const hasDiscouraged = dietRules.discouraged.some(i =>
    ingredients.includes(i.toLowerCase())
  );

  if (hasDiscouraged) {
    return {
      score: 50,
      reason: 'discouraged',
      _loaded: true
    };
  }

  return {
    score: 100,
    reason: 'allowed',
    _loaded: true
  };
};
