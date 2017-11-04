"use strict";

const serveStatic = require("serve-static");

module.exports = {
	path: "/",

	use: [
		serveStatic("./www")
	],

	aliases: {
		"GET /"(req, res) {
			if (req.isAuthenticated())
				this.render(req, res, "main", { user: req.user });
			else
				this.render(req, res, "index");
		},
			
		"GET /login"(req, res) {
			this.render(req, res, "login");
		},
			
		"GET /logout"(req, res) {
			req.logout();
			this.sendRedirect(res, "/");
		}
	},

	disableServiceCalls: true
};