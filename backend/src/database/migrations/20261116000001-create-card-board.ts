import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CardLists", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
    await queryInterface.createTable("Cards", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING, allowNull: false },
      tag: { type: DataTypes.STRING, allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ticketId: { type: DataTypes.INTEGER, allowNull: true, unique: true, references: { model: "Tickets", key: "id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
      listId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "CardLists", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
    await queryInterface.createTable("CardComments", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      cardId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Cards", key: "id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
      userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "Users", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CardComments");
    await queryInterface.dropTable("Cards");
    await queryInterface.dropTable("CardLists");
  }
};
