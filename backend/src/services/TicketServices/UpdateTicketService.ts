import sequelize from "../../database";
import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Card from "../../models/Card";
import ShowTicketService from "./ShowTicketService";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  const { oldStatus, oldUserId } = await sequelize.transaction(async transaction => {
    const current = await Ticket.findByPk(ticket.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!current) throw new AppError("ERR_NO_TICKET_FOUND", 404);

    const oldStatus = current.status;
    const oldUserId = current.userId ?? undefined;

    if (whatsappId && current.whatsappId !== whatsappId) {
      await CheckContactOpenTickets(current.contactId, whatsappId, transaction);
    }
    if (oldStatus === "closed") {
      await CheckContactOpenTickets(current.contactId, current.whatsappId, transaction);
    }

    await current.update({
      status,
      queueId,
      userId,
      ignoredAt: status ? (status === "ignored" ? new Date() : null) : undefined,
      ...(whatsappId ? { whatsappId } : {}),
      ...(status === "closed" && oldStatus !== "closed"
        ? { closedAt: new Date() }
        : status && status !== "closed"
        ? { closedAt: null }
        : {})
    }, { transaction });

    if (current.status === "open" && oldStatus !== "open") {
      const [card] = await Card.findOrCreate({
        where: { ticketId: current.id },
        defaults: {
          ticketId: current.id,
          title: ticket.contact.name,
          position: Math.floor(Date.now() / 1000),
          completed: false
        },
        transaction
      });
      if (card.completed) {
        await card.update({ completed: false, completedAt: null }, { transaction });
      }
    } else if (status === "ignored" || (current.status === "closed" && oldStatus !== "closed")) {
      await Card.update(
        { completed: true, completedAt: new Date() },
        {
          where: {
            ticketId: current.id,
            ...(status === "ignored" ? { completed: false } : {})
          },
          transaction
        }
      );
    }

    await ticket.reload({ transaction });
    return { oldStatus, oldUserId };
  });

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    });

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
