"use strict";

const { serveStatic } 			= require("moleculer-web");
const common					= require("./common");
const path 						= require("path");

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on 
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	req.$service.sendRedirect(res, "/login.html");
}

module.exports = {
	path: "/",

	authorization: false,

	use: [
		...common.middlewares,
		serveStatic(path.resolve("./www"))
	],

	aliases: {
		"/main": [isLoggedIn, (req, res) => {
			res.render("main.jade", { user: req.user });
		}],
		"/logout"(req, res) {
			req.logout();
			this.sendRedirect(res, "/");
		}
	}
};