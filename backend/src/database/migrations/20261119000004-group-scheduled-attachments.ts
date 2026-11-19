import { DataTypes, QueryInterface } from "sequelize";

const table = "ScheduledMessages";
const batchIndex = "scheduled_messages_batch";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn(table, "batchId", { type: DataTypes.STRING(36), allowNull: true });
    await queryInterface.addIndex(table, ["batchId", "status"], { name: batchIndex });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(table, batchIndex);
    await queryInterface.removeColumn(table, "batchId");
  }
};
