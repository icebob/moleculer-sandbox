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
		fields: ["_id", "username", "fullName", "email", "avatar", "author"]
	},

	actions: {
		/**
		 * Authenticate a user
		 */
		authenticate: {
			params: {
				username: "string",
				password: "string"
			},
			handler(ctx) {
				return Promise.resolve()
					.then(() => this.adapter.db.findOne({ username: ctx.params.username }))
					.then(user => {
						if (!user)
							return Promise.reject(new MoleculerClientError("User is not exist!", 400, "USER_NOT_FOUND"));

						return bcrypt.compare(ctx.params.password, user.password).then(function(res) {
							if (!res)
								return Promise.reject(new MoleculerClientError("Wrong password!", 400, "WRONG_PASSWORD"));
							
							return user;							
						});
					});
			}
		}
	},

	methods: {
		seedDB() {
			this.logger.info("Seed Users DB...");
			return Promise.resolve()
				
				// Create admin user
				.then(() => this.adapter.insert({
					username: "admin",
					password: bcrypt.hashSync("admin1234", 10),
					fullName: "Administrator",
					email: "admin@sandbox.moleculer.services",
					createdAt: new Date()
				}))
				// Create test user
				.then(() => this.adapter.insert({
					username: "test",
					password: bcrypt.hashSync("test1234", 10),
					fullName: "Test user",
					email: "test@sandbox.moleculer.services",
					createdAt: new Date()
				}))

				// Create fake users
				.then(() => Promise.all(_.times(8, () => {
					return this.broker.call("fake.user").then(fakeUser => {
						return this.adapter.insert({
							username: fakeUser.userName,
							password: bcrypt.hashSync(fakeUser.password, 10),
							fullName: fakeUser.firstName + " " + fakeUser.lastName,
							email: fakeUser.email,
							avatar: fakeUser.avatar,
							createdAt: new Date(),
							updatedAt: null
						});
					});
				})))
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
