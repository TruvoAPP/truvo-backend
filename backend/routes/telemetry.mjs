import express from "express";
import { supabase } from "../supabase/client.mjs";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    // 🔒 HARD RULE: telemetry must never block UX
    supabase
      .from("ux_events")
      .insert(payload)
      .catch(() => {});

    // Fast, fire-and-forget
    res.status(204).end();
  } catch {
    // Swallow everything
    res.status(204).end();
  }
});

export default router;
