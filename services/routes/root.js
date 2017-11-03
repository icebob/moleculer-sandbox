"use strict";

const { serveStatic } = require("moleculer-web");
const path = require("path");
const cons = require("consolidate");

const session 					= require("express-session");
const cookieParser 				= require("cookie-parser");

const passport 					= require("passport");

function renderer(type, folder) {
	const _render = cons[type];
	return function render(req, res, next) {
		res.render = function(file, opts) {
			_render(path.resolve(folder, file), opts, (err, html) => {
				if (err) 
					return req.$service.sendError(req, res, err);
				
				res.writeHead(200, {
					"Content-type": "text/html"
				});
				res.end(html);

				req.$service.logResponse(req, res);
			});
		};

		next();
	};
}


module.exports = {
	path: "/",

	authorization: false,

	use: [
		// parse cookie from header
		cookieParser(),

		// initialize session
		session({
			secret: "moleculer-sandbox",
			resave: false,
			saveUninitialized: true
		}),

		// passport init
		passport.initialize(),
		passport.session(),

		renderer("jade", "./views"),
		serveStatic(path.resolve("./www"))
	],

	aliases: {
		"/main"(req, res) {
			res.render("main.jade", { user: req.user });
		}
	}
};