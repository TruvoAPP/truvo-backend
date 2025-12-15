import dietRules from '../../rules/dietRules.json' assert { type: 'json' };

export const scoreDiet = (product) => {
  const ingredients = product.ingredients.toLowerCase();

  // prohibited
  const hasProhibited = dietRules.prohibited.some(i =>
    ingredients.includes(i)
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
    ingredients.includes(i)
  );
  if (hasDiscouraged) {
    return {
      score: 50,
      reason: 'discouraged',
      _loaded: true
    };
  }

  // only allowed
  return {
    score: 100,
    reason: 'allowed',
    _loaded: true
  };
};
