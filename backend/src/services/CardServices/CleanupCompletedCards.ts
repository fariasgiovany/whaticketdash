import { subMonths } from "date-fns";
import { Op } from "sequelize";
import Card from "../../models/Card";
import { logger } from "../../utils/logger";

const cleanupCompletedCards = async (): Promise<void> => {
  try {
    const removed = await Card.destroy({
      where: {
        completed: true,
        completedAt: { [Op.lte]: subMonths(new Date(), 2) }
      }
    });
    if (removed) logger.info(`Removed ${removed} completed cards older than two months`);
  } catch (err) {
    logger.error({ info: "Could not clean up completed cards", err });
  }
};

export default cleanupCompletedCards;
