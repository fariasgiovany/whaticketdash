import sequelize from "../../database";
import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  quotedMsgId?: string;
}
interface Request {
  messageData: MessageData;
  timestamp: number;
  lastMessage: string;
  unreadMessages: number;
}

const CreateMessageService = async ({
  messageData,
  timestamp,
  lastMessage,
  unreadMessages
}: Request): Promise<Message> => {
  const { isNew, reopened } = await sequelize.transaction(async transaction => {
    const ticket = await Ticket.findByPk(messageData.ticketId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);

    const existing = await Message.findByPk(messageData.id, { transaction });
    const isNew = !existing;
    // WhatsApp timestamps have second-level precision.
    const keepIgnored =
      ticket.status === "ignored" &&
      ticket.ignoredAt !== null &&
      timestamp < Math.floor(ticket.ignoredAt.getTime() / 1000);
    const reopened = isNew && ticket.status === "ignored" && !keepIgnored;

    await Message.upsert(
      {
        ...messageData,
        ticketId: existing?.ticketId ?? ticket.id,
        read: existing?.read ?? (keepIgnored || messageData.read)
      },
      { transaction }
    );

    if (isNew && !keepIgnored) {
      await ticket.update(
        {
          lastMessage,
          unreadMessages,
          ...(reopened
            ? { status: "pending", userId: null, closedAt: null, ignoredAt: null }
            : {})
        },
        { transaction }
      );
    }

    return { isNew, reopened };
  });

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          { association: "user", attributes: ["id", "name"] },
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  const io = getIO();
  if (reopened && message.ticket.status !== "ignored") {
    io.to("ignored").emit("ticket", { action: "delete", ticketId: message.ticketId });
    io.to(message.ticketId.toString())
      .to(message.ticket.status)
      .to("notification")
      .emit("ticket", { action: "update", ticket: message.ticket });
  }

  if (!isNew) {
    io.to(message.ticketId.toString()).emit("appMessage", { action: "update", message });
    return message;
  }

  io.to(message.ticketId.toString())
    .to(message.ticket.status)
    .to("notification")
    .emit("appMessage", {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    });

  return message;
};

export default CreateMessageService;
