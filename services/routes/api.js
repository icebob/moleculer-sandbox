"use strict";

module.exports = {
	path: "/api",

	authorization: false,

	//roles: ["admin"],

	whitelist: [
		"posts.*"
	],
	aliases: {
		"REST posts": "posts"
	}
};