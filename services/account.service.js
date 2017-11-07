"use strict";

const crypto 		= require("crypto");
const bcrypt 		= require("bcrypt");
const _ 			= require("lodash");
const { MoleculerError, MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

module.exports = {
	name: "account",
	dependencies: ["users", "mail"],

	settings: {
		enableSignUp: true,
		enablePasswordless: true, // TODO
		enableUsername: true, // TODO
		sendMail: true, // TODO
		verification: true,
		socialProviders: {},

		actions: {
			createUser: "users.create",
			updateUser: "users.update",
			findUsers: "users.find",
			authUser: "users.authenticate",
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
							entity.passwordless = false;
							return bcrypt.hash(params.password, 10).then(hash => entity.password = hash);
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
						if (user.verified) {
							// Send welcome email
							this.sendMail(ctx, user, "welcome");
						} else {
							// Send verification email
							this.sendMail(ctx, user, "activate", { token: entity.verificationToken });
						}						

						return user;
					});
			}
		},

		/**
		 * Verify an account
		 */
		verify: {
			params: {
				token: { type: "string" }
			},
			handler(ctx) {
				return this.Promise.resolve()
					// Check verification token
					.then(() => ctx.call("users.verify", { token: ctx.params.token }))

					// Send welcome email
					.then(user => {
						this.sendMail(ctx, user, "welcome");
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
				return ctx.call(this.settings.actions.updateUser, {
					id: ctx.params.user._id,
					[`socialLinks.${ctx.params.provider}`]: ctx.params.userData.id,
					verified: true, // if not verified yet via email
					verificationToken: null
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
				return ctx.call(this.settings.actions.updateUser, {
					id: ctx.params.user._id,
					[`socialLinks.${ctx.params.provider}`]: null
				});
			}
		},

		/**
		 * Handle local login
		 */
		login: {
			params: {
				email: { type: "string", optional: true },
				username: { type: "string", optional: true },
				password: { type: "string", optional: true }
			},
			handler(ctx) {
				return ctx.call(this.settings.actions.authUser, ctx.params)
					.then(user => {
						// Check verified
						if (!user.verified) {
							return this.Promise.reject(new MoleculerClientError("Please activate your account!", 400, "ACCOUNT_NOT_VERIFIED"));
						}

						// Check status
						if (user.status !== 1) {
							return this.Promise.reject(new MoleculerClientError("Account is disabled!", 400, "ACCOUNT_DISABLED"));
						}

						return user;
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
							.then(() => ctx.call(this.settings.actions.findUsers, { query }))
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

						let foundBySocialID = false;
						return this.Promise.resolve()
							.then(() => ctx.call(this.settings.actions.findUsers, { query }))
							.then(users => {
								if (users.length > 0) {
									// User found.
									foundBySocialID = true;
									return this.Promise.resolve(users[0]);
								} else {
									// Try to search user by email
									return this.getUserByEmail(ctx, userData.email);
								}
							})
							.then(user => {
								if (user) {
									// Check status
									if (user.status !== 1) {
										return this.Promise.reject(new MoleculerClientError("Account is disabled!", 400, "ACCOUNT_DISABLED"));
									}
									
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
							.then(user => {
								if (!foundBySocialID)
									return ctx.call("account.link", { user, provider, userData });
								
								return user;
							});
					}

				} else
					return this.Promise.reject(new MoleculerClientError(`Unsupported provider: ${provider}`, 400, "ERR_UNSUPPORTED_PROVIDER"));
			}
		}
	},

	methods: {

		/**
		 * Send email to the user email address
		 * 
		 * @param {Context} ctx 
		 * @param {Object} user 
		 * @param {String} template 
		 * @param {Object?} data 
		 */
		sendMail(ctx, user, template, data) {
			if (!this.settings.sendMail)
				return this.Promiser.resolve(false);

			return ctx.call(this.settings.actions.sendMail, {
				to: user.email,
				template,
				data: _.defaultsDeep(data, {
					name: user.fullName
				})
			}, { retry: 3 });
		},

		/**
		 * Get user by email
		 * 
		 * @param {Context} ctx 
		 * @param {String} email 
		 */
		getUserByEmail(ctx, email) {
			return ctx.call(this.settings.actions.findUsers, { query: { email }})
				.then(users => users.length > 0 ? users[0] : null);
		},
			
		/**
		 * Get user by username
		 * 
		 * @param {Context} ctx 
		 * @param {String} username 
		 */
		getUserByUsername(ctx, username) {
			return ctx.call(this.settings.actions.findUsers, { query: { username }})
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

		/**
		 * Generate a token
		 * 
		 * @param {Number} len Token length
		 */
		generateToken(len) {
			return crypto.randomBytes(len).toString("hex");
		}
	}
};