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

// Each call is a real, paid Azure Speech request — capped the same way
// /chat's Gemini calls are (see chatGenerationLimit in chat.ts), per user
// rather than relying only on the app-wide IP limiter in app.ts.
const ttsLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId ?? "anonymous",
});

// Egyptian Arabic specifically (not generic MSA/Gulf) — the whole point of
// picking Azure here, see the voice-conversation plan for why this mattered
// enough to be worth a dedicated provider decision.
const VOICE_BY_LANG: Record<"en" | "ar", { voice: string; locale: string }> = {
  en: { voice: "en-US-AriaNeural", locale: "en-US" },
  ar: { voice: "ar-EG-SalmaNeural", locale: "ar-EG" },
};

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// POST /api/tts — { text, language: 'en' | 'ar' } -> audio/mpeg bytes.
// Streams straight back as the response body; nothing is stored server-side,
// there's no reason to keep a copy of an AI reply's audio around.
router.post("/tts", ttsLimit, async (req, res) => {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    res.status(503).json({ error: "Voice replies are not available right now" });
    return;
  }

  const body = req.body as { text?: string; language?: string };
  const text = body.text?.trim();
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  const lang = body.language === "ar" ? "ar" : "en";
  const { voice, locale } = VOICE_BY_LANG[lang];

  const ssml =
    `<speak version='1.0' xml:lang='${locale}'>` +
    `<voice name='${voice}'>${escapeSsml(text)}</voice>` +
    `</speak>`;

  try {
    const azureRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    });

    if (!azureRes.ok) {
      logger.error({ status: azureRes.status, body: await azureRes.text() }, "Azure TTS request failed");
      res.status(502).json({ error: "Could not generate voice reply" });
      return;
    }

    const audio = Buffer.from(await azureRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (err) {
    logger.error({ err }, "POST /tts failed");
    res.status(500).json({ error: "Could not generate voice reply" });
  }
});

export default router;
