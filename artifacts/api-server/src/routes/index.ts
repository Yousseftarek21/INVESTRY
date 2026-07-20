import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketsRouter from "./markets";
import holdingsRouter from "./holdings";
import cashRouter from "./cash";
import subscriptionRouter from "./subscription";
import legalRouter from "./legal";
import configRouter from "./config";
import referralRouter from "./referral";
import pushRouter from "./push";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketsRouter);
router.use(holdingsRouter);
router.use(cashRouter);
router.use(subscriptionRouter);
router.use(legalRouter);
router.use(configRouter);
router.use(referralRouter);
router.use(pushRouter);
router.use(accountRouter);

export default router;
