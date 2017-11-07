"use strict";

const serveStatic = require("serve-static");

module.exports = {
	path: "/",

	use: [
		serveStatic("./www"),
		function(req, res, next) {
			res.locals.socialProviders = Object.keys(this.passports);
			next();
		}
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

			this.render(req, res, "login");
		},
			
		"GET /signup"(req, res) {
			if (req.isAuthenticated())
				return this.sendRedirect(res, "/");

			this.render(req, res, "signup", { 
				hasValidationError() { return false; },
				validationErrorMessage() { return ""; }
			});
		},

		"POST /signup"(req, res) {
			this.broker.call("account.register", req.body)
				.then(user => {
					if (user.verified) {
						// No verification. Auto-login
						req.login(user, err => {
							if (err)
								this.sendError(req, res, err);

							this.sendRedirect(res, "/");
						});
					} else {
						req.flash("info", "Please check your email to activate your account. Thanks for signing up!");
						return this.sendRedirect(res, "/signup");						
					}
				})
				.catch(err => {
					if (err.name == "ValidationError") {
						this.render(req, res, "signup", { 
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
					} else {
						req.flash("error", err.message);
						return this.sendRedirect(res, "/signup");
					}
				});
		},
			
		"GET /logout"(req, res) {
			if (req.user) {
				req.logout();
				req.session.destroy();
			}

			this.sendRedirect(res, "/");
		},

		"GET /unlink/:provider"(req, res) {
			if (req.user) {
				this.broker.call("account.unlink", { user: req.user, provider: req.$params.provider })
					.then(() => {
						req.flash("info", "Account unlinked.");
						this.sendRedirect(res, "/");
					})
					.catch(err => {
						req.flash("error", err.message);
						this.sendRedirect(res, "/");
					});
			} else {
				this.sendRedirect(res, "/login");
			}
		},

		"GET /verify/:token"(req, res) {
			if (req.user)
				return this.sendRedirect(res, "/");

			this.broker.call("account.verify", { token: req.$params.token })
				.then(user => {
					req.login(user, err => {
						if (err)
							this.sendError(req, res, err);

						this.sendRedirect(res, "/");
					});
				})
				.catch(err => {
					req.flash("error", err.message);
					this.sendRedirect(res, "/");
				});
		},
	},

	mappingPolicy: "restrict",

	// Use bodyparser modules
	bodyParsers: {
		json: true,
		urlencoded: { extended: true }
	}
};