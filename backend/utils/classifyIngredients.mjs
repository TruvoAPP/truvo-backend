import ingredientRules from '../rules/ingredientRules.json' assert { type: 'json' };

export const classifyIngredients = (ingredientsText) => {
  if (!ingredientsText) return [];

  const list = ingredientsText
    .toLowerCase()
    .split(',')
    .map(i => i.trim());

  return list.map(i => {
    const isAlways = ingredientRules.alwaysIndustrial.some(rule =>
      i.includes(rule)
    );

    return {
      name: i,
      industrial: isAlways
    };
  });
};
