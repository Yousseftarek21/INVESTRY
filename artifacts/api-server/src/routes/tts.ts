import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Require a valid Clerk session for the TTS route
router.use("/tts", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// Each call is a real, paid ElevenLabs request — capped the same way
// /chat's Gemini calls are (see chatGenerationLimit in chat.ts), per user
// rather than relying only on the app-wide IP limiter in app.ts.
const ttsLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId ?? "anonymous",
});

// Voice IDs are per-account (ElevenLabs' library changes and different
// accounts have different voices cloned/saved) — deliberately not
// hardcoded to a guessed default. Pick a voice you've actually listened to
// in the ElevenLabs dashboard for each language and set these in Render.
// ELEVENLABS_VOICE_ID_AR in particular should be picked by ear for Arabic
// quality specifically — this provider has no dedicated Egyptian-dialect
// voice the way Azure did, so it's worth comparing a couple of candidates.
function voiceIdFor(lang: "en" | "ar"): string | undefined {
  return lang === "ar" ? process.env.ELEVENLABS_VOICE_ID_AR : process.env.ELEVENLABS_VOICE_ID_EN;
}

// POST /api/tts — { text, language: 'en' | 'ar' } -> audio/mpeg bytes.
// Streams straight back as the response body; nothing is stored server-side,
// there's no reason to keep a copy of an AI reply's audio around.
router.post("/tts", ttsLimit, async (req, res) => {
  const key = process.env.ELEVENLABS_API_KEY;
  const body = req.body as { text?: string; language?: string };
  const text = body.text?.trim();
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  const lang = body.language === "ar" ? "ar" : "en";
  const voiceId = voiceIdFor(lang);

  if (!key || !voiceId) {
    res.status(503).json({ error: "Voice replies are not available right now" });
    return;
  }

  try {
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        // Multilingual v2 is the model with real Arabic support — the
        // default English-only models silently mangle non-English text.
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!elevenRes.ok) {
      logger.error({ status: elevenRes.status, body: await elevenRes.text() }, "ElevenLabs TTS request failed");
      res.status(502).json({ error: "Could not generate voice reply" });
      return;
    }

    const audio = Buffer.from(await elevenRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (err) {
    logger.error({ err }, "POST /tts failed");
    res.status(500).json({ error: "Could not generate voice reply" });
  }
});

export default router;
