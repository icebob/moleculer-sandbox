"use strict";

const _ 		= require("lodash");
const jwt 		= require("jsonwebtoken");

module.exports = {
	name: "auth",

	settings: {
		JWT_SECRET: process.env.JWT_SECRET || "moleculer-jwt-secret",
		socialAuth: {
			google: {
				clientID: process.env.GOOGLE_CLIENTID,
				clientSecret: process.env.GOOGLE_CLIENTSECRET
			},			
		},

		actionNames: {
			loginUser: "users.authenticate",
			getUser: "users.model"
		}
	},

	actions: {
		/**
		 * Try to login a user
		 */
		login: {
			params: {
				username: "string",
				password: "string"
			},
			handler(ctx) {
				return Promise.resolve(ctx)
					.then(ctx => ctx.call(this.settings.actionNames.loginUser, ctx.params))
					.then(this.generateToken)
					.then(token => ({ token }));
			}
		},

		socialLogin: {
			params: {
				provider: "string"
			},
			handler(ctx) {
				this.logger.info("socialLogin", ctx.params);
			}
		},

		socialCallback: {
			handler(ctx) {
				this.logger.info("socialCallback", ctx.params);
			}
		},

		/**
		 * Verify a JWT token
		 * 
		 * @param {any} ctx 
		 * @returns 
		 */
		verifyToken(ctx) {
			return this.verify(ctx.params.token, this.settings.JWT_SECRET);
		}
	},

	created() {
		// Create promisified encode & verify methods
		this.encode = this.Promise.promisify(jwt.sign);
		this.verify = this.Promise.promisify(jwt.verify);
	},

	methods: {
		/**
		 * Generate JWT token
		 * 
		 * @param {any} user 
		 * @returns 
		 */
		generateToken(user) {
			return this.encode(_.pick(user, ["_id", "role"]), this.settings.JWT_SECRET);
		}
	}
};