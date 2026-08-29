import app from "./app";
import { logger } from "./lib/logger";
import { startPortfolioAlertCron } from "./lib/portfolioAlertCron";
import { startUserPriceAlertCron } from "./lib/userPriceAlertCron";
import { startPortfolioDriftCron } from "./lib/portfolioDriftCron";
import { startRealEstatePriceCron } from "./lib/realEstatePriceCron";
import { startDailySummaryCron } from "./lib/dailySummaryCron";
import { startLeaderboardRankCron } from "./lib/leaderboardRankCron";
import { startReferralMonthlyWinnerCron } from "./lib/referralMonthlyWinnerCron";
import { ensureUserColumns } from "./lib/ensureUserColumns";
import { ensureDividendsTable, ensureIntradayColumn, ensureSoldHoldingsTable, ensureDailyChangeSnapshotsTable, ensureReferralMonthlyWinnersTable } from "./lib/ensureDividendsTable";
import { sendCompetitionAnnouncement } from "./lib/competitionAnnouncement";
import { assertEncryptionKeyConfigured } from "./lib/encryption";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

assertEncryptionKeyConfigured();

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await ensureUserColumns();
  await ensureDividendsTable();
  await ensureSoldHoldingsTable();
  await ensureIntradayColumn();
  await ensureDailyChangeSnapshotsTable();
  await ensureReferralMonthlyWinnersTable();
  await sendCompetitionAnnouncement();
  startPortfolioAlertCron();
  startUserPriceAlertCron();
  startPortfolioDriftCron();
  startRealEstatePriceCron();
  startDailySummaryCron();
  startLeaderboardRankCron();
  startReferralMonthlyWinnerCron();
});
