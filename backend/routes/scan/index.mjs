import express from "express";
import { scoreDiet } from "../../services/scan/scoreDiet.mjs";
import { scoreMacros } from "../../services/scan/scoreMacros.mjs";
import { scoreProcessing } from "../../services/scan/scoreProcessing.mjs";
import { supabase } from "../../supabase/client.mjs";

// ✅ Telemetry route
import telemetryRoute from "../telemetry.mjs";

const router = express.Router();

/* -------------------------------------------------
   Helpers
------------------------------------------------- */

function normalizeBarcode(raw) {
  return String(raw || "").replace(/[^0-9]/g, "");
}

async function fetchFromOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
  const resp = await fetch(url);          // ← native fetch (Node 18+)
  if (!resp.ok) return null;

  const json = await resp.json();
  if (json.status !== 1 || !json.product) return null;

  return json.product;
}

function normalizeOFFProduct(off) {
  return {
    barcode: off.code,
    product_name: off.product_name || "",
    brands: off.brands || null,
    ingredients_text: off.ingredients_text || "",
    additives_tags: off.additives_tags || null,
    additives_n: off.additives_n ?? null,
    categories_tags: off.categories_tags || null,
    countries_tags: off.countries_tags || null,
    has_ingredients: Boolean(off.ingredients_text),
    has_macros: Boolean(off.nutriments),
    has_additives: Boolean(off.additives_n > 0),
    confidence_off: "HIGH",
    source: "open_food_facts",
    image_thumb_url: off.image_thumb_url || null,
    image_small_url: off.image_small_url || null,
    image_front_url: off.image_front_url || null,
    image_ingredients_url: off.image_ingredients_url || null,
    image_nutrition_url: off.image_nutrition_url || null,
    nutriments: off.nutriments || null,
    energy_kcal_100g: off.nutriments?.energy_kcal_100g ?? null,
    fat_100g: off.nutriments?.fat_100g ?? null,
    carbohydrates_100g: off.nutriments?.carbohydrates_100g ?? null,
    proteins_100g: off.nutriments?.proteins_100g ?? null,
    salt_100g: off.nutriments?.salt_100g ?? null,
  };
}

/* -------------------------------------------------
   SCAN ROUTE
------------------------------------------------- */
router.get("/", async (req, res) => {
  const start = Date.now();

  try {
    const rawBarcode = req.query.barcode;
    const barcode = normalizeBarcode(rawBarcode);

    console.log("📥 RAW BARCODE:", JSON.stringify(rawBarcode));
    console.log("🧼 NORMALIZED BARCODE:", JSON.stringify(barcode));
    console.log("🔥 USING OFF TABLE + LIVE FALLBACK");

    if (!barcode) {
      return res.status(400).json({ error: "Missing barcode" });
    }

    /* -----------------------------
       1️⃣ Lookup local DB
    ----------------------------- */
    let { data, error } = await supabase
      .from("products_off")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase lookup error:", error);
      return res.status(500).json({ error: "database_error" });
    }

    /* -----------------------------
       2️⃣ Fallback to OpenFoodFacts
    ----------------------------- */
    if (!data) {
      console.log("🌍 Fetching from OpenFoodFacts:", barcode);

      const offProduct = await fetchFromOFF(barcode);

      if (offProduct) {
        const normalized = normalizeOFFProduct(offProduct);

        const insert = await supabase
          .from("products_off")
          .upsert(normalized, { onConflict: "barcode" })
          .select()
          .single();

        if (insert.error) {
          console.error("❌ OFF insert error:", insert.error);
        } else {
          data = insert.data;
          console.log("💾 Stored new OFF product:", barcode);
        }
      }
    }

    /* -----------------------------
       PRODUCT STILL NOT FOUND
    ----------------------------- */
    if (!data) {
      const duration = Date.now() - start;
      console.log(`⚠️ Barcode not found anywhere: ${barcode} (${duration}ms)`);

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
      name: data.product_name || "",
      ingredients: data.ingredients_text || "",
    };

    const processing = scoreProcessing(safeProduct);
    const diet = scoreDiet(safeProduct);
    const macros = scoreMacros(safeProduct);

    const defaultDietModel = {
      keto: true,
      paleo: true,
      vegan: false,
      carnivore: false,
    };

    const normalizedDiet = { ...defaultDietModel, ...diet };

    const duration = Date.now() - start;
    console.log(`✅ Scan success: ${barcode} (${duration}ms)`);

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
      product: safeProduct,
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
