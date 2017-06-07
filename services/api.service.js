"use strict";

const { ServiceBroker } 	= require("moleculer");
const { MoleculerError } 	= require("moleculer").Errors;

const ApiGateway 			= require("moleculer-web");
const { ForbiddenError, UnAuthorizedError, ERR_NO_TOKEN, ERR_INVALID_TOKEN } = ApiGateway.Errors;

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 3000,

		routes: [
			{
				path: "/auth",

				whitelist: [
					"auth.login",
					"auth.callback"
				],

				aliases: {
					"POST /local": "auth.login",
					"GET /social/:provider": "auth.socialLogin",
					"GET /social/:provider/callback": "auth.callback"
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
