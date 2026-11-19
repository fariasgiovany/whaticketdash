import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Tab, Tabs, TextField, Tooltip, Typography } from "@material-ui/core";
import { Add, ChatBubbleOutline, CheckCircleOutline, DeleteOutline, OpenInNew, Replay } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3), minHeight: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", background: theme.palette.background.default },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" },
  board: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", paddingBottom: 16 },
  column: { width: 300, maxWidth: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: 12, background: theme.palette.action.hover, borderRadius: 10 },
  columnHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cards: { minHeight: 40 },
  card: { padding: 12, marginBottom: 8, cursor: "pointer", borderRadius: 8, boxShadow: theme.shadows[1], "&:hover": { boxShadow: theme.shadows[3] } },
  cardFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  dialogFields: { display: "flex", flexDirection: "column", gap: 16, minWidth: 360, paddingTop: 8 },
  comments: { marginTop: 12, display: "flex", flexDirection: "column", gap: 8 },
  comment: { padding: 10, background: theme.palette.action.hover, borderRadius: 8 },
}));

const Cards = () => {
  const classes = useStyles();
  const history = useHistory();
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newListName, setNewListName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/cards");
      setLists(data.lists);
      setCards(data.cards);
      setSelected(current => current ? data.cards.find(card => card.id === current.id) || null : null);
    } catch (err) { toastError(err); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async task => {
    setBusy(true);
    try { await task(); await load(); } catch (err) { toastError(err); }
    finally { setBusy(false); }
  };

  const createCard = listId => {
    const title = newTitle.trim();
    if (!title) return;
    run(async () => { await api.post("/cards", { title, listId }); setNewTitle(""); setSelected(null); });
  };
  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    run(async () => { await api.post("/card-lists", { name }); setNewListName(""); });
  };
  const deleteList = () => {
    if (!listToDelete) return;
    run(async () => { await api.delete(`/card-lists/${listToDelete.id}`); setListToDelete(null); });
  };
  const updateCard = changes => run(() => api.put(`/cards/${selected.id}`, changes));
  const addComment = () => {
    const body = comment.trim();
    if (!body) return;
    run(async () => { await api.post(`/cards/${selected.id}/comments`, { body }); setComment(""); });
  };
  const moveCard = (event, listId) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/plain"));
    if (id) run(() => api.put(`/cards/${id}`, { listId, position: Math.floor(Date.now() / 1000) }));
  };

  const columns = [{ id: null, name: "Tickets" }, ...lists];
  return <div className={classes.root}>
    <div className={classes.header}>
      <Typography variant="h5">Cards</Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} indicatorColor="primary" textColor="primary">
        <Tab label="Em andamento" /><Tab label="Concluídos" />
      </Tabs>
      <div style={{ display: "flex", gap: 8 }}>
        <TextField size="small" variant="outlined" label="Nova lista" value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && createList()} />
        <Button variant="outlined" startIcon={<Add />} onClick={createList} disabled={busy || !newListName.trim()}>Lista</Button>
      </div>
    </div>
    {tab === 1 && <Typography variant="caption" color="textSecondary" style={{ marginBottom: 12 }}>
      Cards concluídos são removidos automaticamente após dois meses. Os tickets vinculados permanecem no sistema.
    </Typography>}
    <div className={classes.board}>
      {columns.map(column => <div className={classes.column} key={column.id || "tickets"} onDragOver={e => e.preventDefault()} onDrop={e => moveCard(e, column.id)}>
        <div className={classes.columnHeader}>
          <Typography variant="subtitle1"><strong>{column.name}</strong></Typography>
          <span style={{ display: "flex", alignItems: "center" }}>
            <Chip size="small" label={cards.filter(card => (card.listId || null) === column.id && card.completed === Boolean(tab)).length} />
            {column.id && <IconButton size="small" aria-label={`Excluir lista ${column.name}`} title="Excluir lista" onClick={() => setListToDelete(column)}><DeleteOutline fontSize="small" /></IconButton>}
          </span>
        </div>
        <div className={classes.cards}>
          {cards.filter(card => (card.listId || null) === column.id && card.completed === Boolean(tab)).map(card => <Paper key={card.id} className={classes.card} draggable onDragStart={e => e.dataTransfer.setData("text/plain", String(card.id))} onClick={() => setSelected(card)}>
            {card.tag && <Chip size="small" color="primary" label={card.tag} style={{ marginBottom: 8 }} />}
            <Typography variant="body2"><strong>{card.title}</strong></Typography>
            <div className={classes.cardFooter}>
              <Typography variant="caption" color="textSecondary">{card.ticketId ? `Ticket #${card.ticketId}` : "Card livre"}</Typography>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChatBubbleOutline fontSize="small" />{card.comments?.length || 0}
                <Tooltip title={card.completed ? "Reabrir card" : "Concluir card"}>
                  <IconButton
                    size="small"
                    aria-label={card.completed ? "Reabrir card" : "Concluir card"}
                    disabled={busy}
                    onClick={event => {
                      event.stopPropagation();
                      run(() => api.put(`/cards/${card.id}`, { completed: !card.completed }));
                    }}
                  >
                    {card.completed ? <Replay fontSize="small" /> : <CheckCircleOutline fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </span>
            </div>
          </Paper>)}
        </div>
        {tab === 0 && <Button size="small" startIcon={<Add />} onClick={() => { setSelected({ new: true, listId: column.id }); setNewTitle(""); }}>Adicionar card</Button>}
      </div>)}
    </div>
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
      <DialogTitle>{selected?.new ? "Novo card" : selected?.title}</DialogTitle>
      <DialogContent>
        {selected?.new ? <div className={classes.dialogFields}>
          <TextField autoFocus label="Título" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && createCard(selected.listId)} />
        </div> : selected && <div className={classes.dialogFields}>
          <TextField label="Título" value={selected.title} onChange={e => setSelected({ ...selected, title: e.target.value })} onBlur={() => { const original = cards.find(card => card.id === selected.id); if (selected.title.trim() && selected.title !== original?.title) updateCard({ title: selected.title }); }} />
          <TextField label="Tag de identificação" value={selected.tag || ""} onChange={e => setSelected({ ...selected, tag: e.target.value })} onBlur={() => { const original = cards.find(card => card.id === selected.id); if (selected.tag !== original?.tag) updateCard({ tag: selected.tag }); }} />
          {selected.ticketId && <Button startIcon={<OpenInNew />} onClick={() => history.push(`/tickets/${selected.ticketId}`)}>Abrir ticket #{selected.ticketId}</Button>}
          <Button startIcon={<CheckCircleOutline />} variant="outlined" onClick={() => updateCard({ completed: !selected.completed })}>{selected.completed ? "Reabrir card" : "Concluir card"}</Button>
          <Typography variant="subtitle1">Comentários</Typography>
          <div className={classes.comments}>{selected.comments?.map(item => <div className={classes.comment} key={item.id}><Typography variant="caption" color="textSecondary">{item.user?.name || "Usuário"}</Typography><Typography variant="body2">{item.body}</Typography></div>)}</div>
          <TextField label="Novo comentário" multiline rows={3} variant="outlined" value={comment} onChange={e => setComment(e.target.value)} />
          <Button color="primary" variant="contained" onClick={addComment} disabled={busy || !comment.trim()}>Comentar</Button>
        </div>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelected(null)}>Fechar</Button>
        {selected?.new && <Button color="primary" variant="contained" onClick={() => createCard(selected.listId)} disabled={busy || !newTitle.trim()}>Criar</Button>}
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(listToDelete)} onClose={() => setListToDelete(null)}>
      <DialogTitle>Excluir lista?</DialogTitle>
      <DialogContent>
        Os {cards.filter(card => card.listId === listToDelete?.id).length} cards desta lista serão movidos para a lista Tickets. Nenhum card ou comentário será excluído.
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setListToDelete(null)} disabled={busy}>Cancelar</Button>
        <Button color="secondary" onClick={deleteList} disabled={busy}>Excluir lista</Button>
      </DialogActions>
    </Dialog>
  </div>;
};

export default Cards;
