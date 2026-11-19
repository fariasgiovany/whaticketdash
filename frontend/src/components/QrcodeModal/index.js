import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, Paper, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
	const [qrCode, setQrCode] = useState("");

	useEffect(() => {
		if (!open || !whatsAppId) return;
		let active = true;
		const fetchSession = async () => {
			try {
				const { data } = await api.get(`/whatsapp/${whatsAppId}`);
				if (active) {
					setQrCode(data.qrcode || "");
					if (data.status === "CONNECTED") onClose();
				}
			} catch (err) {
				if (active) toastError(err);
			}
		};
		void fetchSession();
		const interval = setInterval(fetchSession, 3000);
		return () => { active = false; clearInterval(interval); };
	}, [open, whatsAppId, onClose]);

	useEffect(() => {
		if (!open || !whatsAppId) return;
		const socket = openSocket();

		socket.on("whatsappSession", data => {
			if (data.action === "update" && Number(data.session.id) === Number(whatsAppId)) {
				setQrCode(data.session.qrcode || "");
				if (data.session.status === "CONNECTED") onClose();
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [open, whatsAppId, onClose]);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="lg" scroll="paper">
			<DialogContent>
				<Paper elevation={0}>
					<Typography color="primary" gutterBottom>
						{i18n.t("qrCode.message")}
					</Typography>
					{qrCode ? (
						<QRCode value={qrCode} size={280} bgColor="#FFFFFF" fgColor="#000000" includeMargin
							style={{ display: "block", maxWidth: "100%", height: "auto", margin: "0 auto" }} />
					) : (
						<span>Waiting for QR Code</span>
					)}
				</Paper>
			</DialogContent>
		</Dialog>
	);
};

export default React.memo(QrcodeModal);
