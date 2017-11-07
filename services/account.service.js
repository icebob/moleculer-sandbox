"use strict";

const crypto 		= require("crypto");
const bcrypt 		= require("bcrypt");
const _ 			= require("lodash");
const { MoleculerError, MoleculerClientError } = require("moleculer").Errors;

module.exports = {
	name: "account",
	dependencies: ["users", "mail"],

	settings: {
		enableSignUp: true,
		enablePasswordless: true,
		enableUsername: true,
		sendMail: true,
		verification: true,
		socialProviders: {},

		actions: {
			createUser: "users.create",
			updateUser: "users.update",
			findUsers: "users.find",
			checkPassword: "users.checkPassword",
			sendMail: "mail.send"
		}
	},

	actions: {
		/**
		 * Register a new user account
		 */
		register: {
			params: {
				username: { type: "string", /*min: 3, */optional: true },
				password: { type: "string", /*min: 6, */optional: true },
				email: { type: "email" },
				fullName: { type: "string", min: 2 },
				avatar: { type: "string", optional: true },
			},
			handler(ctx) {
				if (!this.settings.enableSignUp)
					return this.Promise.reject(new MoleculerClientError("Sign up is not available.", 400, "ERR_SIGNUP_DISABLED"));

				const params = Object.assign({}, ctx.params);
				const entity = {};
				
				// TODO validate params by settings (username, password...)

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
							return bcrypt.hash(params.password, 10).then(hash => entity.password = hash);
						} else if (this.settings.enablePasswordless) {
							entity.passwordless = true;
							entity.password = this.generateToken(25);
						} else {
							return this.Promise.reject(new MoleculerClientError("Passwordless login is not allowed.", 400, "ERR_PASSWORDLESS_DISABLED"));
						}
					})

					// Generate verification token
					.then(() => {
						if (this.settings.verification && !entity.passwordless) {
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
			params: {
				token: { type: "string" }
			},			
			handler(ctx) {
				if (!this.settings.enablePasswordless)
					return this.Promise.reject(new MoleculerError("Passwordless login is not allowed.", 400, "ERR_PASSWORDLESS_DISABLED"));

				return ctx.call("users.checkPasswordlessToken", { token: ctx.params.token });
			}
		},

		/**
		 * Start "forgot password" process
		 */
		forgotPassword: {
			params: {
				email: { type: "email" }
			},
			handler(ctx) {
				const token = this.generateToken(25);

				return this.getUserByEmail(ctx, ctx.params.email)
					// Check email is exist
					.then(user => {
						if (!user)
							return this.Promise.reject(new MoleculerClientError("Email is not registered.", 400, "ERR_EMAIL_NOT_FOUND"));

						// Save the token to user
						return ctx.call(this.settings.actions.updateUser, {
							id: user._id,
							resetToken: token,
							resetTokenExpires: Date.now() + 3600 * 1000 // 1 hour
						});
					})
					
					// Send a passwordReset email
					.then(user => {
						this.sendMail(ctx, user, "reset-password", { token });
					});
			}
		},

		/**
		 * Check the reset password token
		 */
		checkResetToken: {
			params: {
				token: { type: "string" }
			},			
			handler(ctx) {
				return ctx.call("users.checkResetPasswordToken", { token: ctx.params.token });
			}
		},

		/**
		 * Reset password
		 */
		resetPassword: {
			params: {
				token: { type: "string" },
				password: { type: "string", min: 6 }
			},			
			handler(ctx) {
				// Check the token & expires
				return ctx.call("users.checkResetPasswordToken", { token: ctx.params.token })
					// Change the password
					.then(user => {
						return bcrypt.hash(ctx.params.password, 10)
							.then(hashedPassword => ctx.call(this.settings.actions.updateUser, {
								id: user._id,
								password: hashedPassword,
								passwordless: false,
								resetToken: null,
								resetTokenExpires: null
							}));
					})
					.then(user => {
						this.sendMail(ctx, user, "password-changed");
						
						return user;
					});
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
				let query;

				if (this.settings.enableUsername) {
					query = {
						"$or": [
							{ email: ctx.params.email },
							{ username: ctx.params.username }
						]
					};
				} else {
					query = { email: ctx.params.email };
				}

				return this.Promise.resolve()
					// Get user 							
					.then(() => ctx.call(this.settings.actions.findUsers, { query }))
					.then(users => {
						if (users.length == 0) 
							return this.Promise.reject(new MoleculerClientError("User is not exist!", 400, "ERR_USER_NOT_FOUND"));

						const user = users[0];

						// Check verified
						if (!user.verified) {
							return this.Promise.reject(new MoleculerClientError("Please activate your account!", 400, "ERR_ACCOUNT_NOT_VERIFIED"));
						}

						// Check status
						if (user.status !== 1) {
							return this.Promise.reject(new MoleculerClientError("Account is disabled!", 400, "ERR_ACCOUNT_DISABLED"));
						}

						// Check passwordless login
						if (user.passwordless == true && ctx.params.password)
							return this.Promise.reject(new MoleculerClientError("This is a passwordless account! Please login without password", 400, "ERR_PASSWORDLESS_WITH_PASSWORD"));

						return user;
					})

					// Authenticate
					.then(user => {
						if (ctx.params.password) {
							// Login with password
							return ctx.call(this.settings.actions.checkPassword, { id: user._id, password: ctx.params.password }).then(() => user);
						} else if (this.settings.enablePasswordless) {
							// Send magic link
							return this.sendMagicLink(ctx, user).then(() => {
								return this.Promise.reject(new MoleculerError(`An email has been sent to ${user.email} with magic link. Please check your spam folder if it does not arrive.`, 400, "MAGIC_LINK_SENT"));
							});
						} else {
							return this.Promise.reject(new MoleculerError("Passwordless login is not allowed.", 400, "ERR_PASSWORDLESS_DISABLED"));
						}
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
		 * Send login magic link to user email
		 * 
		 * @param {Context} ctx 
		 * @param {Object} user 
		 */
		sendMagicLink(ctx, user) {
			const token = this.generateToken(25);

			return ctx.call(this.settings.actions.updateUser, {
				id: user._id,
				passwordlessToken: token,
				passwordlessTokenExpires: Date.now() + 3600 * 1000 // 1 hour
			})
				.then(user => {
					return this.sendMail(ctx, user, "magic-link", { token });
				});
		},

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
				return this.Promise.resolve(false);

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