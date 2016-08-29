'use strict'

const co = require('co')
const cli = require('heroku-cli-util')

module.exports = function * (context, api, addon, interval) {
  const wait = require('co-wait')
  const app = addon.app.name
  const addonName = addon.name

  yield cli.action(`Provisioning ${cli.color.addon(addon.name)}...`, co(function * () {
    while (addon.state === 'provisioning') {
      yield wait(interval * 1000)

      addon = yield api.request({
        method: 'GET',
        path: `/apps/${app}/addons/${addonName}`,
        headers: {'Accept-Expansion': 'addon_service,plan'}
      })
    }

    if (addon.state === 'provisioned') return
    throw new Error(`The addon was unable to be created, with status ${addon.state}`)
  }))
}
