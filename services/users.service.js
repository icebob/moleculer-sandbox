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
			// Create fake users
			return Promise.all(_.times(10, () => {
				return this.broker.call("fake.user").then(fakeUser => {
					return this.adapter.insert({
						username: fakeUser.userName,
						fullName: fakeUser.firstName + " " + fakeUser.lastName,
						email: fakeUser.email,
						createdAt: new Date(), 
						updatedAt: null
					});
				});
			})).then(() => {
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
