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
			this.render(req, res, "login", { providers: Object.keys(this.passports) });
		},
			
		"GET /signup"(req, res) {
			this.render(req, res, "signup", { providers: Object.keys(this.passports) });
		},
			
		"GET /logout"(req, res) {
			if (req.user)
				req.logout();

			this.sendRedirect(res, "/");
		}
	},

	disableServiceCalls: true
};