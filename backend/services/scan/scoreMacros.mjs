export const scoreMacros = (product) => {
  const n = product?.nutrition ?? {};

  const protein = Number(n.protein) || 0;
  const sugar = Number(n.sugar) || 0;
  const carbs = Number(n.carbs) || 0;

  let score = 0;

  // protein bonus
  if (protein >= 15) score += 20;
  else if (protein >= 10) score += 10;

  // sugar penalty
  if (sugar > 10) score -= 30;
  else if (sugar > 5) score -= 10;

  // carbs penalty
  if (carbs > 25) score -= 20;
  else if (carbs > 10) score -= 5;

  // clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    details: {
      protein,
      sugar,
      carbs
    },
    _loaded: true
  };
};
