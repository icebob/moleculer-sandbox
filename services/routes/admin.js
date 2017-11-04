"use strict";

const common = require("./common");

module.exports = {
	path: "/api/admin",

	use: [
		common.hasAdminRole()
	],

	whitelist: [
		"posts.*",
		"users.*"
	],

	aliases: {
		"REST posts": "posts",
		"REST users": "users"
	},
	
	onBeforeCall(ctx, route, req) {
		if (req.user)
			ctx.meta.user = req.use;
	}
};