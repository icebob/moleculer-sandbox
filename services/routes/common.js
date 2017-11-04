"use strict";

const cons 						= require("consolidate");
const path 						= require("path");

const { ForbiddenError, UnAuthorizedError } = require("moleculer-web").Errors;

/*
function renderer(type, folder) {
	const _render = cons[type];
	return function render(req, res, next) {
		res.render = function(file, opts) {
			_render(path.resolve(folder, file), opts || {}, (err, html) => {
				if (err) 
					return req.$service.sendError(req, res, err);
				
				res.writeHead(200, {
					"Content-type": "text/html"
				});
				res.end(html);

				req.$service.logResponse(req, res);
			});
		};

		next();
	};
}*/

/**
 * Check the request is come from an authenticated user
 */
function isAuthenticated(req, res, next) {
	if (req.isAuthenticated())
		return next();
	else {
		return req.$service.sendError(req, res, new UnAuthorizedError());
	}
}

/**
 * Check the requester user has a role.
 */
function hasRole(roleRequired) {
	if (!roleRequired)
		throw new Error("Required role needs to be set");

	return function(req, res, next) {
		return module.exports.isAuthenticated(req, res, () => {
			if (req.user && req.user.roles && req.user.roles.indexOf(roleRequired) !== -1)
				next();
			else
				return req.$service.sendError(req, res, new ForbiddenError());
		});
	};
}

/**
 * Check the requester user is an administrator. (they has `admin` role)
 */
function hasAdminRole() {
	return module.exports.hasRole("admin");
}

module.exports = {
	//renderer,
	isAuthenticated,
	hasRole,
	hasAdminRole
};