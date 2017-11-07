"use strict";

const MailService = require("moleculer-mail");

module.exports = {
	name: "mail",
	mixins: [MailService],
	settings: {
		from: "sandbox@moleculer.services",
		transport: {
			host: "smtp.mailtrap.io",
			port: 2525,
			auth: {
				user: process.env.MAILTRAP_USER,
				pass: process.env.MAILTRAP_PASS
			}			
		},
		templateFolder: "./views/mail-templates",

		// Common data
		data: {
			baseURL: "http://localhost:4000",
			siteName: "Sandbox"
		}
	}
};