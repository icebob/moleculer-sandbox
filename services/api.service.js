"use strict";

const path 						= require("path");
const cons 						= require("consolidate");
const session 					= require("express-session");
const cookieParser 				= require("cookie-parser");
const helmet 					= require("helmet");
const flash 					= require("connect-flash");

const passport 					= require("passport");
const ApiGateway 				= require("moleculer-web");

const Auth						= require("./routes/auth");

const renderer 					= cons["pug"];

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 4000,

		use: [
			// Security
			helmet(),

			// parse cookie from header
			cookieParser(),

			// initialize session
			session({
				secret: "moleculer-sandbox",
				resave: false,
				saveUninitialized: true
			}),

			// Passport init
			passport.initialize(),
			passport.session(),

			flash()
		],

		routes: [
			Auth.route,
			require("./routes/admin"),
			require("./routes/api"),
			require("./routes/root"),
		]
	},

	methods: {
		/**
		 * Render a page
		 * 
		 * @param {*} req 
		 * @param {*} res 
		 * @param {*} file 
		 * @param {*} options 
		 */
		render(req, res, file, options) {
			res.locals.messages = req.flash();
			let opts = Object.assign({}, res.locals, options || {});
			renderer(path.resolve("./views", file + ".pug"), opts, (err, html) => {
				if (err) 
					return this.sendError(req, res, err);
				
				res.writeHead(200, {
					"Content-type": "text/html"
				});
				res.end(html);

				this.logResponse(req, res);
			});
		}
	},

	created() {
		Auth.initialize.call(this);
	}
};
