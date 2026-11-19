import { Op, Transaction } from "sequelize";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";

const CheckContactOpenTickets = async (
  contactId: number,
  whatsappId: number,
  transaction?: Transaction
): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { contactId, whatsappId, status: { [Op.or]: ["open", "pending"] } },
    transaction
  });

  if (ticket) {
    throw new AppError("ERR_OTHER_OPEN_TICKET");
  }
};

export default CheckContactOpenTickets;
