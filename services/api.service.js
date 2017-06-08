"use strict";

const { ServiceBroker } 	= require("moleculer");
const { MoleculerError } 	= require("moleculer").Errors;

const ApiGateway 			= require("moleculer-web");
const { ForbiddenError, UnAuthorizedError, ERR_NO_TOKEN, ERR_INVALID_TOKEN } = ApiGateway.Errors;

const passport 				= require("passport");
const GoogleStrategy 		= require("passport-google-oauth20").Strategy;
const queryString 			= require("querystring");

passport.use(new GoogleStrategy({
	clientID: process.env.GOOGLE_CLIENT_ID,
	clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	callbackURL: "http://localhost:4000/auth/social/google/callback"
},
	function (accessToken, refreshToken, profile, cb) {
		console.log("accessToken", accessToken);
		console.log("refreshToken", refreshToken);
		console.log("profile", profile);
		return cb(null, {});
	}
));

let passportInit = passport.initialize();

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 3000,

		routes: [
			{
				path: "/auth",

				whitelist: [
					"auth.login"
				],

				aliases: {
					"POST /local": "auth.login",
					"GET /social/:provider"(route, req, res) {
						this.logger.info("socialLogin");
						passportInit(req, res, () => {
							passport.authenticate("google", { scope: "profile email" })(req, res);
						});
						
					},
					"GET /social/:provider/callback"(route, req, res) {
						this.logger.info("socialLoginCallback");
						const next = () => {
							// Successful authentication, redirect home.
							this.logger.info("Successful authentication");
							res.writeHead(302, {
								"Location": "/"
							});
							res.end();
						};
						passportInit(req, res, () => {
							const questionIdx = req.url.indexOf("?", 1);
							if (questionIdx !== -1) {
								const query = queryString.parse(req.url.substring(questionIdx + 1));
								req.query = query;
							}							
							const fn = passport.authenticate("google", { failureRedirect: "/login" });
							fn(req, res, next);
						});
					}
				},

				// Use bodyparser module
				bodyParsers: {
					json: true,
					urlencoded: { extended: true }
				}

			}, 
			{
				path: "/api",

				authorization: true,

				roles: ["admin"],

				whitelist: [
					"posts.*"
				],
				aliases: {
					"REST posts": "posts"
				}
			}, 
			{
				path: "/api/admin",

				authorization: true,

				roles: ["user"],

				whitelist: [
					"posts.*",
					"users.*"
				],
				aliases: {
					"REST posts": "posts",
					"REST users": "users"
				}
			}
		],

		assets: {
			folder: "./www"
		}
	},

	methods: {
		/**
		 * Authorize the request
		 * 
		 * @param {Context} ctx 
		 * @param {Object} route
		 * @param {IncomingRequest} req 
		 * @returns {Promise}
		 */
		authorize(ctx, route, req) {
			let authValue = req.headers["authorization"];
			if (authValue && authValue.startsWith("Bearer ")) {
				let token = authValue.slice(7);

				// Verify JWT token
				return ctx.call("auth.verifyToken", { token }).then(decoded => {
					//console.log("decoded data", decoded);

					// Check the user role
					if (route.opts.roles.indexOf(decoded.role) === -1)
						return this.Promise.reject(new ForbiddenError());

					// If authorization was succes, we set the user entity to ctx.meta
					return ctx.call("users.get", { id: decoded.id }).then(user => {
						ctx.meta.user = user;
						this.logger.info("Logged in user", user);
					});
				})

				.catch(err => {
					if (err instanceof MoleculerError)
						return this.Promise.reject(err);

					return this.Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN));
				});

			} else
				return this.Promise.reject(new UnAuthorizedError(ERR_NO_TOKEN));
		}

	}	
};
