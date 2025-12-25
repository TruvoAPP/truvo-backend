import express from "express";
import { scoreDiet } from "../../services/scan/scoreDiet.mjs";
import { scoreMacros } from "../../services/scan/scoreMacros.mjs";
import { scoreProcessing } from "../../services/scan/scoreProcessing.mjs";
import { supabase } from "../../supabase/client.mjs";

// ✅ Telemetry route
import telemetryRoute from "../telemetry.mjs";

const router = express.Router();

/* -------------------------------------------------
   SCAN ROUTE
------------------------------------------------- */
router.get("/", async (req, res) => {
  const start = Date.now();

  try {
    const { barcode } = req.query;

    console.log("🔍 Scan request:", barcode);
    console.log("🔥 USING OFF TABLE VERSION — DEPLOY CHECK");

    if (!barcode) {
      return res.status(400).json({ error: "Missing barcode" });
    }

    // 🔥 Query OFF table
    const { data, error } = await supabase
      .from("products_off")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase product lookup error:", error);
      return res.status(500).json({ error: "database_error" });
    }

    /* -----------------------------
       PRODUCT NOT FOUND
    ----------------------------- */
    if (!data) {
      const duration = Date.now() - start;
      console.log(`⚠️ Barcode not found: ${barcode} (${duration}ms)`);

      // 🧱 crash-proof async logging
      (async () => {
        try {
          const { error } = await supabase.from("scan_events").insert({
            barcode,
            found: false,
            processing_level: null,
            confidence: null,
            duration_ms: duration,
            source: "scan",
          });
          if (error) console.error("❌ scan_events insert failed:", error);
        } catch (e) {
          console.error("❌ scan_events insert exception:", e);
        }
      })();

      return res.json({
        found: false,
        _meta: { durationMs: duration },
      });
    }

    /* -----------------------------
       PRODUCT FOUND
    ----------------------------- */
    const safeProduct = {
      ...data,
      ingredients: data.ingredients_text || "",
      name: data.product_name || "",
    };

    const processing = scoreProcessing(safeProduct);
    const diet = scoreDiet(safeProduct);
    const macros = scoreMacros(safeProduct);

    // 🧬 Normalize diet compatibility flags
    const defaultDietModel = {
      keto: true,
      paleo: true,
      vegan: false,
      carnivore: false,
    };

    const normalizedDiet = {
      ...defaultDietModel,
      ...diet,
    };

    const duration = Date.now() - start;
    console.log(`✅ Scan success: ${barcode} (${duration}ms)`);

    // 🧱 crash-proof async logging
    (async () => {
      try {
        const { error } = await supabase.from("scan_events").insert({
          barcode,
          found: true,
          processing_level: processing?.level ?? null,
          confidence: processing?.confidence ?? null,
          duration_ms: duration,
          source: "scan",
        });
        if (error) console.error("❌ scan_events insert failed:", error);
      } catch (e) {
        console.error("❌ scan_events insert exception:", e);
      }
    })();

    return res.json({
      found: true,
      product: data,
      processing,
      diet: normalizedDiet,
      macroProfile: macros,
      score: normalizedDiet.score,
      _meta: { durationMs: duration },
    });

  } catch (err) {
    console.error("💥 Scan route crash:", err);
    return res.status(500).json({
      error: "scan_failed",
      message: err.message,
    });
  }
});

/* -------------------------------------------------
   TELEMETRY ROUTE
------------------------------------------------- */
router.use("/telemetry", telemetryRoute);

export default router;
