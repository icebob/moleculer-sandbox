"use strict";

const MailService = require("moleculer-mail");
const _ = require("lodash");

module.exports = {
	name: "mail",
	mixins: [MailService],
	settings: {
		from: "sandbox@moleculer.services",
		transport: {
			host: "smtp.mailtrap.io",
			port: 2525,
			auth: {
				user: process.env.MAILTRAP_USER,
				pass: process.env.MAILTRAP_PASS
			}			
		},
		templateFolder: "./views/mail-templates",

		// Common data
		data: {
			baseURL: "http://localhost:4000",
			siteName: "Sandbox"
		}
	},

	actions: {
		send: {
			handler(ctx) {
				const data = _.defaultsDeep(ctx.params.data || {}, this.settings.data);
				if (ctx.params.template) {
					const templateName = ctx.params.template;
					// Use templates
					const template = this.getTemplate(templateName);
					if (template) {
						// Render template
						return template.render(data, ctx.params.locale).then(rendered => {
							const params = _.omit(ctx.params, ["template", "locale", "data"]);
							params.html = rendered.html;
							if (rendered.text)
								params.text = rendered.text;
							if (rendered.subject)
								params.subject = rendered.subject;

							// Send e-mail
							return this.send(params);
						});
					}
					return this.Promise.reject(new Error("Missing e-mail template: " + templateName));

				} else {
					// Send e-mail
					return this.send(data);
				}
			}
		}		
	}
};