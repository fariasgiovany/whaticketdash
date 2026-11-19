import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Cards", "completedAt", {
      type: DataTypes.DATE(6),
      allowNull: true
    });
    // Give cards completed before this migration a full retention period.
    await queryInterface.sequelize.query(
      "UPDATE Cards SET completedAt = CURRENT_TIMESTAMP WHERE completed = true"
    );
  },
  down: (queryInterface: QueryInterface) => queryInterface.removeColumn("Cards", "completedAt")
};
