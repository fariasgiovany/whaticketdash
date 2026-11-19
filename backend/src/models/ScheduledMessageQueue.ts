import { Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";

@Table({ timestamps: false })
class ScheduledMessageQueue extends Model<ScheduledMessageQueue> {
  @PrimaryKey @Column id: number;
  @Column(DataType.INTEGER) activeMessageId: number | null;
  @Column(DataType.DATE(3)) availableAt: Date;
}

export default ScheduledMessageQueue;
