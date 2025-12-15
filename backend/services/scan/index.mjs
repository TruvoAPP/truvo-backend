import { scoreDiet } from './scoreDiet.mjs';
import { scoreMacros } from './scoreMacros.mjs';
import { scoreProcessing } from './scoreProcessing.mjs';

export const scoreProduct = (product) => {
  const processing = scoreProcessing(product);

  return {
    processing,
    diet: scoreDiet(product),
    macros: scoreMacros(product)
  };
};
