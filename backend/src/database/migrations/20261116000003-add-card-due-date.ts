import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => queryInterface.addColumn("Cards", "dueDate", {
    type: DataTypes.DATEONLY,
    allowNull: true
  }),
  down: (queryInterface: QueryInterface) => queryInterface.removeColumn("Cards", "dueDate")
};
