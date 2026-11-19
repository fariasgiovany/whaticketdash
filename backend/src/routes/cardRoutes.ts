import express from "express";
import isAuth from "../middleware/isAuth";
import * as CardController from "../controllers/CardController";

const routes = express.Router();
routes.get("/cards", isAuth, CardController.index);
routes.post("/card-lists", isAuth, CardController.createList);
routes.put("/card-lists/:listId", isAuth, CardController.updateList);
routes.delete("/card-lists/:listId", isAuth, CardController.deleteList);
routes.post("/cards", isAuth, CardController.createCard);
routes.put("/cards/:cardId", isAuth, CardController.updateCard);
routes.post("/cards/:cardId/comments", isAuth, CardController.createComment);
export default routes;
