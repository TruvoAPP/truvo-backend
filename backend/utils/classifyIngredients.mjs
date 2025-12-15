import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ingredient rules JSON (Node 22 compatible)
const ingredientRulesPath = path.join(
  __dirname,
  '../rules/ingredientRules.json'
);

const ingredientRules = JSON.parse(
  fs.readFileSync(ingredientRulesPath, 'utf-8')
);

export const classifyIngredients = (ingredientsText = '') => {
  const ingredients = ingredientsText
    .toLowerCase()
    .split(',')
    .map(i => i.trim())
    .filter(Boolean);

  return ingredients.map(name => {
    const rule = ingredientRules.find(r =>
      name.includes(r.keyword.toLowerCase())
    );

    return {
      name,
      industrial: rule ? rule.industrial === true : false,
      category: rule?.category ?? 'unknown'
    };
  });
};
