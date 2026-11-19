import React, { useEffect, useRef, useState } from "react";
import {
  Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, InputAdornment, MenuItem, Paper, Tab, Tabs, TextField, Typography,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { Add, AttachFile, DateRange } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3, 0) },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1), marginBottom: theme.spacing(2) },
  panel: { background: theme.palette.cards.background, borderRadius: theme.borderRadius.medium },
  row: { padding: theme.spacing(2), display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: theme.spacing(1) },
  details: { flex: "1 1 240px", minWidth: 0, overflowWrap: "anywhere" },
  recipient: { fontWeight: 700 },
  message: { whiteSpace: "pre-wrap", marginTop: theme.spacing(0.5) },
  actions: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1) },
  fields: { display: "flex", flexDirection: "column", gap: theme.spacing(2), paddingTop: theme.spacing(1) },
  timing: { display: "flex", flexWrap: "wrap", gap: theme.spacing(1.5) },
  dateField: { flex: "1 1 170px", position: "relative" },
  calendarInput: { position: "absolute", bottom: 0, left: 0, width: "100%", opacity: 0, pointerEvents: "none" },
  timeField: { flex: "1 1 120px" },
  pagination: { display: "flex", justifyContent: "flex-end", alignItems: "center", padding: theme.spacing(1), gap: theme.spacing(1) },
}));

const statusLabels = {
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falhou",
  cancelled: "Cancelada",
};
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Etc/GMT+3", hourCycle: "h23",
});
const megabyte = 1024 * 1024;
const dayLength = 86400000;
const gmtOffset = 3 * 3600000;
const brazilianDate = isoDate => isoDate.split("-").reverse().join("/");
const todayInGmtMinus3 = (now = Date.now()) => brazilianDate(new Date(now - gmtOffset).toISOString().slice(0, 10));

const isoDateFromInput = value => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "";
  const isoDate = value.split("/").reverse().join("-");
  const date = new Date(`${isoDate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === isoDate ? isoDate : "";
};

function ScheduleModal({ onClose, onCreated }) {
  const classes = useStyles();
  const fileInput = useRef(null);
  const calendar = useRef(null);
  const [contact, setContact] = useState(null);
  const [connections, setConnections] = useState(null);
  const [whatsappId, setWhatsappId] = useState("");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [today, setToday] = useState(() => todayInGmtMinus3());
  const [editedDate, setEditedDate] = useState(null);
  const [time, setTime] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const date = editedDate ?? today;
  const isoDate = isoDateFromInput(date);
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  const scheduledAt = isoDate && validTime ? `${isoDate}T${time}` : "";
  const hasCalendar = typeof HTMLInputElement !== "undefined" && typeof HTMLInputElement.prototype.showPicker === "function";

  useEffect(() => {
    let timer;
    const refreshToday = () => {
      clearTimeout(timer);
      const now = Date.now();
      setToday(todayInGmtMinus3(now));
      const untilMidnight = dayLength - (now - gmtOffset) % dayLength;
      timer = setTimeout(refreshToday, untilMidnight);
    };
    refreshToday();
    window.addEventListener("focus", refreshToday);
    window.addEventListener("pageshow", refreshToday);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshToday);
      window.removeEventListener("pageshow", refreshToday);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/scheduled-messages/contacts", { params: { search } });
        if (active) setSuggestions(data);
      } catch (error) {
        if (active) toastError(error);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    let active = true;
    api.get("/scheduled-messages/connections").then(({ data }) => {
      if (!active) return;
      setConnections(data);
      setWhatsappId(data.find(connection => connection.status === "CONNECTED")?.id || data[0]?.id || "");
    }).catch(error => {
      if (!active) return;
      toastError(error);
      setConnections([]);
    });
    return () => { active = false; };
  }, []);

  const chooseFiles = event => {
    const selected = Array.from(event.target.files);
    const invalid = selected.length > 5 || selected.some(file => !file.size || file.size > 10 * megabyte)
      || selected.reduce((sum, file) => sum + file.size, 0) > 18 * megabyte;
    setFileError(invalid ? "Escolha até 5 arquivos com conteúdo, no máximo 10 MB por arquivo e 18 MB no total." : "");
    setFiles(invalid ? [] : selected);
    if (invalid) event.target.value = "";
  };

  const submit = async event => {
    event.preventDefault();
    if (saving || !contact || !whatsappId || !scheduledAt || (!body.trim() && !files.length) || fileError) return;
    const payload = new FormData();
    payload.append("contactId", contact.id);
    payload.append("whatsappId", whatsappId);
    payload.append("scheduledAt", scheduledAt);
    payload.append("body", body);
    files.forEach(file => payload.append("medias", file));
    setSaving(true);
    try {
      await api.post("/scheduled-messages", payload);
      onCreated();
    } catch (error) {
      toastError(error);
      setSaving(false);
    }
  };

  return <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="schedule-title">
    <form onSubmit={submit}>
      <DialogTitle id="schedule-title">Agendar mensagem</DialogTitle>
      <DialogContent>
        <div className={classes.fields}>
          <Autocomplete
            value={contact}
            options={suggestions}
            loading={searching}
            loadingText="Buscando contatos…"
            noOptionsText="Nenhum contato com número de WhatsApp"
            disabled={saving}
            filterOptions={options => options}
            getOptionSelected={(option, value) => option.id === value.id}
            getOptionLabel={option => `${option.name} · ${option.number}`}
            onChange={(_, option) => setContact(option)}
            onInputChange={(_, value, reason) => { if (reason !== "reset") setSearch(value); }}
            renderInput={params => <TextField {...params} label="Contato" placeholder="Busque por nome ou número" variant="outlined" />}
          />
          <TextField id="schedule-connection" select required label="Conexão de WhatsApp" variant="outlined" value={whatsappId}
            onChange={event => setWhatsappId(event.target.value)} disabled={saving || !connections?.length}
            helperText={!connections ? "Carregando conexões…" : !connections.length ? "Nenhuma conexão disponível." : undefined}>
            {(connections || []).map(connection => <MenuItem key={connection.id} value={connection.id}>
              {connection.name}{connection.status !== "CONNECTED" && " (offline)"}
            </MenuItem>)}
          </TextField>
          <div className={classes.timing}>
            <div className={classes.dateField}>
              <TextField id="schedule-date" fullWidth required label="Data (GMT−3)" placeholder="dd/mm/aaaa" variant="outlined" value={date}
                onChange={event => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
                  setEditedDate([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/"));
                }} inputProps={{ inputMode: "numeric", maxLength: 10 }} InputLabelProps={{ shrink: true }} disabled={saving}
                error={date.length === 10 && !isoDate} helperText={date.length === 10 && !isoDate ? "Informe uma data válida." : undefined}
                InputProps={hasCalendar ? { endAdornment: <InputAdornment position="end">
                  <IconButton size="small" aria-label="Abrir calendário" disabled={saving} onClick={() => calendar.current.showPicker()}><DateRange /></IconButton>
                </InputAdornment> } : undefined} />
              {hasCalendar && <input ref={calendar} type="date" className={classes.calendarInput} aria-hidden="true" tabIndex={-1}
                value={isoDate} onChange={event => setEditedDate(brazilianDate(event.target.value))} disabled={saving} />}
            </div>
            <TextField id="schedule-time" className={classes.timeField} required label="Horário (24h)" placeholder="HH:MM" variant="outlined" value={time}
              onChange={event => {
                const digits = event.target.value.replace(/^(\d):/, "0$1:").replace(/\D/g, "").slice(0, 4);
                setTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
              }} error={time.length === 5 && !validTime} helperText={time.length === 5 && !validTime ? "Use um horário de 00:00 a 23:59." : undefined}
              inputProps={{ inputMode: "numeric", maxLength: 5 }} InputLabelProps={{ shrink: true }} disabled={saving} />
          </div>
          <TextField id="schedule-body" label="Mensagem" variant="outlined" multiline minRows={3} value={body}
            onChange={event => setBody(event.target.value)} inputProps={{ maxLength: 4000 }} disabled={saving} />
          <div>
            <div className={classes.actions}>
              <Button type="button" variant="outlined" startIcon={<AttachFile />} disabled={saving} onClick={() => fileInput.current.click()}>Anexar arquivos</Button>
              <input ref={fileInput} type="file" multiple hidden aria-label="Arquivos da mensagem" onChange={chooseFiles} disabled={saving} />
              {(files.length > 0 || fileError) && <Button type="button" disabled={saving} onClick={() => {
                fileInput.current.value = "";
                setFiles([]);
                setFileError("");
              }}>Limpar anexos</Button>}
            </div>
            <Typography variant="caption" color={fileError ? "error" : "textSecondary"} component="p">
              {fileError || "Até 5 arquivos, 10 MB por arquivo e 18 MB no total."}
            </Typography>
            {files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}</ul>}
            {files.length > 1 && body.trim() && <Typography variant="caption" color="textSecondary">O texto vai como legenda do primeiro arquivo.</Typography>}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose} disabled={saving}>Fechar</Button>
        <Button type="submit" variant="contained" color="primary" disabled={saving || !contact || !whatsappId || !scheduledAt || (!body.trim() && !files.length) || Boolean(fileError)}>
          {saving ? "Agendando…" : "Agendar"}
        </Button>
      </DialogActions>
    </form>
  </Dialog>;
}

export default function ScheduledMessages() {
  const classes = useStyles();
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => setRevision(value => value + 1);

  useEffect(() => {
    let active = true;
    let timer;
    const load = async () => {
      try {
        const { data } = await api.get("/scheduled-messages", { params: { history, page } });
        if (!active) return;
        setResult(data);
        setLoadError(false);
        if (page > 1 && !data.messages.length) setPage(page - 1);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) timer = setTimeout(load, 5000);
      }
    };
    setResult(null);
    setLoadError(false);
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [history, page, revision]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.delete(`/scheduled-messages/${cancelling.id}`);
      setCancelling(null);
    } catch (error) {
      toastError(error);
      setCancelling(null);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return <div className={classes.root}><Container maxWidth="lg">
    <div className={classes.header}>
      <div>
        <Typography variant="h5">Agendamentos</Typography>
        <Typography variant="body2" color="textSecondary">Horários em GMT−3. Agendamentos próximos são espaçados de 10 a 15 segundos.</Typography>
      </div>
      <Button color="primary" variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>Agendar mensagem</Button>
    </div>
    <Paper className={classes.panel}>
      <Tabs value={history ? 1 : 0} onChange={(_, value) => { setHistory(value === 1); setPage(1); }} indicatorColor="primary" textColor="primary">
        <Tab label="Fila" /><Tab label="Histórico" />
      </Tabs>
      <Divider />
      {loadError && <div className={classes.row}><Typography color="error">Não foi possível atualizar os agendamentos.</Typography><Button onClick={refresh}>Tentar novamente</Button></div>}
      {!result && !loadError && <div className={classes.row}><CircularProgress size={24} aria-label="Carregando agendamentos" /></div>}
      {result?.messages.length === 0 && <Typography className={classes.row} color="textSecondary">{history ? "O histórico está vazio." : "Nenhuma mensagem na fila."}</Typography>}
      {result?.messages.map(message => {
        const contact = message.contact || message.ticket?.contact;
        const connection = message.whatsapp || message.ticket?.whatsapp;
        return <React.Fragment key={message.id}>
          <div className={classes.row}>
            <div className={classes.details}>
              <Typography className={classes.recipient}>{contact?.name || contact?.number || "Contato indisponível"}</Typography>
              {(contact?.number || connection?.name) && <Typography display="block" variant="caption" color="textSecondary">
                {[contact?.number, connection?.name].filter(Boolean).join(" · ")}
              </Typography>}
              <Typography display="block" variant="caption" color="textSecondary">
                Agendada para {dateFormatter.format(new Date(message.scheduledAt))}
                {message.sentAt && ` · Enviada em ${dateFormatter.format(new Date(message.sentAt))}`}
              </Typography>
              {message.body && <Typography variant="body2" className={classes.message}>{message.body}</Typography>}
              {message.attachmentName && <Typography display="block" variant="caption">Anexo: {message.attachmentName}</Typography>}
              {message.errorMessage && <Typography variant="caption" color="error">{message.errorMessage}</Typography>}
            </div>
            <div className={classes.actions}>
              <Chip size="small" color={message.status === "sent" ? "primary" : "default"} label={statusLabels[message.status]} />
              {message.status === "queued" && <Button size="small" onClick={() => setCancelling(message)}>Cancelar envio</Button>}
            </div>
          </div>
          <Divider />
        </React.Fragment>;
      })}
      {(page > 1 || result?.hasMore) && <div className={classes.pagination}>
        <Button onClick={() => setPage(page - 1)} disabled={page === 1}>Anterior</Button>
        <Typography variant="body2">Página {page}</Typography>
        <Button onClick={() => setPage(page + 1)} disabled={!result?.hasMore}>Próxima</Button>
      </div>}
    </Paper>
    {creating && <ScheduleModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setHistory(false); setPage(1); refresh(); }} />}
    <Dialog open={Boolean(cancelling)} onClose={busy ? undefined : () => setCancelling(null)} aria-labelledby="cancel-schedule-title">
      <DialogTitle id="cancel-schedule-title">Cancelar este envio?</DialogTitle>
      <DialogContent>O agendamento será movido da fila para o histórico.</DialogContent>
      <DialogActions>
        <Button onClick={() => setCancelling(null)} disabled={busy}>Voltar</Button>
        <Button onClick={cancel} color="secondary" disabled={busy}>Cancelar envio</Button>
      </DialogActions>
    </Dialog>
  </Container></div>;
}
