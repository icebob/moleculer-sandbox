"use strict";

module.exports = {
	name: "account",

	actions: {
		/**
		 * Register a new account
		 */
		register: {
			handler(ctx) {
				// 1. Generate verification token
				// 2. Generate passwordless token
				// 3. Create user
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