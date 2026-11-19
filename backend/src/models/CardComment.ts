import { Table, Column, Model, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, ForeignKey, BelongsTo } from "sequelize-typescript";
import Card from "./Card";
import User from "./User";

@Table
class CardComment extends Model<CardComment> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column body: string;
  @ForeignKey(() => Card) @Column cardId: number;
  @BelongsTo(() => Card) card: Card;
  @ForeignKey(() => User) @Column userId: number;
  @BelongsTo(() => User) user: User;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default CardComment;
