"use strict";

let { ServiceBroker } = require("moleculer");

// Create broker
let broker = new ServiceBroker({
	logger: console,
	logLevel: process.env.LOG_LEVEL || "info"
});

// Load my service
broker.loadServices("./services");

// Start server
broker.start().then(() => {

});

module.exports = broker;