"use strict";

const { serveStatic } = require("moleculer-web");
const path = require("path");
const cons = require("consolidate");

function renderer(type, folder) {
	const _render = cons[type];
	return function render(req, res, next) {
		res.render = function(file, opts) {
			_render(path.resolve(folder, file), opts, (err, html) => {
				if (err) 
					throw err;
				
				res.writeHead(200, {
					"Content-type": "text/html"
				});
				res.end(html);

				req.service.logResponse(req, res);
			});
		};

		next();
	};
}


module.exports = {
	path: "/",

	authorization: false,

	use: [
		renderer("jade", "./views"),
		serveStatic(path.resolve("./www"))
	],

	aliases: {
		"/main"(route, req, res) {
			res.render("main.jade", { name: "Norbi" });
		}
	}
};