"use strict";

const crypto 		= require("crypto");
const bcrypt 		= require("bcrypt");
const { MoleculerError, MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

/**
 * 
 */

module.exports = {
	name: "account",

	settings: {
		enableSignUp: true,
		enablePasswordless: true, // TODO
		enableUsername: true, // TODO
		sendMail: true, // TODO
		verification: true, // TODO
		socialProviders: {},

		actions: {
			createUser: "users.create",
			getUser: "users.get", // TODO
			updateUser: "users.update", // TODO
			findUsers: "users.find", // TODO
			sendMail: "mail.send"
		}
	},

	actions: {
		/**
		 * Register a new user account
		 */
		register: {
			params: {
				username: { type: "string", min: 3, optional: true },
				password: { type: "string", min: 6, optional: true },
				email: { type: "email" },
				fullName: { type: "string", min: 2 },
				avatar: { type: "string", optional: true },
			},
			handler(ctx) {
				if (!this.settings.enableSignUp)
					return this.Promise.reject(new MoleculerClientError("Sign up is not available.", 400, "ERR_SIGNUP_DISABLED"));

				const params = Object.assign({}, ctx.params);
				const entity = {};

				return this.Promise.resolve()
					// Verify email
					.then(() => {
						return this.getUserByEmail(ctx, params.email)
							.then(found => {
								if (found)
									return this.Promise.reject(new MoleculerClientError("Email has already been registered.", 400, "ERR_EMAIL_EXISTS"));
							});
					})					
					// Verify username
					.then(() => {
						if (this.settings.enableUsername) {
							return this.getUserByUsername(ctx, params.username)
								.then(found => {
									if (found)
										return this.Promise.reject(new MoleculerClientError("Username has already been registered.", 400, "ERR_USERNAME_EXISTS"));
								});
						}
					})		
									
					// Set basic data
					.then(() => {
						if (this.settings.enableUsername)
							entity.username = params.username;
						entity.email = params.email;
						entity.fullName = params.fullName;	
						entity.roles = ["user"];
						entity.avatar = params.avatar;
						entity.socialLinks = {};	
						entity.createdAt = Date.now();	
						entity.verified = true;
						entity.status = 1;
					})

					// Generate passwordless token or hash password
					.then(() => {
						if (params.password) {
							entity.password = bcrypt.hash(params.password, 10);
							entity.passwordless = false;
						} else if (this.settings.enablePasswordless) {
							entity.passwordless = true;
							entity.password = this.generateToken(25);
						} else {
							return this.Promise.reject(new MoleculerClientError("Passwordless account is not allowed.", 400, "ERR_PASSWORDLESS_NOT_ALLOWED"));
						}
					})

					// Generate verification token
					.then(() => {
						if (this.settings.verification) {
							entity.verified = false;
							entity.verificationToken = this.generateToken(25);
						}
					})

					// Create new user
					.then(() => {
						return ctx.call(this.settings.actions.createUser, entity);
					})

					// Send welcome or verification email
					.then(user => {
						return Promise.resolve()
							.then(() => {
								if (user.verified) {
									// Send welcome email
									ctx.call(this.settings.actions.sendMail, {
										to: user.email,
										template: "welcome",
										data: {
											name: user.fullName
										}
									}, { retry: 3 });

								} else {
									// Send verification email
									ctx.call(this.settings.actions.sendMail, {
										to: user.email,
										template: "activate",
										data: {
											name: user.fullName,
											token: entity.verificationToken
										}
									}, { retry: 3 });

								}						
							})
							.then(() => user);
					});
			}
		},

		/**
		 * Verify an account
		 */
		verify: {
			handler(ctx) {
				return this.Promise.resolve()
					// Check verification token
					.then(() => ctx.call("users.verify", { token: ctx.params.token }))

					// Send welcome email
					.then(user => {
						ctx.call(this.settings.actions.sendMail, {
							to: user.email,
							template: "welcome",
							data: {
								name: user.fullName
							}
						}, { retry: 3 });	

						return user;					
					});
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
			params: {
				user: { type: "object" },
				provider: { type: "string" },
				userData: { type: "object" },
			},
			handler(ctx) {
				return ctx.call("users.update", {
					id: ctx.params.user._id,
					[`socialLinks.${ctx.params.provider}`]: ctx.params.userData.id
				});
			}
		},

		/**
		 * Unlink account from a social account
		 */
		unlink: {
			params: {
				user: { type: "object" },
				provider: { type: "string" }
			},
			handler(ctx) {
				return ctx.call("users.update", {
					id: ctx.params.user._id,
					[`socialLinks.${ctx.params.provider}`]: null
				});
			}
		},

		/**
		 * Handle social login.
		 */
		socialLogin: {
			params: {
				provider: { type: "string" },
				profile: { type: "object" },
				accessToken: { type: "string" },
				refreshToken: { type: "string", optional: true },
			},
			handler(ctx) {
				const provider = ctx.params.provider;
				const userData = this.getUserDataFromSocialProfile(provider, ctx.params.profile);

				if (userData) {
					const query = { [`socialLinks.${provider}`]: userData.id };

					if (ctx.meta.user) {
						// There is logged in user. Link to the logged in user
						return this.Promise.resolve()
							// Get user 							
							.then(() => ctx.call("users.find", { query }))
							.then(users => {
								if (users.length > 0) {
									const user = users[0];
									if (user._id != ctx.meta.user._id) 
										return this.Promise.reject(new MoleculerClientError("This social account has been linked to an other account.", 400, "ERR_SOCIAL_ACCOUNT_MISMATCH"));
								
									// Same user
									return this.Promise.resolve(user);

								} else {
									// Not found linked account. Create the link
									return ctx.call("account.link", { user: ctx.meta.user, provider, userData });
								}
								
							});

					} else {
						// No logged in user
						if (!userData.email)
							return this.Promise.reject(new MoleculerClientError("Missing e-mail address in social profile", 400, "ERR_NO_SOCIAL_EMAIL"));

						return this.Promise.resolve()
							.then(() => ctx.call("users.find", { query }))
							.then(users => {
								if (users.length > 0) {
									// User found.
									return this.Promise.resolve(users[0]);
								} else {
									// Try to search user by email
									return this.getUserByEmail(ctx, userData.email);
								}
							})
							.then(user => {
								if (user) {
									// Found the user by email. Update the profile & create link
									return user;
								}

								if (!this.settings.enableSignUp)
									return this.Promise.reject(new MoleculerClientError("Sign up is not available", 400, "ERR_SIGNUP_DISABLED"));

								// Create a new user and link 
								return ctx.call("account.register", {
									username: userData.username,
									password: bcrypt.genSaltSync(),
									email: userData.email,
									fullName: userData.name,
									avatar: userData.avatar
								});
							})
							.then(user => ctx.call("account.link", { user, provider, userData }));
					}

				} else
					return this.Promise.reject(new MoleculerClientError(`Unsupported provider: ${provider}`, 400, "ERR_UNSUPPORTED_PROVIDER"));
			}
		}
	},

	methods: {
		/**
		 * Get user by email
		 * 
		 * @param {Context} ctx 
		 * @param {String} email 
		 */
		getUserByEmail(ctx, email) {
			return ctx.call("users.find", { query: { email }})
				.then(users => users.length > 0 ? users[0] : null);
		},
			
		/**
		 * Get user by username
		 * 
		 * @param {Context} ctx 
		 * @param {String} username 
		 */
		getUserByUsername(ctx, username) {
			return ctx.call("users.find", { query: { username }})
				.then(users => users.length > 0 ? users[0] : null);
		},

		/**
		 * Get 'user' entity from social profile
		 * 
		 * @param {*} provider 
		 * @param {*} profile 
		 */
		getUserDataFromSocialProfile(provider, profile) {
			switch(provider) {
				case "google": return this.getUserDataFromGoogleProfile(profile);
				case "facebook": return this.getUserDataFromFacebookProfile(profile);
				case "github": return this.getUserDataFromGithubProfile(profile);
				case "twitter": return this.getUserDataFromTwitterProfile(profile);
			}

			return null;
		},

		/**
		 * Get 'user' entity fields from Google social profile
		 * 
		 * @param {*} profile 
		 */
		getUserDataFromGoogleProfile(profile) {
			const res = {
				id: profile.id,
				name: profile.displayName,
			};
			if (profile.emails && profile.emails.length > 0) {
				res.email = profile.emails[0].value;
				res.username = res.email;
			}

			if (profile.photos && profile.photos.length > 0)
				res.avatar = profile.photos[0].value.replace("sz=50", "sz=200");

			return res;
		},

		/**
		 * Get 'user' entity fields from Facebook social profile
		 * 
		 * @param {*} profile 
		 */
		getUserDataFromFacebookProfile(profile) {
			const res = {
				id: profile.id,
				username: profile._json.email,
				name: profile.name.givenName + " " + profile.name.familyName,
				email: profile._json.email,
				avatar: `https://graph.facebook.com/${profile.id}/picture?type=large`
			};
			return res;
		},

		/**
		 * Get 'user' entity fields from Github social profile
		 * 
		 * @param {*} profile 
		 */
		getUserDataFromGithubProfile(profile) {
			const res = {
				id: profile.id,
				username: profile.username,
				name: profile.displayName,
				avatar: profile._json.avatar_url
			};

			if (profile.emails && profile.emails.length > 0) {
				let email = profile.emails.find(email => email.primary);
				if (!email) 
					email = profile.emails[0];
				
				res.email = email.value;
			}

			return res;
		},

		/**
		 * Get 'user' entity fields from Twitter social profile
		 * 
		 * @param {*} profile 
		 */
		getUserDataFromTwitterProfile(profile) {
			const res = {
				id: profile.id,
				username: profile.username,
				name: profile.displayName,
				email: `${profile.username}@twitter.com`,
				avatar: profile._json.profile_image_url_https
			};

			return res;
		},

		generateToken(len) {
			return crypto.randomBytes(len).toString("hex");
		}
	}
};