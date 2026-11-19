import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";
import Whatsapp from "./Whatsapp";

export type ScheduledMessageStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

@Table
class ScheduledMessage extends Model<ScheduledMessage> {
  @ForeignKey(() => Ticket) @Column(DataType.INTEGER) ticketId: number | null;
  @BelongsTo(() => Ticket) ticket: Ticket;
  @ForeignKey(() => Contact) @Column(DataType.INTEGER) contactId: number | null;
  @BelongsTo(() => Contact) contact: Contact;
  @ForeignKey(() => Whatsapp) @Column(DataType.INTEGER) whatsappId: number | null;
  @BelongsTo(() => Whatsapp) whatsapp: Whatsapp;
  @ForeignKey(() => User) @Column(DataType.INTEGER) userId: number | null;
  @Column(DataType.STRING(36)) batchId: string | null;
  @Column(DataType.TEXT) body: string;
  @Column(DataType.DATE(3)) scheduledAt: Date;
  @Column(DataType.DATE(3)) sentAt: Date | null;
  @Column(DataType.STRING) status: ScheduledMessageStatus;
  @Column(DataType.STRING) attachmentName: string | null;
  @Column(DataType.STRING) attachmentType: string | null;
  @Column(DataType.BLOB("long")) attachment: Buffer | null;
  @Column(DataType.STRING) errorMessage: string | null;
}

export default ScheduledMessage;
