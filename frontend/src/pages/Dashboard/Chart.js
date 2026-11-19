import React from "react";
import { useHistory } from "react-router-dom";
import { useTheme } from "@material-ui/core/styles";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const Chart = ({ data }) => {
  const theme = useTheme();
  const history = useHistory();
  const openDay = (point, field) => {
    if (point?.day) history.push(`/tickets?${field === "closed" ? "closedDate" : "date"}=${point.day}`);
  };

  return <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -20 }}>
      <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="day" tickFormatter={value => value.slice(5).split("-").reverse().join("/")} stroke={theme.palette.text.secondary} />
      <YAxis allowDecimals={false} stroke={theme.palette.text.secondary} />
      <Tooltip contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, color: theme.palette.text.primary }} />
      <Legend />
      <Bar dataKey="created" name="Criados" fill={theme.palette.secondary.main} radius={[4, 4, 0, 0]} onClick={point => openDay(point.payload, "created")} cursor="pointer" />
      <Bar dataKey="closed" name="Concluídos" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} onClick={point => openDay(point.payload, "closed")} cursor="pointer" />
    </BarChart>
  </ResponsiveContainer>;
};

export default Chart;
