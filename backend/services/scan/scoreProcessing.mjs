import processingRules from '../../rules/processingRules.json' with { type: 'json' };
import { classifyIngredients } from '../../utils/classifyIngredients.mjs';

export const scoreProcessing = (product) => {
  const classified = classifyIngredients(product.ingredients);

  const ingredientsText = product.ingredients.toLowerCase();
  const nameText = product.name.toLowerCase();

  // 1️⃣ Deep-fry rule
  const isDeepFried = processingRules.deepFryKeywords?.some(word =>
    ingredientsText.includes(word)
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
    nameText.includes(word)
  );

  if (isIdentityL2) {
    return {
      level: 'L2',
      reason: 'identity_rule',
      classified,
      ratio: 0
    };
  }

  // 3️⃣ industrial checks
  const industrialCount = classified.filter(i => i.industrial).length;
  const total = classified.length;
  const ratio = total ? industrialCount / total : 0;

  const hasAlways = industrialCount > 0;

  // ⭐ NEW: first ingredient rule
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

  // Existing dominance logic
  if (hasAlways || ratio >= processingRules.thresholdDominant) {
    return {
      level: 'L4',
      reason: 'dominant_industrial',
      classified,
      ratio
    };
  }

  if (ratio > 0) {
    return {
      level: 'L3',
      reason: 'minor_industrial',
      classified,
      ratio
    };
  }

  // default real food
  return {
    level: 'L2',
    reason: 'natural_processing',
    classified,
    ratio: 0
  };
};
