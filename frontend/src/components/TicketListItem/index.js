import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { alpha, makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	ticket: {
		position: "relative",
	},

	pendingTicket: {
		cursor: "unset",
	},

	ticketSelected: {
		"&.Mui-selected, &.Mui-selected:hover": {
			backgroundColor: alpha(theme.palette.primary.main, 0.08),
		},
	},

	noTicketsDiv: {
		display: "flex",
		height: "100px",
		margin: 40,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},

	noTicketsText: {
		textAlign: "center",
		color: "rgb(104, 121, 146)",
		fontSize: "14px",
		lineHeight: "1.4",
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "16px",
		fontWeight: "600",
		margin: "0px",
	},

	contactNameWrapper: {
		display: "flex",
		justifyContent: "space-between",
	},

	lastMessageTime: {
		justifySelf: "flex-end",
	},

	closedBadge: {
		alignSelf: "center",
		justifySelf: "flex-end",
		marginRight: 32,
		marginLeft: "auto",
	},

	contactLastMessage: {
		flex: 1,
		minWidth: 0,
	},

	unreadCount: {
		alignSelf: "center",
		minWidth: 20,
		marginLeft: theme.spacing(1),
		padding: theme.spacing(0, 0.75),
		borderRadius: theme.borderRadius.pill,
		backgroundColor: green[500],
		color: theme.palette.common.white,
		textAlign: "center",
		...theme.typography.caption,
		fontWeight: 500,
	},

	ticketActions: {
		display: "flex",
		flexShrink: 0,
		gap: theme.spacing(0.5),
		marginLeft: theme.spacing(1),
	},

	ticketQueueColor: {
		flex: "none",
		width: "8px",
		height: "100%",
		position: "absolute",
		top: "0%",
		left: "0%",
		borderRadius: "0 4px 4px 0",
		backgroundColor: theme.palette.queue.fallback,
	},

	userTag: {
		flex: "none",
		alignSelf: "center",
		marginLeft: theme.spacing(1),
		padding: theme.spacing(0, 0.75),
		borderRadius: theme.borderRadius.pill,
		backgroundColor: theme.palette.action.selected,
		color: theme.palette.text.secondary,
		...theme.typography.caption,
	},
}));

const TicketListItem = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [pendingAction, setPendingAction] = useState(null);
	const { ticketId } = useParams();
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleUpdateStatus = async (event, status) => {
		event.stopPropagation();
		setPendingAction(status);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status,
				userId: status === "open" ? user?.id : null,
			});
			if (status === "open") history.push(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		} finally {
			if (isMounted.current) setPendingAction(null);
		}
	};

	const handleSelectTicket = id => {
		history.push(`/tickets/${id}`);
	};

	return (
		<React.Fragment key={ticket.id}>
			<ListItem
				dense
				button
				onClick={() => {
					if (ticket.status === "pending" || ticket.status === "ignored") return;
					handleSelectTicket(ticket.id);
				}}
				selected={ticketId && +ticketId === ticket.id}
				classes={{ selected: classes.ticketSelected }}
				className={clsx(classes.ticket, {
					[classes.pendingTicket]: ticket.status === "pending",
				})}
			>
				<Tooltip
					arrow
					placement="right"
					title={ticket.queue?.name || "Sem fila"}
				>
					<span
						style={{ backgroundColor: ticket.queue?.color }}
						className={classes.ticketQueueColor}
					></span>
				</Tooltip>
				<ListItemAvatar>
					<Avatar src={ticket?.contact?.profilePicUrl}>
						{ticket.contact.name.charAt(0)}
					</Avatar>
				</ListItemAvatar>
				<ListItemText
					disableTypography
					primary={
						<span className={classes.contactNameWrapper}>
							<Typography
								noWrap
								component="span"
								variant="body2"
								color="textPrimary"
							>
								{ticket.contact.name}
							</Typography>
							{ticket.status === "closed" && (
								<Badge
									className={classes.closedBadge}
									badgeContent={"closed"}
									color="primary"
								/>
							)}
							{ticket.lastMessage && (
								<Typography
									className={classes.lastMessageTime}
									component="span"
									variant="body2"
									color="textSecondary"
								>
									{isSameDay(parseISO(ticket.updatedAt), new Date()) ? (
										<>{format(parseISO(ticket.updatedAt), "HH:mm")}</>
									) : (
										<>{format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}</>
									)}
								</Typography>
							)}
						</span>
					}
					secondary={
						<span className={classes.contactNameWrapper}>
							<Typography
								className={classes.contactLastMessage}
								noWrap
								component="span"
								variant="body2"
								color="textSecondary"
							>
								{ticket.lastMessage ? (
									<MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
								) : (
									<br />
								)}
							</Typography>

							{ticket.whatsappId && (
								<span className={classes.userTag} title={i18n.t("ticketsList.connectionTitle")}>{ticket.whatsapp?.name}</span>
							)}
							{ticket.unreadMessages > 0 && (
								<span className={classes.unreadCount}>
									{ticket.unreadMessages > 99 ? "99+" : ticket.unreadMessages}
								</span>
							)}
						</span>
					}
				/>
				{(ticket.status === "pending" || ticket.status === "ignored") && (
					<div className={classes.ticketActions}>
						{ticket.status === "pending" && (
							<ButtonWithSpinner
								size="small"
								loading={pendingAction === "ignored"}
								disabled={Boolean(pendingAction)}
								onClick={event => handleUpdateStatus(event, "ignored")}
							>
								{i18n.t("messagesList.header.buttons.ignore")}
							</ButtonWithSpinner>
						)}
						<ButtonWithSpinner
							color="primary"
							variant="contained"
							size="small"
							loading={pendingAction === "open"}
							disabled={Boolean(pendingAction)}
							onClick={event => handleUpdateStatus(event, "open")}
						>
							{i18n.t(ticket.status === "ignored" ? "ticketsList.buttons.attend" : "ticketsList.buttons.accept")}
						</ButtonWithSpinner>
					</div>
				)}
			</ListItem>
			<Divider variant="inset" component="li" />
		</React.Fragment>
	);
};

export default TicketListItem;
