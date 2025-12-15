export function scoreFood(ingredients) {
    let points = 100;
  
    ingredients.forEach(item => {
      if (item.includes('sugar')) points -= 15;
      if (item.includes('corn syrup')) points -= 20;
      if (item.includes('preservative')) points -= 10;
      if (item.includes('artificial')) points -= 15;
    });
  
    points = Math.max(0, Math.min(100, points));
  
    let level;
    if (points >= 75) level = 1;
    else if (points >= 50) level = 2;
    else if (points >= 25) level = 3;
    else level = 4;
  
    return { points, level };
  }
  