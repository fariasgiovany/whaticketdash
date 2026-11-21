import { randomInt } from "crypto";
import { Op, WhereOptions } from "sequelize";
import db from "../../database";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ScheduledMessage from "../../models/ScheduledMessage";
import ScheduledMessageQueue from "../../models/ScheduledMessageQueue";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

const queueId = 1;
const pollInterval = 2000;
const claimDuration = 15 * 60 * 1000;
const nextSlot = () => new Date(Date.now() + randomInt(10000, 15001));

const resolveTicket = async (message: ScheduledMessage) => {
  if (message.ticketId) return ShowTicketService(message.ticketId);
  if (!message.contactId || !message.whatsappId) return null;

  const [contact, whatsapp] = await Promise.all([
    Contact.findByPk(message.contactId),
    Whatsapp.findByPk(message.whatsappId, { attributes: ["id", "status"] })
  ]);
  if (!contact?.number || whatsapp?.status !== "CONNECTED") return null;

  return FindOrCreateTicketService(contact, whatsapp.id, undefined, contact.isGroup ? contact : undefined);
};

const claim = () => db.transaction(async transaction => {
  const queue = await ScheduledMessageQueue.findByPk(queueId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!queue) throw new Error("Scheduled message queue is missing");
  const now = new Date();
  if (queue.availableAt > now) return { delay: Math.min(pollInterval, queue.availableAt.getTime() - now.getTime()) };

  if (queue.activeMessageId !== null) {
    // Delivery may have succeeded just before the worker stopped. Do not send it again automatically.
    const active = await ScheduledMessage.findByPk(queue.activeMessageId, { attributes: ["batchId"], transaction });
    const interrupted: WhereOptions = active?.batchId
      ? { batchId: active.batchId, status: "sending" }
      : { id: queue.activeMessageId, status: "sending" };
    await ScheduledMessage.update({
      status: "failed", attachment: null, errorMessage: "Envio interrompido. Confira a conversa antes de reagendar."
    }, { where: interrupted, transaction });
    const availableAt = nextSlot();
    await queue.update({ availableAt, activeMessageId: null }, { transaction });
    return { delay: Math.max(0, availableAt.getTime() - Date.now()) };
  }

  const message = await ScheduledMessage.findOne({
    attributes: ["id", "batchId"],
    where: { status: "queued", scheduledAt: { [Op.lte]: now } },
    order: [["scheduledAt", "ASC"], ["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!message) return { delay: pollInterval };
  const batch = message.batchId ? await ScheduledMessage.findAll({
    attributes: ["id"],
    where: { batchId: message.batchId, status: "queued" },
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.UPDATE
  }) : [message];
  const messageIds = batch.map(entry => entry.id);
  await ScheduledMessage.update({ status: "sending" }, { where: { id: messageIds }, transaction });
  await queue.update({ activeMessageId: message.id, availableAt: new Date(now.getTime() + claimDuration) }, { transaction });
  return { activeId: message.id, messageIds, delay: 0 };
});

const send = async (message: ScheduledMessage): Promise<void> => {
  let errorMessage: string | null = null;
  try {
    const ticket = await resolveTicket(message);
    if (!ticket || !ticket.whatsappId || !ticket.contact.number) {
      errorMessage = "Contato ou conexão indisponível para envio.";
    } else if (message.attachmentName) {
      if (!message.attachment) throw new Error("Scheduled attachment is missing");
      await SendWhatsAppMedia({
        ticket,
        body: message.body,
        media: { filename: message.attachmentName, mimetype: message.attachmentType || "application/octet-stream", data: message.attachment }
      });
    } else {
      await SendWhatsAppMessage({ body: message.body, ticket });
    }
  } catch (error) {
    errorMessage = "Falha no envio. Confira a conversa antes de reagendar.";
    logger.warn({ messageId: message.id, error: error instanceof AppError ? error.message : String(error) }, "Scheduled message failed");
  }
  await ScheduledMessage.update({
    status: errorMessage ? "failed" : "sent",
    sentAt: errorMessage ? null : new Date(),
    attachment: null,
    errorMessage
  }, { where: { id: message.id, status: "sending" } });
};

export const runScheduledMessageQueue = async (): Promise<number> => {
  const { activeId, messageIds, delay } = await claim();
  if (!messageIds) return delay;

  for (const messageId of messageIds) {
    const message = await ScheduledMessage.findOne({ where: { id: messageId, status: "sending" } });
    if (message) await send(message);
  }

  return db.transaction(async transaction => {
    const queue = await ScheduledMessageQueue.findByPk(queueId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!queue || queue.activeMessageId !== activeId) return pollInterval;
    const availableAt = nextSlot();
    await queue.update({ activeMessageId: null, availableAt }, { transaction });
    return Math.max(0, availableAt.getTime() - Date.now());
  });
};

export const startScheduledMessageWorker = (): (() => void) => {
  let stopped = false;
  let timer: NodeJS.Timeout;

  const tick = async () => {
    let delay = pollInterval;
    try {
      delay = await runScheduledMessageQueue();
    } catch (error) {
      logger.error(error, "Scheduled message queue failed");
    }
    if (!stopped) timer = setTimeout(tick, delay).unref();
  };

  timer = setTimeout(tick, pollInterval).unref();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
