import express from "express";
import isAuth from "../middleware/isAuth";
import { index } from "../controllers/DashboardController";

const dashboardRoutes = express.Router();
dashboardRoutes.get("/dashboard", isAuth, index);

export default dashboardRoutes;
