"use strict";

const path = require("path");
const _ = require("lodash");
const DbService = require("moleculer-db");

module.exports = {
	name: "posts",
	mixins: [DbService],
	dependencies: ["users", "fake"],
	adapter: new DbService.MemoryAdapter({ filename: path.resolve("data", "posts.db") }),

	settings: {
		fields: ["_id", "title", "content", "author", "votes", "createdAt", "updatedAt"],
		populates: {
			"author": {
				action: "users.get",				
				params: {
					fields: ["username", "fullName", "email"]
				}
			}
		}
	},

	methods: {
		async seedDB() {
			try {
				this.logger.info("Seed Posts DB...");
				const users = await this.broker.call("users.find");
				if (users.length == 0) {
					this.logger.info("Waiting for `users` seed...");
					setTimeout(this.seedDB, 1000);
					return;
				}

				// Create fake posts
				await Promise.all(_.times(10, async () => {
					const fakePost = await this.broker.call("fake.post");
					return this.adapter.insert({
						title: fakePost.title,
						content: fakePost.content,
						author: users[_.random(users.length - 1)]._id,
						votes: _.random(10), 
						createdAt: new Date(), 
						updatedAt: null
					});
				}));

				const count = await this.adapter.count();
				this.logger.info(`Generated ${count} posts!`);

			} catch(err) {
				if (err.name == "ServiceNotFoundError") {
					this.logger.info("Waiting for `users` service...");
					setTimeout(this.seedDB, 1000);
					return;
				} else
					throw err;
			}
		}
	},

	async afterConnected() {
		const count = await this.adapter.count();
		if (count == 0)
			this.seedDB();
	}
	
};
