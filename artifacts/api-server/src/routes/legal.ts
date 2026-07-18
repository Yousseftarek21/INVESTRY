import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PAGE_STYLE = `
  <style>
    :root { color-scheme: dark; }
    body {
      background: #060D1A;
      color: #E8EAED;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }
    h1 { color: #D4AC0D; font-size: 28px; margin-bottom: 4px; }
    .updated { color: #9AA5B1; font-size: 13px; margin-bottom: 32px; }
    h2 { color: #D4AC0D; font-size: 18px; margin-top: 32px; }
    p, li { color: #C7CCD3; font-size: 15px; }
    a { color: #D4AC0D; }
    ul { padding-left: 20px; }
  </style>
`;

router.get("/legal/privacy", (_req, res) => {
  res.set("Content-Type", "text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — INVESTRY</title>${PAGE_STYLE}</head>
<body>
  <h1>Privacy Policy</h1>
  <div class="updated">Last updated: July 2026</div>

  <p>INVESTRY ("we", "our", "the app") helps you track gold, silver, EGX stock, real estate, and cash holdings. This policy explains what data we collect and how it is used.</p>

  <h2>Account & Authentication</h2>
  <p>We use Clerk to manage sign-in via email/password, Google, and Apple. Clerk processes your email address and authentication credentials on our behalf. We never see or store your password.</p>

  <h2>Your Portfolio Data</h2>
  <p>Investment holdings and cash accounts you add are stored securely, tied to your authenticated account, and are never shared with other users or sold to third parties. A local copy is cached on your device for offline access.</p>

  <h2>Third-Party Market Data</h2>
  <p>We fetch live prices from third-party providers (Yahoo Finance, TradingView, and currency exchange-rate APIs) to display market data. No personal information is sent to these providers — only anonymous, public price lookups.</p>

  <h2>Subscriptions</h2>
  <p>All features are currently available free of charge. We do not process payments or store card details.</p>

  <h2>Data Retention & Deletion</h2>
  <p>You may request deletion of your account and all associated data at any time by contacting us below. Data is deleted from our servers within 30 days of a verified request.</p>

  <h2>Contact</h2>
  <p>Questions about this policy? Email <a href="mailto:privacy@investry.app">privacy@investry.app</a>.</p>
</body>
</html>`);
});

router.get("/legal/terms", (_req, res) => {
  res.set("Content-Type", "text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Terms of Service — INVESTRY</title>${PAGE_STYLE}</head>
<body>
  <h1>Terms of Service</h1>
  <div class="updated">Last updated: July 2026</div>

  <p>By using INVESTRY, you agree to the following terms.</p>

  <h2>Use of the App</h2>
  <p>INVESTRY is provided for personal portfolio tracking and informational purposes only. It is not financial advice. Market prices shown may be delayed or approximate and should not be relied on for trading decisions.</p>

  <h2>Accounts</h2>
  <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</p>

  <h2>Subscriptions</h2>
  <p>All features are currently available free of charge. No payment or subscription is required to use INVESTRY.</p>

  <h2>Disclaimer</h2>
  <p>We make no guarantees about the accuracy of market data. INVESTRY is not liable for financial decisions made using data shown in the app.</p>

  <h2>Contact</h2>
  <p>Questions? Email <a href="mailto:support@investry.app">support@investry.app</a>.</p>
</body>
</html>`);
});

export default router;
