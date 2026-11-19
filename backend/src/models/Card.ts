import { Table, Column, Model, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, ForeignKey, BelongsTo, HasMany, Default } from "sequelize-typescript";
import CardList from "./CardList";
import CardComment from "./CardComment";
import Ticket from "./Ticket";

@Table
class Card extends Model<Card> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column title: string;
  @Column tag: string;
  @Default(0) @Column position: number;
  @Default(false) @Column completed: boolean;
  @Column completedAt: Date;
  @ForeignKey(() => Ticket) @Column ticketId: number;
  @BelongsTo(() => Ticket) ticket: Ticket;
  @ForeignKey(() => CardList) @Column listId: number;
  @BelongsTo(() => CardList) list: CardList;
  @HasMany(() => CardComment) comments: CardComment[];
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default Card;
