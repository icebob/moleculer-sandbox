"use strict";

let ApiGateway = require("moleculer-web");

module.exports = {
	name: "api",
	mixins: ApiGateway,
	settings: {
		port: process.env.PORT || 3000,

		routes: [{
			aliases: {
				"REST posts": "posts",
				"REST users": "users"
			}
		}]
	}
};
