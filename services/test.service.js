"use strict";

module.exports = {
	name: "test",

	actions: {
		hello() {
			return "Hello Moleculer";
		},

		greeter: {
			params: {
				name: "string"
			},
			handler(ctx) {
				return `Hello ${ctx.params.name}`;
			}
		}
	}
};
