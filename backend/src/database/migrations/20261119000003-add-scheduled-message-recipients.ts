import { DataTypes, QueryInterface, QueryTypes } from "sequelize";

const table = "ScheduledMessages";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn(table, "ticketId", { type: DataTypes.INTEGER, allowNull: true });
    await queryInterface.addColumn(table, "contactId", {
      type: DataTypes.INTEGER, allowNull: true, references: { model: "Contacts", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE"
    });
    await queryInterface.addColumn(table, "whatsappId", {
      type: DataTypes.INTEGER, allowNull: true, references: { model: "Whatsapps", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE"
    });
  },
  down: async (queryInterface: QueryInterface) => {
    const quote = (name: string) => queryInterface.quoteIdentifier(name, true);
    const contactSchedules = await queryInterface.sequelize.query(
      `SELECT ${quote("id")} FROM ${quote(table)} WHERE ${quote("ticketId")} IS NULL LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (contactSchedules.length) throw new Error("Cannot roll back while contact schedules exist");
    await queryInterface.changeColumn(table, "ticketId", { type: DataTypes.INTEGER, allowNull: false });
    await queryInterface.removeColumn(table, "whatsappId");
    await queryInterface.removeColumn(table, "contactId");
  }
};
