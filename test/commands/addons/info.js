'use strict'
/* global describe afterEach beforeEach it */

let cmd = require('../../..').commands.find((c) => c.topic === 'addons' && c.command === 'info')
let expect = require('unexpected')
let nock = require('nock')
let cli = require('heroku-cli-util')

describe('addons:info', () => {
  beforeEach(() => {
    cli.mockConsole()
  })
  afterEach(() => {
    nock.cleanAll()
  })

  it('shows addon info', () => {
    let d = new Date()
    let api = nock('http://api.heroku.com:443')
    .get('/addons/redis-123')
    .reply(200, {id: '100', name: 'redis-123', plan: {name: 'redis-plan', price: {cents: 1000, unit: 'month'}}, app: {name: 'myapp'}, created_at: d})
    .get('/addons/100/addon-attachments')
    .reply(200, [{name: 'redis-124', app: {name: 'myotherapp'}}])
    return cmd.run({app: 'myapp', args: {addon: 'redis-123'}, flags: {}})
    .then(() => expect(cli.stdout, 'to equal', `=== redis-123
Attachments:  myotherapp::redis-124
Installed at: ${d.toString()}
Owning app:   myapp
Plan:         redis-plan
Price:        $10/month
`))
    .then(() => expect(cli.stderr, 'to be empty'))
    .then(() => api.done())
  })
})
