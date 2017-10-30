"use strict";

const { MoleculerError } 	= require("moleculer").Errors;
const Auth					= require("./routes/auth");

const ApiGateway 			= require("moleculer-web");
const { ForbiddenError, UnAuthorizedError, ERR_NO_TOKEN, ERR_INVALID_TOKEN } = ApiGateway.Errors;

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 4000,

		routes: [
			Auth.route,
			require("./routes/api"),
			require("./routes/admin"),
			require("./routes/root"),
		],

		/*assets: {
			folder: "./www"
		}*/
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

					// If authorization was success, set the user entity to ctx.meta
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

	},
	
	created() {
		Auth.initialize.call(this);
	}
};
