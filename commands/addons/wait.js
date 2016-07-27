'use strict'

const cli = require('heroku-cli-util')
const co = require('co')

function * run (context, heroku) {
  const wait = require('co-wait')

  cli.action('Waiting for addons', co(function * () {
    yield wait(1000)
    cli.action.status(`
-> walking-slow-123: Working
-> speaking-loud-456: Working`)
    yield wait(1000)
    cli.action.status(`
-> walking-slow-123: Working
-> speaking-loud-456: Provisioned`)
    yield wait(1000)
    cli.action.done(`
-> walking-slow-123: Provisioned
-> speaking-loud-456: Provisioned`)
  }))
}

module.exports = {
  topic: 'addons',
  command: 'wait',
  needsAuth: true,
  run: cli.command(co.wrap(run))
}
