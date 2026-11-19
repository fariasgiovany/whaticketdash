import { Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../database";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Card from "../models/Card";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

type FirstReply = { ticketId: number; firstInbound: Date; firstReply: Date | null };

const selectedId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const now = new Date();
  const todayGmtMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const since = new Date(String(req.query.since || ""));
  const until = new Date(String(req.query.until || ""));
  if (
    Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) ||
    since >= until || until.getTime() > now.getTime() + 86400000 ||
    until.getTime() - since.getTime() > 367 * 86400000
  ) {
    return res.status(400).json({ error: "Período inválido" });
  }

  const user = await User.findByPk(req.user.id, { include: [{ model: Queue, as: "queues" }] });
  if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
  const allowedQueueIds = user?.queues.map(queue => queue.id) || [];
  const queueId = selectedId(req.query.queueId);
  const userId = selectedId(req.query.userId);
  if (user.profile !== "admin" && userId && userId !== user.id) {
    return res.status(403).json({ error: "Atendente não permitido" });
  }
  const whatsappId = selectedId(req.query.whatsappId);
  const queueFilter = queueId && allowedQueueIds.includes(queueId)
    ? queueId
    : { [Op.or]: [...allowedQueueIds, null] };
  const commonWhere = {
    queueId: queueFilter,
    ...(userId ? { userId } : {}),
    ...(whatsappId ? { whatsappId } : {})
  };

  const [tickets, activeTickets, closedTickets, cards, dueCards, queues, users, whatsapps] = await Promise.all([
    Ticket.findAll({
      where: { ...commonWhere, createdAt: { [Op.gte]: since, [Op.lt]: until } },
      attributes: ["id", "status", "createdAt", "updatedAt", "closedAt", "unreadMessages"]
    }),
    Ticket.findAll({
      where: { ...commonWhere, status: { [Op.in]: ["open", "pending"] } },
      attributes: ["id", "status", "createdAt", "updatedAt", "unreadMessages"]
    }),
    Ticket.findAll({
      where: { ...commonWhere, status: "closed", closedAt: { [Op.gte]: since, [Op.lt]: until } },
      attributes: ["id", "createdAt", "closedAt"]
    }),
    Card.findAll({ attributes: ["id", "title", "ticketId", "completed", "completedAt", "createdAt"] }),
    Card.findAll({
      attributes: ["id", "title", "dueDate"],
      where: {
        completed: false,
        dueDate: { [Op.lte]: todayGmtMinus3 },
        [Op.or]: [{ ticketId: null }, { "$ticket.id$": { [Op.gt]: 0 } }]
      },
      include: [{ model: Ticket, as: "ticket", attributes: [], required: false, where: commonWhere }],
      order: [["dueDate", "ASC"], ["id", "ASC"]]
    }),
    Queue.findAll({ where: { id: { [Op.in]: allowedQueueIds } }, attributes: ["id", "name"] }),
    User.findAll({
      where: user.profile === "admin" ? undefined : { id: user.id },
      attributes: ["id", "name"],
      order: [["name", "ASC"]]
    }),
    Whatsapp.findAll({ attributes: ["id", "name", "status"], order: [["name", "ASC"]] })
  ]);

  const ticketIds = tickets.map(ticket => ticket.id);
  const firstReplies: FirstReply[] = ticketIds.length
    ? await sequelize.query<FirstReply>(
        `SELECT incoming.ticketId, incoming.firstInbound, MIN(reply.createdAt) AS firstReply
         FROM (
           SELECT ticketId, MIN(createdAt) AS firstInbound
           FROM Messages WHERE fromMe = 0 AND ticketId IN (:ticketIds)
           GROUP BY ticketId
         ) incoming
         LEFT JOIN Messages reply ON reply.ticketId = incoming.ticketId
           AND reply.fromMe = 1 AND reply.createdAt >= incoming.firstInbound
         GROUP BY incoming.ticketId, incoming.firstInbound`,
        { replacements: { ticketIds }, type: QueryTypes.SELECT }
      )
    : [];
  const replyMinutes = firstReplies
    .filter(row => row.firstReply)
    .map(row => (new Date(row.firstReply!).getTime() - new Date(row.firstInbound).getTime()) / 60000);
  const resolutionMinutes = closedTickets.map(ticket =>
    (ticket.closedAt.getTime() - ticket.createdAt.getTime()) / 60000
  );
  const average = (values: number[]) => values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;

  const offset = Math.max(-840, Math.min(840, Number(req.query.offset) || 0));
  const localDay = (date: Date): string =>
    new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  const timeline: Record<string, { day: string; created: number; closed: number }> = {};
  for (let day = new Date(since); day < until; day = new Date(day.getTime() + 86400000)) {
    const key = localDay(day);
    timeline[key] = { day: key, created: 0, closed: 0 };
  }
  tickets.forEach(ticket => {
    const key = localDay(ticket.createdAt);
    if (timeline[key]) timeline[key].created += 1;
  });
  closedTickets.forEach(ticket => {
    const key = localDay(ticket.closedAt);
    if (timeline[key]) timeline[key].closed += 1;
  });

  const waiting = activeTickets
    .filter(ticket => ticket.status === "pending" || ticket.unreadMessages > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 6);
  const urgent = waiting.length
    ? await Ticket.findAll({
        where: { id: { [Op.in]: waiting.map(ticket => ticket.id) } },
        include: [{ model: Contact, as: "contact", attributes: ["name"] }]
      })
    : [];
  const urgentById = new Map(urgent.map(ticket => [ticket.id, ticket]));
  const visibleTicketIds = new Set([...ticketIds, ...activeTickets.map(ticket => ticket.id), ...closedTickets.map(ticket => ticket.id)]);
  const visibleCards = cards.filter(card =>
    (!card.ticketId || visibleTicketIds.has(card.ticketId)) &&
    (card.completed
      ? Boolean(card.completedAt && card.completedAt >= since && card.completedAt < until)
      : card.createdAt < until)
  );
  const staleCards = visibleCards
    .filter(card => !card.completed && now.getTime() - card.createdAt.getTime() >= 7 * 86400000)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return res.json({
    summary: {
      open: activeTickets.filter(ticket => ticket.status === "open").length,
      pending: activeTickets.filter(ticket => ticket.status === "pending").length,
      closed: tickets.filter(ticket => ticket.status === "closed").length,
      unread: activeTickets.filter(ticket => ticket.unreadMessages > 0).length,
      closedInPeriod: closedTickets.length,
      firstReplyMinutes: average(replyMinutes),
      resolutionMinutes: average(resolutionMinutes),
      staleCards: staleCards.length,
      completedCards: visibleCards.filter(card => card.completed && card.completedAt && card.completedAt >= since && card.completedAt < until).length
    },
    timeline: Object.values(timeline).sort((a, b) => a.day.localeCompare(b.day)),
    urgent: waiting.map(ticket => ({
      id: ticket.id,
      name: urgentById.get(ticket.id)?.contact?.name || `Ticket #${ticket.id}`,
      status: ticket.status,
      unreadMessages: ticket.unreadMessages,
      createdAt: ticket.createdAt
    })),
    cards: staleCards.slice(0, 5).map(card => ({ id: card.id, title: card.title, createdAt: card.createdAt })),
    dueCards: dueCards.map(({ id, title, dueDate }) => ({
      id,
      title,
      dueDate,
      status: dueDate === todayGmtMinus3 ? "today" : "overdue"
    })),
    connections: whatsapps
      .filter(whatsapp => !whatsappId || whatsapp.id === whatsappId)
      .map(whatsapp => ({ id: whatsapp.id, name: whatsapp.name, status: whatsapp.status })),
    filters: { queues, users, whatsapps: whatsapps.map(({ id, name }) => ({ id, name })) }
  });
};
