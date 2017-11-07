"use strict";

const { MoleculerClientError } 	= require("moleculer").Errors;

const passport 					= require("passport");
const LocalStrategy 			= require("passport-local").Strategy;
const GoogleStrategy 			= require("passport-google-oauth20").Strategy;
const FacebookStrategy  		= require("passport-facebook").Strategy;
const GithubStrategy  			= require("passport-github").Strategy;
const TwitterStrategy 			= require("passport-twitter").Strategy;

// https://medium.com/netscape/building-a-budget-manager-with-vue-js-and-node-js-part-i-f3d7311822a8
// https://medium.com/@gdomaradzki/building-a-budget-manager-with-vue-js-and-node-js-part-ii-f08c410c944d
// https://medium.com/@gdomaradzki/building-a-budget-manager-with-vue-js-and-node-js-part-iii-540a77a7ddee


const Passports = {
	"local": {
		enabled: true,
		strategy: LocalStrategy,
		strategyOptions: {
			usernameField: "email",
			passwordField: "password",
			passReqToCallback : true
		},
		verify(req, email, password, done) {
			// TODO: not working without password (passport-local)
			this.broker.call("account.login", { email, password })
				.then(user => done(null, user))
				.catch(err => done(err));
		}
	},

	// https://console.developers.google.com/project/express-mongo-boilerplate/apiui/consent
	"google": {
		enabled: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
		strategy: GoogleStrategy,
		authOptions: { scope: "profile email" },
		strategyOptions: {
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: "/auth/google/callback",
			passReqToCallback: true
		}
	},
	
	// https://developers.facebook.com/apps/
	"facebook": {
		enabled: process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET,
		strategy: FacebookStrategy,
		authOptions: {
			scope: ["email", "user_location"]
		},
		strategyOptions: {
			clientID: process.env.FACEBOOK_CLIENT_ID,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
			callbackURL: "/auth/facebook/callback",
			profileFields: ["name", "email", "link", "locale", "timezone"],
			passReqToCallback: true
		}
	},

	// https://github.com/settings/applications/new
	"github": {
		enabled: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
		strategy: GithubStrategy,
		authOptions: {
			scope: "user:email"
		},
		strategyOptions: {
			clientID: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
			callbackURL: "/auth/github/callback",
			scope: [ "user:email" ],
			passReqToCallback: true
		}
	},

	// https://apps.twitter.com/app/new
	"twitter": {
		enabled: process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET,
		strategy: TwitterStrategy,
		authOptions: null,
		strategyOptions: {
			consumerKey: process.env.TWITTER_CLIENT_ID,
			consumerSecret: process.env.TWITTER_CLIENT_SECRET,
			callbackURL: "/auth/twitter/callback",
			passReqToCallback: true
		}
	}
};

/**
 * Social login handler
 * 
 * @param {any} route 
 * @param {any} req 
 * @param {any} res 
 * @param {any} params 
 * @returns 
 */
function socialLogin(req, res) {
	const provider = req.$params.provider;
	const pp = this.passports[provider];

	if (!pp)
		return this.sendError(req, res, new MoleculerClientError(`Invalid social auth provider '${provider}'`));

	passport.authenticate(provider, pp.authOptions)(req, res, err => handleLoginCallback.call(this, req, res, provider, err));
}

/**
 * Social login callback handler
 * 
 * @param {any} route 
 * @param {any} req 
 * @param {any} res 
 * @param {any} params 
 */	
function socialLoginCallback(req, res) {
	const provider = req.$params.provider;
	passport.authenticate(provider, {})(req, res, err => handleLoginCallback.call(this, req, res, provider, err));
}

/**
 * Handle passport auth callback
 * @param {*} req 
 * @param {*} res 
 * @param {*} provider 
 * @param {*} err 
 */
function handleLoginCallback(req, res, provider, err) {
	if (err) {
		if (err.type == "MAGIC_LINK_SENT") {
			// Passwordless login
			req.flash("info", err.message);
			return this.sendRedirect(res, "/login");
		}
		req.flash("error", err.message);
		if (req.user)
			// Linking error
			return this.sendRedirect(res, "/");
		else
			return this.sendRedirect(res, "/login");
	}
		
	// Successful authentication, redirect home.
	this.logger.info(`Successful authentication with '${provider}'.`);
	this.logger.info("User", req.user);
	this.sendRedirect(res, "/", 302);
}


const Auth = {
	route: {
		path: "/auth",

		aliases: {
			"/:provider": socialLogin,
			"GET /:provider/callback": socialLoginCallback,
		},

		// Use bodyparser modules
		bodyParsers: {
			json: true,
			urlencoded: { extended: true }
		}
	},

	initialize() {
		this.passports = {};

		Object.keys(Passports).forEach(provider => {
			const pp = Passports[provider];
			
			if (pp.enabled) {
				this.logger.info("Register Passport provider:", provider);
				const verify = pp.verify || function verify(req, accessToken, refreshToken, profile, done) {
					this.logger.info(`Received '${profile.provider}' profile: `, profile);

					return this.broker.call("account.socialLogin", {
						provider: profile.provider,
						profile,
						accessToken,
						refreshToken
					}, { meta: { user: req.user }})
						.then(user => done(null, user))
						.catch(done);
				};
				passport.use(new pp.strategy(pp.strategyOptions, verify.bind(this)));

				this.passports[provider] = pp;
			}
		});

		passport.serializeUser((user, done) => done(null, user._id));

		passport.deserializeUser((id, done) => {
			this.broker.call("users.get", { id })
				.then(user => done(null, user))
				.catch(done);
		});

	}
};

module.exports = Auth;