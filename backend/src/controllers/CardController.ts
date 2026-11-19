import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Card from "../models/Card";
import CardList from "../models/CardList";
import CardComment from "../models/CardComment";
import User from "../models/User";
import sequelize from "../database";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import formatBody from "../helpers/Mustache";

const cardInclude = [
  { model: CardComment, as: "comments", include: [{ model: User, as: "user", attributes: ["id", "name"] }] }
];

export const index = async (_req: Request, res: Response): Promise<Response> => {
  const [lists, cards] = await Promise.all([
    CardList.findAll({ order: [["position", "ASC"], ["id", "ASC"]] }),
    Card.findAll({ include: cardInclude, order: [["position", "ASC"], ["id", "ASC"]] })
  ]);
  return res.json({ lists, cards });
};

export const createList = async (req: Request, res: Response): Promise<Response> => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new AppError("Informe o nome da lista");
  const list = await CardList.create({ name, position: Math.floor(Date.now() / 1000) });
  return res.status(201).json(list);
};

export const updateList = async (req: Request, res: Response): Promise<Response> => {
  const list = await CardList.findByPk(req.params.listId);
  if (!list) throw new AppError("Lista não encontrada", 404);
  const name = String(req.body.name || "").trim();
  if (!name) throw new AppError("Informe o nome da lista");
  await list.update({ name });
  return res.json(list);
};

export const deleteList = async (req: Request, res: Response): Promise<Response> => {
  const list = await CardList.findByPk(req.params.listId);
  if (!list) throw new AppError("Lista não encontrada", 404);
  await sequelize.transaction(async transaction => {
    await Card.update({ listId: null }, { where: { listId: list.id }, transaction });
    await list.destroy({ transaction });
  });
  return res.status(204).send();
};

export const createCard = async (req: Request, res: Response): Promise<Response> => {
  const title = String(req.body.title || "").trim();
  if (!title) throw new AppError("Informe o título do card");
  const listId = req.body.listId == null ? null : Number(req.body.listId);
  if (listId && !(await CardList.findByPk(listId))) throw new AppError("Lista não encontrada", 404);
  const card = await Card.create({ title, tag: String(req.body.tag || "").trim() || null, listId, position: Math.floor(Date.now() / 1000), completed: false });
  return res.status(201).json(card);
};

export const updateCard = async (req: Request, res: Response): Promise<Response> => {
  const card = await Card.findByPk(req.params.cardId);
  if (!card) throw new AppError("Card não encontrado", 404);
  const changes: { title?: string; tag?: string | null; listId?: number | null; completed?: boolean; completedAt?: Date | null; position?: number } = {};
  if (req.body.title !== undefined) {
    changes.title = String(req.body.title).trim();
    if (!changes.title) throw new AppError("Informe o título do card");
  }
  if (req.body.tag !== undefined) changes.tag = String(req.body.tag || "").trim() || null;
  if (req.body.listId !== undefined) {
    changes.listId = req.body.listId == null ? null : Number(req.body.listId);
    if (changes.listId && !(await CardList.findByPk(changes.listId))) throw new AppError("Lista não encontrada", 404);
  }
  if (req.body.completed !== undefined) {
    changes.completed = Boolean(req.body.completed);
    if (changes.completed !== card.completed) {
      changes.completedAt = changes.completed ? new Date() : null;
    }
  }
  if (req.body.position !== undefined) changes.position = Number(req.body.position);

  if (card.ticketId && changes.completed && !card.completed) {
    const { ticket, oldStatus } = await UpdateTicketService({
      ticketId: card.ticketId,
      ticketData: { status: "closed" }
    });
    if (oldStatus !== "closed") {
      const whatsapp = await ShowWhatsAppService(ticket.whatsappId);
      if (whatsapp.farewellMessage) {
        await SendWhatsAppMessage({
          body: formatBody(whatsapp.farewellMessage, ticket.contact),
          ticket
        });
      }
    }
    if (oldStatus !== "closed") {
      delete changes.completed;
      delete changes.completedAt;
      await card.reload();
    }
  }
  await card.update(changes);
  return res.json(card);
};

export const createComment = async (req: Request, res: Response): Promise<Response> => {
  const card = await Card.findByPk(req.params.cardId);
  if (!card) throw new AppError("Card não encontrado", 404);
  const body = String(req.body.body || "").trim();
  if (!body) throw new AppError("Escreva um comentário");
  const comment = await CardComment.create({ cardId: card.id, userId: Number(req.user.id), body });
  await comment.reload({ include: [{ model: User, as: "user", attributes: ["id", "name"] }] });
  return res.status(201).json(comment);
};
