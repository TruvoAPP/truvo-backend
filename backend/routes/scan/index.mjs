import express from 'express';
import { scoreDiet } from '../../services/scan/scoreDiet.mjs';
import { scoreMacros } from '../../services/scan/scoreMacros.mjs';
import { scoreProcessing } from '../../services/scan/scoreProcessing.mjs';
import { supabase } from '../../supabase/client.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
  const { barcode } = req.query;

  if (!barcode) return res.json({ error: 'Missing barcode' });

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .single();

  if (!data) return res.json({ found: false });

  const processing = scoreProcessing(data);
  const diet = scoreDiet(data);
  const macros = scoreMacros(data); // now informational only

  // final score is diet score ONLY
  const finalScore = diet.score;

  return res.json({
    found: true,
    product: data,
    processing,
    diet,
    macroProfile: macros, // 👈 renamed for clarity
    score: finalScore
  });
});

export default router;
