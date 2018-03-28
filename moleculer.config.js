"use strict";

require("dotenv").config();

const path = require("path");
const mkdir = require("mkdirp").sync;

// Create data folder
mkdir(path.resolve("data"));

const Moleculer = require("moleculer");

module.exports = {
	namespace: "sandbox",
	nodeID: null,

	logger: true,
	logLevel: "debug",
	logFormatter: "default",

	//transporter: "NATS",
	
	//cacher: "Memory",

	serializer: null,

	requestTimeout: 0 * 1000,
	requestRetry: 0,
	maxCallLevel: 0,
	heartbeatInterval: 5,
	heartbeatTimeout: 15,

	disableBalancer: false,

	registry: {
		strategy: Moleculer.Strategies.RoundRobin,
		preferLocal: true				
	},

	circuitBreaker: {
		enabled: false,
		maxFailures: 3,
		halfOpenTime: 10 * 1000,
		failureOnTimeout: true,
		failureOnReject: true
	},

	validation: true,
	validator: null,
	metrics: true,
	metricsRate: 1,
	statistics: false,
	internalActions: true,

	hotReload: false
};