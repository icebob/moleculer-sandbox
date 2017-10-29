"use strict";

module.exports = {
	path: "/api/admin",

	authorization: true,

	roles: ["user"],

	whitelist: [
		"posts.*",
		"users.*"
	],
	aliases: {
		"REST posts": "posts",
		"REST users": "users"
	}
};