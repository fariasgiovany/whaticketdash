import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.addColumn("Tickets", "closedAt", {
      type: DataTypes.DATE(6),
      allowNull: true
    }),
  down: (queryInterface: QueryInterface) =>
    queryInterface.removeColumn("Tickets", "closedAt")
};
