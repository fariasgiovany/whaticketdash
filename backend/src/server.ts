import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import cleanupCompletedCards from "./services/CardServices/CleanupCompletedCards";
import { startScheduledMessageWorker } from "./services/ScheduledMessageServices/RunScheduledMessageQueue";

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
StartAllWhatsAppsSessions();
void cleanupCompletedCards();
setInterval(() => { void cleanupCompletedCards(); }, 24 * 60 * 60 * 1000).unref();
const stopScheduledMessageWorker = startScheduledMessageWorker();
gracefulShutdown(server, { onShutdown: async () => stopScheduledMessageWorker() });

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
