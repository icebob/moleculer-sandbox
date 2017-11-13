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
		seedDB() {
			this.logger.info("Seed Posts DB...");
			return this.broker.call("users.find").then(users => {
				if (users.length == 0) {
					this.logger.info("Waiting for `users` seed...");
					setTimeout(this.seedDB, 1000);
					return;
				}

				// Create fake posts
				return Promise.all(_.times(10, () => {
					return this.broker.call("fake.post").then(fakePost => {
						return this.adapter.insert({
							title: fakePost.title,
							content: fakePost.content,
							author: users[_.random(users.length - 1)]._id,
							votes: _.random(10), 
							createdAt: new Date(), 
							updatedAt: null
						});
					});
				})).then(() => {
					this.adapter.count().then(count => this.logger.info(`Generated ${count} posts!`));
				});

			}).catch(err => {
				if (err.name == "ServiceNotFoundError") {
					this.logger.info("Waiting for `users` service...");
					setTimeout(this.seedDB, 1000);
					return;
				} else
					return Promise.reject(err);
			});

		}
	},

	afterConnected() {
		return this.adapter.count().then(count => {
			if (count == 0) {
				this.seedDB();
			}
		});		
	}
	
};
