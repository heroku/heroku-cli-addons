'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * run (context, heroku) {
  const util = require('../../lib/util')
  const sortBy = require('lodash.sortby')

  let plans = yield heroku.get(`/addon-services/${context.args.service}/plans`)
  plans = sortBy(plans, 'price.cents')

  if (context.flags.json) {
    cli.styledJSON(plans)
  } else {
    cli.table(plans, {
      columns: [
        {key: 'default', label: '', format: (d) => d ? 'default' : ''},
        {key: 'name', label: 'slug'},
        {key: 'human_name', label: 'name'},
        {key: 'price', format: util.formatPrice}
      ]
    })
  }
}

module.exports = {
  topic: 'addons',
  command: 'plans',
  description: 'list all available plans for an add-on services',
  args: [{name: 'service'}],
  flags: [
    {name: 'json', description: 'output in json format'}
  ],
  run: cli.command(co.wrap(run)),
  help: `Example:

    $ heroku addons:plans heroku-redis`
}
