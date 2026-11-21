import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.addColumn("Tickets", "ignoredAt", {
      type: DataTypes.DATE,
      allowNull: true
    }),
  down: (queryInterface: QueryInterface) =>
    queryInterface.removeColumn("Tickets", "ignoredAt")
};
