import { Router } from "express";
import multer from "multer";
import AppError from "../errors/AppError";
import isAuth from "../middleware/isAuth";
import * as controller from "../controllers/ScheduledMessageController";

const routes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 4, fieldSize: 16 * 1024 }
}).array("medias", 5);

routes.get("/scheduled-messages", isAuth, controller.index);
routes.get("/scheduled-messages/contacts", isAuth, controller.contacts);
routes.get("/scheduled-messages/connections", isAuth, controller.connections);
routes.post("/scheduled-messages", isAuth, (req, res, next) => {
  upload(req, res, error => {
    if (error instanceof multer.MulterError) {
      return next(new AppError("Envie até 5 arquivos, com no máximo 10 MB cada.", 400));
    }
    return next(error);
  });
}, controller.create);
routes.delete("/scheduled-messages/:id", isAuth, controller.cancel);

export default routes;
