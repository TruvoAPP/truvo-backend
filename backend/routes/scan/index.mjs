import express from 'express';
import { scoreDiet } from '../../services/scan/scoreDiet.mjs';
import { scoreMacros } from '../../services/scan/scoreMacros.mjs';
import { scoreProcessing } from '../../services/scan/scoreProcessing.mjs';
import { supabase } from '../../supabase/client.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Date.now();

  try {
    const { barcode } = req.query;

    console.log('🔍 Scan request:', barcode);

    if (!barcode) {
      return res.status(400).json({ error: 'Missing barcode' });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle(); // safe: no throw

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ error: 'database_error' });
    }

    if (!data) {
      const duration = Date.now() - start;
      console.log(`⚠️ Barcode not found: ${barcode} (${duration}ms)`);
      return res.json({
        found: false,
        _meta: { durationMs: duration }
      });
    }

    // ensure scorers never crash
    const safeProduct = {
      ...data,
      ingredients: data.ingredients || '',
      name: data.name || ''
    };

    const processing = scoreProcessing(safeProduct);
    const diet = scoreDiet(safeProduct);
    const macros = scoreMacros(safeProduct);

    const duration = Date.now() - start;
    console.log(`✅ Scan success: ${barcode} (${duration}ms)`);

    return res.json({
      found: true,
      product: data,
      processing,
      diet,
      macroProfile: macros,
      score: diet.score,
      _meta: {
        durationMs: duration
      }
    });

  } catch (err) {
    console.error('💥 Scan route crash:', err);
    return res.status(500).json({
      error: 'scan_failed',
      message: err.message
    });
  }
});

export default router;
