'use strict'

const cli = require('heroku-cli-util')
const co = require('co')
let waitForAddonProvisioning = require('../../lib/addons_wait')

function parseConfig (args) {
  let config = {}
  while (args.length > 0) {
    let key = args.shift()
    if (!key.startsWith('--')) { throw new Error(`Unexpected argument ${key}`) }
    key = key.replace(/^--/, '')
    let val
    if (key.includes('=')) {
      [key, ...val] = key.split('=')
      val = val.join('=')
      config[key] = val
    } else {
      val = args.shift()
      if (!val) {
        config[key] = true
      } else if (val.startsWith('--')) {
        config[key] = true
        args.unshift(val)
      } else {
        config[key] = val
      }
    }
  }
  return config
}

function printDocsHelp (addon) {
  return cli.log(`Use ${cli.color.cmd('heroku addons:docs ' + addon.addon_service.name)} to view documentation`)
}

function * run (context, heroku) {
  const util = require('../../lib/util')

  let {app, flags, args} = context
  let {name, as, confirm} = flags
  let plan = {name: args[0]}
  let config = parseConfig(args.slice(1))

  let addon

  yield cli.action(`Creating ${plan.name} on ${cli.color.app(app)}`, co(function * () {
    addon = yield heroku.post(`/apps/${app}/addons`, {
      body: { config, name, confirm, plan, attachment: {name: as} },
      headers: {
        'accept-expansion': 'plan',
        'x-heroku-legacy-provider-messages': 'true'
      }
    })

    cli.action.done(cli.color.green(util.formatPrice(addon.plan.price)))
  }))

  if (!addon.config_vars || !addon.config_vars.length) { addon.config_vars = [] }
  let configVars = addon.config_vars.map(c => cli.color.configVar(c)).join(', ')

  switch (addon.state) {
    case 'provisioned':
      if (configVars.length) {
        cli.log(`Created ${cli.color.addon(addon.name)} as ${configVars}`)
      } else {
        cli.log(`Created ${cli.color.addon(addon.name)}`)
      }

      if (addon.provision_message) { cli.log(addon.provision_message) }
      printDocsHelp(addon)
      break
    case 'provisioning':
      if (context.flags.wait) {
        yield waitForAddonProvisioning(context, heroku, addon, 5)
      } else {
        cli.log(`Creating ${cli.color.addon(addon.name)}...`)
      }

      if (addon.provision_message) { cli.log(addon.provision_message) }

      if (configVars.length) {
        cli.log(`${cli.color.app(app)} will have ${configVars} set and restart when complete...`)
      } else {
        cli.log(`${cli.color.app(app)} will restart when complete...`)
      }

      if (!context.flags.wait) {
        cli.log(`Use ${cli.color.cmd('heroku addons:info ' + addon.name)} to check creation progress`)
      }
      printDocsHelp(addon)
      break
    case 'deprovisioned':
      throw new Error(`The add-on was unable to be created, with status ${addon.state}`)
  }
}

const cmd = {
  topic: 'addons',
  description: 'create an add-on resource',
  needsAuth: true,
  needsApp: true,
  args: [{name: 'service:plan'}],
  variableArgs: true,
  flags: [
    {name: 'name', description: 'name for the add-on resource', hasValue: true},
    {name: 'as', description: 'name for the initial add-on attachment', hasValue: true},
    {name: 'confirm', description: 'overwrite existing config vars or existing add-on attachments', hasValue: true},
    {name: 'wait', description: 'watch add-on creation status and exit when complete'}
  ],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'create'}, cmd),
  Object.assign({command: 'add', hidden: true}, cmd)
]
