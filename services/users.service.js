"use strict";

const path = require("path");
const _ = require("lodash");
const bcrypt = require("bcrypt");
const { MoleculerClientError } = require("moleculer").Errors;
const DbService = require("moleculer-db");

module.exports = {
	name: "users",
	mixins: [DbService],
	dependencies: ["fake"],
	adapter: new DbService.MemoryAdapter({ filename: path.resolve("data", "users.db") }),

	settings: {
		fields: ["_id", "username", "fullName", "email", "avatar", "roles", "socialLinks", "status", "verified", "passwordless"]
	},

	actions: {
		/**
		 * Check user password
		 */
		checkPassword: {
			params: {
				id: "any",
				password: "string"
			},
			handler(ctx) {
				return this.Promise.resolve()
					.then(() => this.findOne({ _id: ctx.params.id }))
					.then(user => {
						if (!user)
							return Promise.reject(new MoleculerClientError("User is not exist!", 400, "ERR_USER_NOT_FOUND"));

						return bcrypt.compare(ctx.params.password, user.password).then(res => {
							if (!res)
								return Promise.reject(new MoleculerClientError("Wrong password!", 400, "ERR_WRONG_PASSWORD"));
							
							// Transform user entity (remove password and all protected fields)
							return this.transformDocuments(ctx, {}, user);
						});
					});
			}
		},

		/**
		 * Verify a user by token
		 */
		verify: {
			params: {
				token: "string"				
			},
			handler(ctx) {
				return this.Promise.resolve()
					.then(() => this.findOne({ verificationToken: ctx.params.token }))
					.then(user => {
						if (!user)
							return Promise.reject(new MoleculerClientError("Invalid verification token or expired!", 400, "INVALID_TOKEN"));

						return this.updateById(ctx, {
							id: user._id,
							update: {
								"$set": {
									verified: true,
									verificationToken: null
								}
							}
						});
					});
			}
		},

		checkPasswordlessToken: {
			params: {
				token: "string"
			},
			handler(ctx) {
				return this.Promise.resolve()
					.then(() => this.findOne({ passwordlessToken: ctx.params.token }))
					.then(user => {
						if (!user)
							return Promise.reject(new MoleculerClientError("Invalid token!", 400, "INVALID_TOKEN"));

						if (user.passwordlessTokenExpires < Date.now())
							return Promise.reject(new MoleculerClientError("Token expired!", 400, "TOKEN_EXPIRED"));

						return this.transformDocuments(ctx, {}, user);
					});
			}
		},

		checkResetPasswordToken: {
			params: {
				token: "string"
			},
			handler(ctx) {
				return this.Promise.resolve()
					.then(() => this.findOne({ resetToken: ctx.params.token }))
					.then(user => {
						if (!user)
							return Promise.reject(new MoleculerClientError("Invalid token!", 400, "INVALID_TOKEN"));

						if (user.resetTokenExpires < Date.now())
							return Promise.reject(new MoleculerClientError("Token expired!", 400, "TOKEN_EXPIRED"));

						return this.transformDocuments(ctx, {}, user);
					});
			}
		}
	},

	methods: {
		findOne(query) {
			return this.adapter.find({ query })
				.then(res => {
					if (res && res.length > 0)
						return res[0];
				});
		},

		seedDB() {
			this.logger.info("Seed Users DB...");
			return this.Promise.resolve()
				
				// Create admin user
				.then(() => this.adapter.insert({
					username: "admin",
					password: bcrypt.hashSync("admin1234", 10),
					fullName: "Administrator",
					email: "admin@sandbox.moleculer.services",
					avatar: "http://romaniarising.com/wp-content/uploads/2014/02/avatar-admin-robot-150x150.jpg",
					roles: ["admin", "user"],
					socialLinks: {},
					createdAt: Date.now(),
					status: 1,
					verified: true
				}))
				// Create test user
				.then(() => this.adapter.insert({
					username: "test",
					password: bcrypt.hashSync("test1234", 10),
					fullName: "Test user",
					email: "test@sandbox.moleculer.services",
					avatar: "http://icons.iconarchive.com/icons/iconshock/real-vista-general/256/administrator-icon.png",
					roles: ["user"],
					socialLinks: {},
					createdAt: Date.now(),
					status: 1,
					verified: true
				}))

				// Create fake users
				/*.then(() => Promise.all(_.times(8, () => {
					return this.broker.call("fake.user").then(fakeUser => {
						return this.adapter.insert({
							username: fakeUser.userName,
							password: bcrypt.hashSync(fakeUser.password, 10),
							fullName: fakeUser.firstName + " " + fakeUser.lastName,
							email: fakeUser.email,
							avatar: fakeUser.avatar,
							roles: ["user"],
							createdAt: Date.now(),
							updatedAt: null
						});
					});
				})))*/
				.then(() => {
					this.adapter.count().then(count => this.logger.info(`Generated ${count} users!`));
				});
		}
	},

	afterConnected() {
		return this.count().then(count => {
			if (count == 0) {
				this.seedDB();
			}
		});
	}

};
