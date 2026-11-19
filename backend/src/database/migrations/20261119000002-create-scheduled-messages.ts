import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ScheduledMessages", {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Tickets", key: "id" }, onDelete: "CASCADE", onUpdate: "CASCADE" },
      userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "Users", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      body: { type: DataTypes.TEXT, allowNull: false },
      scheduledAt: { type: DataTypes.DATE(3), allowNull: false },
      sentAt: { type: DataTypes.DATE(3), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false },
      attachmentName: { type: DataTypes.STRING, allowNull: true },
      attachmentType: { type: DataTypes.STRING, allowNull: true },
      attachment: { type: DataTypes.BLOB("long"), allowNull: true },
      errorMessage: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE(3), allowNull: false },
      updatedAt: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex("ScheduledMessages", ["status", "scheduledAt", "id"], { name: "scheduled_messages_dispatch" });

    await queryInterface.createTable("ScheduledMessageQueues", {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
      activeMessageId: { type: DataTypes.INTEGER, allowNull: true },
      availableAt: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.bulkInsert("ScheduledMessageQueues", [{ id: 1, activeMessageId: null, availableAt: new Date() }]);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ScheduledMessageQueues");
    await queryInterface.dropTable("ScheduledMessages");
  }
};
