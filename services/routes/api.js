"use strict";

const common = require("./common");

module.exports = {
	path: "/api",

	use: [
		common.hasRole("user")
	],

	whitelist: [
		"posts.*"
	],

	aliases: {
		"REST posts": "posts"
	},

	onBeforeCall(ctx, route, req) {
		if (req.user)
			ctx.meta.user = req.user;
	}
	
};