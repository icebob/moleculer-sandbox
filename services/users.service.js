"use strict";

const path = require("path");
const _ = require("lodash");
const DbService = require("moleculer-db");

module.exports = {
	name: "users",
	mixins: DbService,
	adapter: new DbService.MemoryAdapter({ filename: path.join(__dirname, "..", "data", "users.db") }),

	methods: {
		seedDB() {
			this.logger.info("Seed Users DB...");
			// Create admin user
			return Promise.resolve()
				.then(() => this.adapter.insert({
					username: "admin",
					password: "admin1234",
					fullName: "Administrator",
					email: "admin@sandbox.moleculer.services",
					createdAt: new Date()
				}))
				.then(() => this.adapter.insert({
					username: "test",
					password: "test1234",
					fullName: "Test user",
					email: "test@sandbox.moleculer.services",
					createdAt: new Date()
				}))
				// Create fake users
				.then(() => Promise.all(_.times(8, () => {
					return this.broker.call("fake.user").then(fakeUser => {
						return this.adapter.insert({
							username: fakeUser.userName,
							password: fakeUser.password,
							fullName: fakeUser.firstName + " " + fakeUser.lastName,
							email: fakeUser.email,
							createdAt: new Date(), 
							updatedAt: null
						});
					});
				})))
				.then(() => {
					this.adapter.findAll({}).then(res => console.log(`Generated ${res.length} users!`));
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
