import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";

const router = Router();

const DEMO_USER_ID = "user_3GJV6le3IyOXHlge1OqZhoYmcXy";

router.get("/demo/token", async (req, res) => {
  try {
    const token = await clerkClient.signInTokens.createSignInToken({
      userId: DEMO_USER_ID,
      expiresInSeconds: 3600,
    });
    res.json({ token: token.token });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create demo sign-in token");
    res.status(500).json({ error: "Failed to create demo token" });
  }
});

export default router;
