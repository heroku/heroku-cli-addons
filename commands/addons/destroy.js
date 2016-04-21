'use strict'

let cli = require('heroku-cli-util')
let co = require('co')

function * run (context, heroku) {
  if (context.args.length === 0) throw new Error('Missing add-on name')
}

let cmd = {
  topic: 'addons',
  description: 'destroy add-on resources',
  needsAuth: true,
  needsApp: true,
  flags: [
    {name: 'force', char: 'f', description: 'allow destruction even if connected to other apps'}
  ],
  variableArgs: true,
  run: cli.command({preauth: true}, co.wrap(run))
}

exports.destroy = Object.assign({}, cmd, {command: 'destroy'})
exports.remove = Object.assign({}, cmd, {command: 'remove'})
