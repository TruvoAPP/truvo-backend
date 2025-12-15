import express from 'express';
import { scoreDiet } from '../../services/scan/scoreDiet.mjs';
import { scoreMacros } from '../../services/scan/scoreMacros.mjs';
import { scoreProcessing } from '../../services/scan/scoreProcessing.mjs';
import { supabase } from '../../supabase/client.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { barcode } = req.query;

    if (!barcode) {
      return res.status(400).json({ error: 'Missing barcode' });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle(); // ✅ IMPORTANT: prevents server crash

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'database_error' });
    }

    if (!data) {
      return res.json({ found: false });
    }

    // ✅ make sure downstream scorers never crash
    const safeProduct = {
      ...data,
      ingredients: data.ingredients || '',
      name: data.name || ''
    };

    const processing = scoreProcessing(safeProduct);
    const diet = scoreDiet(safeProduct);
    const macros = scoreMacros(safeProduct); // informational only

    return res.json({
      found: true,
      product: data,
      processing,
      diet,
      macroProfile: macros,
      score: diet.score // final score = diet score
    });

  } catch (err) {
    // 🔴 this prevents Render from exiting with status 1
    console.error('SCAN ROUTE CRASH:', err);
    return res.status(500).json({
      error: 'scan_failed',
      message: err.message
    });
  }
});

export default router;
