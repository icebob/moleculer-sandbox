"use strict";

const { MoleculerError } 		= require("moleculer").Errors;
const Auth						= require("./routes/auth");
const common					= require("./routes/common");

const path 						= require("path");
const cons 						= require("consolidate");
const session 					= require("express-session");
const cookieParser 				= require("cookie-parser");

const passport 					= require("passport");
const ApiGateway 				= require("moleculer-web");

const renderer = cons["jade"];

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 4000,

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

			//common.renderer("jade", "./views"),
		],

		routes: [
			Auth.route,
			require("./routes/admin"),
			require("./routes/api"),
			require("./routes/root"),
		]
	},

	methods: {
		render(req, res, file, opts) {
			renderer(path.resolve("./views", file + ".jade"), opts || {}, (err, html) => {
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
