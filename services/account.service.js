"use strict";

const bcrypt = require("bcrypt");
const { MoleculerError } = require("moleculer").Errors;

/**
 * 
 * https://github.com/layerhq/express-jwt-blacklist
 * https://github.com/rlindskog/vueniverse/blob/master/template/src/server/middleware/authenticate.js
 * 
 */

module.exports = {
	name: "account",

	actions: {
		/**
		 * Register a new account
		 */
		register: {
			params: {
				username: { type: "string", min: 3 },
				password: { type: "string", min: 6 },
				email: { type: "email" },
				fullName: { type: "string", min: 2 },
			},
			handler(ctx) {
				return this.Promise.resolve()
					// 1. Generate verification token
					// 2. Generate passwordless token

					.then(() => bcrypt.hash(ctx.params.password, 10))
					// 3. Create user
					.then(hashPassword => {
						return ctx.call("users.create", {
							username: ctx.params.username,	
							password: hashPassword,	
							fullName: ctx.params.fullName,	
							email: ctx.params.email,	
							roles: ["user"]	,
							createdAt: Date.now(),	
						});

					});
					// 4. Send Welcome email
					// 4. Send verification email
			}
		},

		/**
		 * Verify an account
		 */
		verify: {
			handler(ctx) {
				// 1. Check verification token
				// 2. Set `verified: true`
				// 3. Login with user
				// 4. Send welcome email
			}
		},

		/**
		 * Check passwordless token
		 */
		passwordless: {
			handler(ctx) {
				// 1. Check passwordless token
				// 2. Set `verified: true` if not verified yet
			}
		},

		/**
		 * Start "forgot password" process
		 */
		forgotPassword: {
			handler(ctx) {
				// 1. Check email is exist
				// 2. Generate a resetPasswordToken
				// 3. Save the token to user
				// 4. Send a passwordReset email

			}
		},

		/**
		 * Check the reset password token
		 */
		checkResetToken: {
			handler(ctx) {
				// 1. Check the token & expires
			}
		},

		/**
		 * Reset password
		 */
		resetPassword: {
			handler(ctx) {
				// 1. Check the token & expires
				// 2. Change the password
				// 		Clear passwordless flag if was
				// 3. Send password changed email
			}
		},

		/**
		 * Link account to a social account
		 */
		link: {
			handler(ctx) {
				
			}
		},

		/**
		 * Unlink account from a social account
		 */
		unlink: {
			handler(ctx) {

			}
		},
	}
};