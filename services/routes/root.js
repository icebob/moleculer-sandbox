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
			if (req.isAuthenticated())
				return this.sendRedirect(res, "/");

			this.render(req, res, "login", { providers: Object.keys(this.passports) });
		},
			
		"GET /signup"(req, res) {
			if (req.isAuthenticated())
				return this.sendRedirect(res, "/");

			this.render(req, res, "signup", { 
				providers: Object.keys(this.passports),
				hasValidationError() { return false; },
				validationErrorMessage() { return ""; }
			});
		},

		"POST /signup"(req, res) {
			this.broker.call("account.register", req.body)
				.then(user => {
					req.login(user, err => {
						if (err)
							this.sendError(req, res, err);

						this.sendRedirect(res, "/");
					});
				})
				.catch(err => {
					if (err.name == "ValidationError") {
						this.render(req, res, "signup", { 
							providers: Object.keys(this.passports),
							hasValidationError(field) {
								if (err.data && Array.isArray(err.data))
									return err.data.find(item => item.field == field);
							},
							validationErrorMessage(field) {
								if (err.data && Array.isArray(err.data)) {
									const item = err.data.find(item => item.field == field);
									if (item)
										return item.message;
								}
							}
						});
					}
				});
		},
			
		"GET /logout"(req, res) {
			if (req.user) {
				req.logout();
				req.session.destroy();
			}

			this.sendRedirect(res, "/");
		}
	},

	mappingPolicy: "restrict",

	// Use bodyparser modules
	bodyParsers: {
		json: true,
		urlencoded: { extended: true }
	}
};