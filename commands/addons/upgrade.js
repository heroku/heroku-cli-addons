'use strict';

let cli      = require('heroku-cli-util');
let co       = require('co');
let resolver = require('../../lib/resolve');
let _        = require('lodash');

let formatPrice = p => p.cents === 0 ? 'free' : `$${(p.cents/100)}.00/${p.unit}`;

class Upgrade {
  run (context, heroku) {
    return co(function* () {
      this.context = context;
      this.heroku  = heroku;
      this.app     = context.app;
      this.name    = context.args.addon;
      this.plan    = context.args.plan;

      // called with just one argument in the form of `heroku addons:upgrade heroku-redis:hobby`
      if (!this.plan && this.name.indexOf(':') !== -1) {
        let s = this.name.split(':');
        this.name = s[0];
        this.plan = s[1];
      }

      if (!this.plan) this.noPlanError();
      // ignore the service part of the plan since we can infer the service based on the add-on
      if (this.plan.indexOf(':') !== -1) this.plan = this.plan.split(':')[1];

      // find the add-on to be changed
      this.addon = yield resolver.addon(heroku, this.app, this.name).catch(e => this.handleAPIError(e));

      this.service = this.addon.addon_service.name;
      this.app     = this.addon.app.name;
      this.plan    = `${this.service}:${this.plan}`;
      this.addon = yield cli.action(`Changing ${cli.color.magenta(this.addon.name)} on ${cli.color.cyan(this.app)} from ${cli.color.yellow(this.addon.plan.name)} to ${cli.color.blue(this.plan)}`, {success: false},
        heroku.request({
          path: `/apps/${this.app}/addons/${this.addon.name}`,
          method: 'PATCH',
          body: {plan: {name: this.plan}},
          headers: {
            'Accept-Expansion': 'plan',
            'X-Heroku-Legacy-Provider-Messages': 'true',
          }
        }).catch(e => this.handlePlanChangeAPIError(e))
      );
      cli.console.error(`done, ${cli.color.green(formatPrice(this.addon.plan.price))}`);
      if (this.addon.provision_message) cli.log(this.addon.provision_message);
    }.bind(this));
  }

  noPlanError () {
    throw new Error(`Error: No plan specified.
You need to specify a plan to move ${cli.color.yellow(this.name)} to.
For example: ${cli.color.blue('heroku addons:upgrade heroku-redis:premium-0')}

${cli.color.cyan('https://devcenter.heroku.com/articles/managing-add-ons')}`);
  }

  handlePlanChangeAPIError (err) {
    if (err.statusCode === 422 && err.body.message && err.body.message.startsWith('Couldn\'t find either the add-on')) {
      return this.heroku.get(`/addon-services/${this.service}/plans`)
      .then(plans => {
        plans = _.sortBy(plans, 'price.cents').map(plans => plans.name);
        throw new Error(`${err.body.message}

Here are the available plans for ${cli.color.yellow(this.service)}:
${plans.join('\n')}

See more plan information with ${cli.color.blue('heroku addons:plans '+this.service)}

${cli.color.cyan('https://devcenter.heroku.com/articles/managing-add-ons')}`);
      });
    }
    throw err;
  }

  handleAPIError (err) {
    if (err.statusCode === 422 && err.body.id === 'multiple_matches') {
      let example = err.body.message.split(', ')[2] || 'redis-triangular-1234';
      throw new Error(`${err.body.message}

Multiple add-ons match ${cli.color.yellow(this.name)}${this.app ? ' on '+this.app : ''}
It is not clear which add-on\'s plan you are trying to change.

Specify the add-on name instead of the name of the add-on service.
For example, instead of: ${cli.color.blue('heroku addons:upgrade '+this.context.args.addon+' '+(this.context.args.plan || ''))}
Run this: ${cli.color.blue('heroku addons:upgrade '+example + ' ' + this.name + ':' + this.plan)}
${!this.app ? 'Alternatively, specify an app to filter by with '+cli.color.blue('--app') : ''}
${cli.color.cyan('https://devcenter.heroku.com/articles/managing-add-ons')}`);
    }
    throw err;
  }
}

let cmd = {
  topic: 'addons',
  description: 'change add-on plan',
  help: `
See available plans with \`heroku addons:plans SERVICE\`.

Note that \`heroku addons:upgrade\` and \`heroku addons:downgrade\` are the same.
Either one can be used to change an add-on plan up or down.

https://devcenter.heroku.com/articles/managing-add-ons

Examples:

  Upgrade an add-on by service name:

  $ heroku addons:upgrade heroku-redis:premium-2

  Upgrade a specific add-on:

  $ heroku addons:upgrade swimming-briskly-123 heroku-redis:premium-2
  `,
  needsAuth: true,
  wantsApp: true,
  args: [{name: 'addon'}, {name: 'plan', optional: true}],
  run: cli.command((context, heroku) => (new Upgrade()).run(context, heroku))
};

exports.upgrade   = Object.assign({command: 'upgrade'  }, cmd);
exports.downgrade = Object.assign({command: 'downgrade'}, cmd);
