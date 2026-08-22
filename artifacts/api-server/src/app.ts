import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import stripeWebhookRouter from "./routes/stripeWebhook";
import revenuecatWebhookRouter from "./routes/revenuecatWebhook";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy — must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Stripe webhook — also before express.json(), signature verification
// needs the exact raw body. Only the website ever talks to Stripe directly;
// this is just the backend's side of the sync.
app.use("/api", stripeWebhookRouter);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RevenueCat webhook — plain JSON (its own Authorization-header shared
// secret, not a request-signature scheme like Stripe's), so it goes through
// the normal body parsers above rather than needing the raw body Stripe's
// route requires.
app.use("/api", revenuecatWebhookRouter);

// Generic per-IP ceiling — not per-user (auth happens further down the
// chain), just enough to stop a single client from hammering the API.
// Sized with headroom for carrier-grade NAT (common in Egypt), where
// several unrelated users can share one public IP: background price
// polling alone runs ~80 requests/15min per active user, so a handful of
// people behind the same IP need well above that before hitting a wall.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  clerkMiddleware((req: any) => ({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "",
  })),
);

app.use("/api", router);

export default app;
