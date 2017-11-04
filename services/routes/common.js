"use strict";

const { ForbiddenError, UnAuthorizedError } = require("moleculer-web").Errors;

/**
 * Check the request is come from an authenticated user
 */
function isAuthenticated(req, res, next) {
	if (req.isAuthenticated())
		return next();

	return req.$service.sendError(req, res, new UnAuthorizedError());
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
				return next();

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
	isAuthenticated,
	hasRole,
	hasAdminRole
};