import { randomUUID } from "crypto";
import { Request, Response } from "express";
import path from "path";
import { Op } from "sequelize";
import db from "../database";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import ScheduledMessage from "../models/ScheduledMessage";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

const pageSize = 30;
const metadata = ["id", "body", "scheduledAt", "sentAt", "status", "attachmentName", "errorMessage"];
const recipientDetails = () => [
  { model: Contact, as: "contact", attributes: ["name", "number"] },
  { model: Whatsapp, as: "whatsapp", attributes: ["name"] }
];

const availableConnections = async (userId: string) => {
  const user = await User.findByPk(userId, { attributes: ["id", "profile", "whatsappId"] });
  if (!user) throw new AppError("Usuário não encontrado.", 403);
  return Whatsapp.findAll({
    where: user.profile === "admin" ? undefined : user.whatsappId ? { id: user.whatsappId } : { isDefault: true },
    attributes: ["id", "name", "status"],
    order: [["isDefault", "DESC"], ["id", "ASC"]]
  });
};

const parseDate = (value: unknown): Date => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new AppError("Informe a data e hora do envio em GMT−3.");
  }
  const date = new Date(`${value}:00-03:00`);
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() - 3 * 3600000).toISOString().slice(0, 16) !== value || date.getTime() <= Date.now()) {
    throw new AppError("Informe uma data e hora futuras em GMT−3.");
  }
  return date;
};

export const contacts = async (req: Request, res: Response): Promise<Response> => {
  const term = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const found = await Contact.findAll({
    where: {
      number: { [Op.ne]: "" },
      ...(term ? { [Op.or]: [{ name: { [Op.like]: `%${term}%` } }, { number: { [Op.like]: `%${term}%` } }] } : {})
    },
    attributes: ["id", "name", "number"],
    limit: 20,
    order: [["name", "ASC"], ["id", "ASC"]]
  });
  return res.json(found);
};

export const connections = async (req: Request, res: Response): Promise<Response> =>
  res.json(await availableConnections(req.user.id));

export const index = async (req: Request, res: Response): Promise<Response> => {
  const history = req.query.history === "true";
  const inputPage = Number(req.query.page);
  const page = Number.isSafeInteger(inputPage) && inputPage > 0 && inputPage <= 1000000 ? inputPage : 1;
  const { rows, count } = await ScheduledMessage.findAndCountAll({
    attributes: metadata,
    where: {
      ...(req.user.profile !== "admin" ? { userId: Number(req.user.id) } : {}),
      status: { [Op.in]: history ? ["sent", "failed", "cancelled"] : ["queued", "sending"] }
    },
    include: [...recipientDetails(), { model: Ticket, as: "ticket", attributes: ["id"], include: recipientDetails() }],
    order: history ? [["updatedAt", "DESC"], ["id", "DESC"]] : [["scheduledAt", "ASC"], ["id", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  return res.json({ messages: rows, hasMore: count > page * pageSize });
};

export const create = async (req: Request, res: Response): Promise<Response> => {
  const contactId = Number(req.body.contactId);
  const whatsappId = Number(req.body.whatsappId);
  if (!Number.isSafeInteger(contactId) || contactId <= 0) throw new AppError("Selecione um contato.");
  if (!Number.isSafeInteger(whatsappId) || whatsappId <= 0) throw new AppError("Selecione uma conexão de WhatsApp.");
  const scheduledAt = parseDate(req.body.scheduledAt);
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!body && !files.length) throw new AppError("Escreva uma mensagem ou adicione um arquivo.");
  if (body.length > 4000) throw new AppError("A mensagem pode ter até 4.000 caracteres.");
  if (files.some(file => !file.size)) throw new AppError("Os arquivos precisam ter conteúdo.");
  if (files.reduce((bytes, file) => bytes + file.size, 0) > 18 * 1024 * 1024) {
    throw new AppError("Os anexos podem somar até 18 MB.");
  }
  const [contact, connections] = await Promise.all([
    Contact.findOne({ where: { id: contactId, number: { [Op.ne]: "" } }, attributes: ["id"] }),
    availableConnections(req.user.id)
  ]);
  if (!contact) throw new AppError("Contato indisponível para agendamento.", 404);
  if (!connections.some(connection => connection.id === whatsappId)) throw new AppError("Conexão indisponível para agendamento.", 404);

  const entries = files.length ? files.map((file, index) => ({
    body: index === 0 ? body : "",
    attachmentName: path.win32.basename(file.originalname).replace(/[\x00-\x1F\x7F]/g, "").slice(0, 255) || "arquivo",
    attachmentType: file.mimetype.slice(0, 255),
    attachment: file.buffer
  })) : [{ body }];
  const batchId = entries.length > 1 ? randomUUID() : null;

  const ids = await db.transaction(async transaction => {
    const created: number[] = [];
    for (const entry of entries) {
      const message = await ScheduledMessage.create({ ...entry, batchId, contactId, whatsappId, userId: Number(req.user.id), scheduledAt, status: "queued" }, { transaction });
      created.push(message.id);
    }
    return created;
  });
  return res.status(201).json({ ids });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("Agendamento inválido.");
  const access = { id, ...(req.user.profile !== "admin" ? { userId: Number(req.user.id) } : {}) };
  const [count] = await ScheduledMessage.update({ status: "cancelled", attachment: null }, { where: { ...access, status: "queued" } });
  if (!count) {
    const message = await ScheduledMessage.findOne({ where: access, attributes: ["id", "status"] });
    if (!message) throw new AppError("Agendamento não encontrado.", 404);
    if (message.status !== "cancelled") throw new AppError("Só é possível cancelar envios que ainda estão na fila.", 409);
  }
  return res.status(204).send();
};
