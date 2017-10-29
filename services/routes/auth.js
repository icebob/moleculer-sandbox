"use strict";

const ApiGateway 			= require("moleculer-web");

const session 				= require("express-session");
const cookieParser 			= require("cookie-parser");

const passport 				= require("passport");
const GoogleStrategy 		= require("passport-google-oauth20").Strategy;

// https://console.developers.google.com/project/express-mongo-boilerplate/apiui/consent
passport.use(new GoogleStrategy({
	clientID: process.env.GOOGLE_CLIENT_ID,
	clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	callbackURL: "/auth/social/google/callback",
	passReqToCallback: true
},
	function (req, accessToken, refreshToken, profile, done) {
		console.log("accessToken", accessToken);
		console.log("refreshToken", refreshToken);
		console.log("profile", profile);
		return done(null, {});
	}
));

passport.serializeUser(function(user, done) {
	return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	/*User.findOne({
		_id: id
	}, "-password", function(err, user) {
		if (err)
			return done(err);
		
		// Check that the user is not disabled or deleted
		if (user.status !== 1)
			return done(null, false);

		return done(null, user);
	});*/
	done(null, {});
});


module.exports = {
	path: "/auth",

	whitelist: [
		"auth.login"
	],

	use: [
		// parse cookie from header
		cookieParser(),

		// initialize session
		session({
			secret: "moleculer-sandbox",
			resave: false,
			saveUninitialized: true
		}),

		// passport init
		passport.initialize(),
		passport.session()
	],

	aliases: {
		"POST /local": "auth.login",
		"GET /social/:provider"(route, req, res) {
			this.logger.info("socialLogin");
			passport.authenticate("google", { scope: "profile email" })(req, res, err => {
				this.logger.info("Next", err);
				res.writeHead(200);
				res.end();
			});
			
		},
		"GET /social/:provider/callback"(route, req, res) {
			this.logger.info("socialLoginCallback");
			passport.authenticate("google", { failureRedirect: "/login" })(req, res, () => {
				// Successful authentication, redirect home.
				this.logger.info("Successful authentication");
				this.sendRedirect(res, "/", 302);
			});
		}
	},

	// Use bodyparser module
	bodyParsers: {
		json: true,
		urlencoded: { extended: true }
	}

};