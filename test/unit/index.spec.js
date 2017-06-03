"use strict";

describe("Test myProject", () => {
	process.env.LOG_LEVEL = "error";

	const broker = require("../../");
	
	it("should be registered actions", () => {
		expect(broker).toBeDefined();
		expect(broker.hasAction("math.add")).toBeDefined();
		expect(broker.hasAction("test.greeter")).toBeDefined();
	});

});

