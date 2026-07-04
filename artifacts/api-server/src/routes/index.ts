import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketsRouter from "./markets";
import holdingsRouter from "./holdings";
import cashRouter from "./cash";
import stripeRouter from "./stripe";
import legalRouter from "./legal";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketsRouter);
router.use(holdingsRouter);
router.use(cashRouter);
router.use(stripeRouter);
router.use(legalRouter);
router.use(configRouter);

export default router;
