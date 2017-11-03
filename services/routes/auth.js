"use strict";

const { MoleculerClientError } 	= require("moleculer").Errors;
const common					= require("./common");

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
			usernameField: "username",
			passwordField: "password",
			passReqToCallback : true
		},
		verify(req, username, password, done) {
			this.broker.call("users.authenticate", { username, password })
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
		}, 
		verify(req, accessToken, refreshToken, profile, done) {
			this.logger.info("Received profile: ", profile);
			/*
			helper.linkToSocialAccount({
				req, 
				accessToken,
				refreshToken,
				profile,
				done,

				provider: "google",
				email: profile.emails[0].value,
				userData: {
					name: profile.displayName,
					gender: profile.gender,
					picture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value.replace("sz=50", "sz=200") : null,
					location: null
				}
			});
			*/
			return done(null, { profile });
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
		},
		verify(req, accessToken, refreshToken, profile, done) {
			this.logger.info("Received profile: ", profile);
			
			/*helper.linkToSocialAccount({
				req, 
				accessToken,
				refreshToken,
				profile,
				done,

				provider: "facebook",
				email: profile._json.email,
				userData: {
					name: profile.name.givenName + " " + profile.name.familyName,
					gender: profile._json.gender,
					picture: `https://graph.facebook.com/${profile.id}/picture?type=large`,
					location: (profile._json.location) ? profile._json.location.name : null
				}
			});*/

			return done(null, { profile });

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
		},
		verify(req, accessToken, refreshToken, profile, done) {
			this.logger.info("Received profile: ", profile);
			/*
			let email;
			if (profile.emails && profile.emails.length > 0) {
				email = profile.emails.find((email) => { return email.primary; });
				if (!email) email = profile.emails[0];
			}

			helper.linkToSocialAccount({
				req, 
				accessToken,
				refreshToken,
				profile,
				done,

				provider: "github",
				username: profile.username,
				email: email ? email.value : null,
				userData: {
					name: profile.displayName,
					gender: null,
					picture: profile._json.avatar_url,
					location: profile._json.location
				}
			});*/
			done(null, { profile });
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
		},
		verify(req, accessToken, refreshToken, profile, done) {
			this.logger.info("Received profile: ", profile);

			/*
			helper.linkToSocialAccount({
				req, 
				accessToken,
				refreshToken,
				profile,
				done,

				provider: "twitter",
				email: `${profile.username}@twitter.com`,
				username: profile.username,
				userData: {
					name: profile.displayName,
					gender: null,
					picture: profile._json.profile_image_url_https,
					location: profile._json.location
				}
			});
			*/
			done(null, { profile });
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

	if (!pp) {
		return this.sendError(req, res, new MoleculerClientError(`Invalid social auth provider '${provider}'`));
	}

	this.logger.info(`Social login with '${provider}'...`);
	passport.authenticate(provider, pp.authOptions)(req, res, err => {
		if (err)
			return this.sendError(req, res, err);

		// Successful authentication, redirect home.
		this.logger.info("Successful authentication");
		this.logger.info("User", req.user);
		this.sendRedirect(res, "/main", 302);
	});
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
	//const pp = Passports[provider];
	this.logger.info(`Social login callback for '${provider}' is fired.`);

	passport.authenticate(provider, { failureRedirect: "/login" })(req, res, (err) => {
		if (err)
			return this.sendError(req, res, err);

		// Successful authentication, redirect home.
		this.logger.info("Successful authentication");
		this.logger.info("User", req.user);
		this.sendRedirect(res, "/main", 302);
	});
}


const Auth = {
	route: {
		path: "/auth",

		whitelist: [
			"auth.login"
		],

		use: [
			...common.middlewares
		],

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
				passport.use(new pp.strategy(pp.strategyOptions, pp.verify.bind(this)));

				this.passports[provider] = pp;
			}
		});

		passport.serializeUser((user, done) => {
			this.logger.info("Serializer user:", user);
			return done(null, user._id ||user.profile.id);
		});

		passport.deserializeUser((id, done) => {
			this.logger.info("Deserializer user ID:", id);
			this.broker.call("users.get", { id })
				.then(user => {
					done(null, user);
				})
				.catch(err => done(err));
		});

	}
};

module.exports = Auth;