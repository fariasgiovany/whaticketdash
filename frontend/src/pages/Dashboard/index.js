import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Button, Chip, CircularProgress, Container, Grid, MenuItem, Paper, TextField, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import openSocket from "../../services/socket-io";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import Chart from "./Chart";

const useStyles = makeStyles(theme => ({
  root: { minHeight: "100%", padding: theme.spacing(3, 0), background: theme.palette.background.default },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing(2), flexWrap: "wrap", marginBottom: theme.spacing(3) },
  filters: { display: "flex", flexWrap: "wrap", gap: theme.spacing(1), marginBottom: theme.spacing(3) },
  filter: { minWidth: 145, flex: "1 1 145px" },
  panel: { height: "100%", padding: theme.spacing(2.5), border: theme.border.divider, borderRadius: theme.borderRadius.medium, background: theme.palette.cards.background },
  metric: { minHeight: 130, display: "flex", flexDirection: "column", justifyContent: "space-between" },
  metricValue: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.15, color: theme.palette.text.primary },
  sectionTitle: { fontWeight: 700, marginBottom: theme.spacing(1) },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1), padding: theme.spacing(1.25, 0), borderBottom: theme.border.divider, cursor: "pointer", "&:last-child": { borderBottom: 0 } },
  rowName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  empty: { padding: theme.spacing(2, 0), color: theme.palette.text.secondary },
  chartHint: { color: theme.palette.text.secondary, marginBottom: theme.spacing(1) },
}));

const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseLocalDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDate(date) === value ? date : null;
};
const periodDates = (period, customStart, customEnd) => {
  const now = new Date();
  if (period === "custom") {
    const start = parseLocalDate(customStart);
    const end = parseLocalDate(customEnd);
    if (!start || !end) return { error: "Informe a data inicial e a final." };
    if (start > end) return { error: "A data inicial deve ser anterior ou igual à final." };
    if (end > now) return { error: "A data final não pode estar no futuro." };
    if (end.getTime() - start.getTime() > 365 * 86400000) return { error: "Selecione no máximo 366 dias." };
    return { since: start.toISOString(), until: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).toISOString() };
  }
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    since: new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1).toISOString(),
    until: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(),
  };
};
const duration = minutes => minutes == null ? "—" : minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
const age = date => {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return days >= 1 ? `${days} d` : `${Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))} min`;
};

const Dashboard = () => {
  const classes = useStyles();
  const history = useHistory();
  const [period, setPeriod] = useState("today");
  const [customStart, setCustomStart] = useState(() => localDate(new Date()));
  const [customEnd, setCustomEnd] = useState(() => localDate(new Date()));
  const [queueId, setQueueId] = useState("");
  const [userId, setUserId] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const rangeError = periodDates(period, customStart, customEnd).error;
  const load = useCallback(async () => {
    const { error, ...dates } = periodDates(period, customStart, customEnd);
    if (error) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await api.get("/dashboard", {
        params: { ...dates, queueId, userId, whatsappId, offset: new Date().getTimezoneOffset() }
      });
      setData(response.data);
    } catch (error) { toastError(error); }
    finally { setLoading(false); }
  }, [period, customStart, customEnd, queueId, userId, whatsappId]);

  useEffect(() => { load(); }, [load, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setRefresh(value => value + 1), 30000);
    const socket = openSocket();
    const update = () => setRefresh(value => value + 1);
    socket.on("ticket", update);
    socket.on("appMessage", update);
    socket.on("whatsappSession", update);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, []);

  const summary = data?.summary || {};
  const metrics = [
    { label: "Em atendimento", value: summary.open, detail: "Tickets abertos agora", target: "/tickets?status=open" },
    { label: "Aguardando", value: summary.pending, detail: "Precisam de atendimento agora", target: "/tickets?status=pending" },
    { label: "Não lidos", value: summary.unread, detail: "Com novas mensagens", target: "/tickets?unread=1" },
    { label: "Concluídos", value: summary.closedInPeriod, detail: "Fechados no período", target: "/tickets?status=closed" },
    { label: "Primeira resposta", value: duration(summary.firstReplyMinutes), detail: "Média dos tickets respondidos" },
    { label: "Resolução", value: duration(summary.resolutionMinutes), detail: "Média dos fechados com horário registrado" },
  ];

  return <div className={classes.root}><Container maxWidth="xl">
    <div className={classes.header}>
      <div><Typography variant="h4">Visão geral</Typography><Typography color="textSecondary">Atendimento e atividades da Comptabilite</Typography></div>
      <Button variant="outlined" onClick={load} disabled={loading || Boolean(rangeError)}>Atualizar</Button>
    </div>
    <div className={classes.filters}>
      <TextField className={classes.filter} select size="small" variant="outlined" label="Período" value={period} onChange={event => setPeriod(event.target.value)}>
        <MenuItem value="today">Hoje</MenuItem><MenuItem value="7d">Últimos 7 dias</MenuItem><MenuItem value="30d">Últimos 30 dias</MenuItem><MenuItem value="custom">Personalizado</MenuItem>
      </TextField>
      {period === "custom" && <>
        <TextField className={classes.filter} size="small" variant="outlined" label="Data inicial" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: localDate(new Date()) }} error={Boolean(rangeError)} />
        <TextField className={classes.filter} size="small" variant="outlined" label="Data final" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: localDate(new Date()) }} error={Boolean(rangeError)} />
      </>}
      <TextField className={classes.filter} select size="small" variant="outlined" label="Fila" value={queueId} onChange={event => setQueueId(event.target.value)}>
        <MenuItem value="">Todas as filas</MenuItem>{data?.filters.queues.map(queue => <MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>)}
      </TextField>
      <TextField className={classes.filter} select size="small" variant="outlined" label="Atendente" value={userId} onChange={event => setUserId(event.target.value)}>
        <MenuItem value="">Todos os atendentes</MenuItem>{data?.filters.users.map(user => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
      </TextField>
      <TextField className={classes.filter} select size="small" variant="outlined" label="Conexão" value={whatsappId} onChange={event => setWhatsappId(event.target.value)}>
        <MenuItem value="">Todas as conexões</MenuItem>{data?.filters.whatsapps.map(whatsapp => <MenuItem key={whatsapp.id} value={whatsapp.id}>{whatsapp.name}</MenuItem>)}
      </TextField>
    </div>
    {rangeError && <Typography color="error" variant="body2" component="p">{rangeError}</Typography>}
    <Typography variant="caption" color="textSecondary" component="p" style={{ marginTop: -16, marginBottom: 20 }}>
      Em atendimento, aguardando e não lidos mostram a situação atual. O período filtra os tickets criados ou concluídos, os tempos e o gráfico.
    </Typography>
    {rangeError ? null : loading && !data ? <CircularProgress /> : <Grid container spacing={2}>
      {metrics.map(metric => <Grid item xs={12} sm={6} md={4} lg={2} key={metric.label}>
        <Paper className={`${classes.panel} ${classes.metric}`} onClick={() => metric.target && history.push(metric.target)} style={{ cursor: metric.target ? "pointer" : "default" }}>
          <Typography color="textSecondary" variant="body2">{metric.label}</Typography>
          <Typography className={classes.metricValue}>{metric.value ?? "—"}</Typography>
          <Typography color="textSecondary" variant="caption">{metric.detail}</Typography>
        </Paper>
      </Grid>)}
      <Grid item xs={12} md={8}><Paper className={classes.panel}>
        <Typography variant="h6" className={classes.sectionTitle}>Movimento de tickets</Typography>
        <Typography variant="caption" className={classes.chartHint}>Clique em uma barra para abrir os tickets do dia.</Typography>
        <Chart data={data?.timeline || []} />
      </Paper></Grid>
      <Grid item xs={12} md={4}><Paper className={classes.panel}>
        <Typography variant="h6" className={classes.sectionTitle}>Precisam de atenção</Typography>
        {data?.urgent.length ? data.urgent.map(ticket => <div key={ticket.id} className={classes.row} onClick={() => history.push(`/tickets/${ticket.id}`)}>
          <span className={classes.rowName}>{ticket.name}</span>
          <Chip size="small" color={ticket.unreadMessages ? "primary" : "default"} label={ticket.unreadMessages ? `${ticket.unreadMessages} não lidas` : `Aguarda ${age(ticket.createdAt)}`} />
        </div>) : <Typography className={classes.empty}>Nenhum ticket pendente ou com mensagens não lidas.</Typography>}
      </Paper></Grid>
      <Grid item xs={12} md={6}><Paper className={classes.panel}>
        <Typography variant="h6" className={classes.sectionTitle}>Cards</Typography>
        <Typography variant="body2" color="textSecondary">{summary.staleCards || 0} em aberto há mais de 7 dias · {summary.completedCards || 0} concluídos no período</Typography>
        {data?.cards.map(card => <div key={card.id} className={classes.row} onClick={() => history.push("/cards")}><span className={classes.rowName}>{card.title}</span><Chip size="small" label={age(card.createdAt)} /></div>)}
        <Button color="primary" onClick={() => history.push("/cards")}>Abrir quadro</Button>
      </Paper></Grid>
      <Grid item xs={12} md={6}><Paper className={classes.panel}>
        <Typography variant="h6" className={classes.sectionTitle}>Conexões WhatsApp</Typography>
        {data?.connections.length ? data.connections.map(connection => <div key={connection.id} className={classes.row} onClick={() => history.push("/connections")}>
          <span className={classes.rowName}>{connection.name}</span><Chip size="small" color={connection.status === "CONNECTED" ? "default" : "primary"} label={connection.status === "CONNECTED" ? "Conectado" : connection.status === "qrcode" ? "Ler QR code" : "Desconectado"} />
        </div>) : <Typography className={classes.empty}>Nenhuma conexão cadastrada.</Typography>}
        <Button color="primary" onClick={() => history.push("/connections")}>Ver conexões</Button>
      </Paper></Grid>
    </Grid>}
  </Container></div>;
};

export default Dashboard;
