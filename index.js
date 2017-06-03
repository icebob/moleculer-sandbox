"use strict";

const path = require("path");
const mkdir = require("mkdirp").sync;
const { ServiceBroker } = require("moleculer");

// Create data folder
mkdir(path.join(__dirname, "data"));

// Create broker
const broker = new ServiceBroker({
	logger: console,
	logLevel: process.env.LOG_LEVEL || "info"
});

// Load my service
broker.loadServices("./services");

// Start server
broker.start().then(() => {
	
	broker.repl();
});


module.exports = broker;