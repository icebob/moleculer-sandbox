"use strict";

const { CustomError } = require("moleculer").Errors;

module.exports = {
	name: "math",
	actions: {
		add(ctx) {
			return Number(ctx.params.a) + Number(ctx.params.b);
		},

		sub(ctx) {
			return Number(ctx.params.a) - Number(ctx.params.b);
		},

		mult(ctx) {
			return Number(ctx.params.a) * Number(ctx.params.b);
		},

		div: {
			params: {
				a: { type: "number", convert: true },
				b: { type: "number", notEqual: 0, convert: true }
			},
			handler(ctx) {
				let a = Number(ctx.params.a);
				let b = Number(ctx.params.b);
				if (b != 0 && !Number.isNaN(b))
					return a / b;
				else
					throw new CustomError("Divide by zero!", 422, ctx.params);
			}
		}
	}
};
