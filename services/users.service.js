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
			async handler(ctx) {
				const user = await this.adapter.findById(ctx.params.id);
				if (!user)
					throw new MoleculerClientError("User is not exist!", 400, "ERR_USER_NOT_FOUND");

				const res = await bcrypt.compare(ctx.params.password, user.password);
				if (!res)
					throw new MoleculerClientError("Wrong password!", 400, "ERR_WRONG_PASSWORD");
				
				// Transform user entity (remove password and all protected fields)
				return this.transformDocuments(ctx, {}, user);
			}
		},

		/**
		 * Verify a user by token
		 */
		verify: {
			params: {
				token: "string"				
			},
			async handler(ctx) {
				const user = await this.adapter.findOne({ verificationToken: ctx.params.token });
				if (!user)
					throw new MoleculerClientError("Invalid verification token or expired!", 400, "INVALID_TOKEN");

				return await this.adapter.updateById(user._id, {
					"$set": {
						verified: true,
						verificationToken: null
					}
				});
			}
		},

		checkPasswordlessToken: {
			params: {
				token: "string"
			},
			async handler(ctx) {
				const user = await this.adapter.findOne({ passwordlessToken: ctx.params.token });
				if (!user)
					throw new MoleculerClientError("Invalid token!", 400, "INVALID_TOKEN");

				if (user.passwordlessTokenExpires < Date.now())
					throw new MoleculerClientError("Token expired!", 400, "TOKEN_EXPIRED");

				return this.transformDocuments(ctx, {}, user);
			}
		},

		checkResetPasswordToken: {
			params: {
				token: "string"
			},
			async handler(ctx) {
				const user = await this.adapter.findOne({ resetToken: ctx.params.token });
				if (!user)
					throw new MoleculerClientError("Invalid token!", 400, "INVALID_TOKEN");

				if (user.resetTokenExpires < Date.now())
					throw new MoleculerClientError("Token expired!", 400, "TOKEN_EXPIRED");

				return this.transformDocuments(ctx, {}, user);
			}
		}
	},

	methods: {
		async seedDB() {
			this.logger.info("Seed Users DB...");
			
			// Create admin user
			await this.adapter.insert({
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
			});
			// Create test user
			await this.adapter.insert({
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
			});

			const count = await this.adapter.count();
			this.logger.info(`Generated ${count} users!`);
		}
	},

	async afterConnected() {
		const count = await this.adapter.count();
		if (count == 0) {
			this.seedDB();
		}
	}

};
