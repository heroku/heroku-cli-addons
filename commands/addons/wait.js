'use strict'

let cli = require('heroku-cli-util')
let co = require('co')
let waitForAddonProvisioning = require('../../lib/addons_wait')

function * run (ctx, api) {
  const resolve = require('../../lib/resolve')
  let addon = yield resolve.addon(api, ctx.app, ctx.args.addon, {'Accept-Expansion': 'addon_service,plan'})

  let interval = parseInt(ctx.flags['wait-interval'])
  if (!interval || interval < 0) { interval = 5 }

  addon = yield waitForAddonProvisioning(ctx, api, addon, interval)

  let configVars = (addon.config_vars || [])
  if (configVars.length > 0) {
    configVars = configVars.map(c => cli.color.configVar(c)).join(', ')
    cli.log(`Created ${cli.color.addon(addon.name)} as ${configVars}`)
  }
}

let topic = 'addons'

module.exports = {
  topic: topic,
  command: 'wait',
  wantsApp: true,
  needsAuth: true,
  args: [{name: 'addon'}],
  flags: [{name: 'wait-interval', description: 'how frequently to poll in seconds', hasValue: true}],
  run: cli.command({preauth: true}, co.wrap(run)),
  usage: `${topic}:wait ADDON`,
  description: 'Show provisioning status of the add-ons on the app'
}
