import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketsRouter from "./markets";
import holdingsRouter from "./holdings";
import cashRouter from "./cash";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketsRouter);
router.use(holdingsRouter);
router.use(cashRouter);
router.use(stripeRouter);

export default router;
