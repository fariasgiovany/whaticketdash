import { Table, Column, Model, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, HasMany } from "sequelize-typescript";
import Card from "./Card";

@Table
class CardList extends Model<CardList> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column name: string;
  @Column position: number;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
  @HasMany(() => Card) cards: Card[];
}

export default CardList;
