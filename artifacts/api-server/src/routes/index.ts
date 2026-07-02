import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketsRouter from "./markets";
import holdingsRouter from "./holdings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketsRouter);
router.use(holdingsRouter);

export default router;
