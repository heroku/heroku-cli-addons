'use strict'
/* globals commands it describe beforeEach afterEach cli nock */

const cmd = commands.find(c => c.topic === 'addons' && c.command === 'create')
const expect = require('unexpected')

describe('addons:create', () => {
  let api

  let addon = {
    id: 201,
    name: 'db3-swiftly-123',
    addon_service: {name: 'heroku-db3'},
    app: {name: 'myapp', id: 101},
    config_vars: ['DATABASE_URL'],
    plan: {price: {cents: 10000, unit: 'month'}},
    provision_message: 'provision message'
  }

  beforeEach(() => {
    cli.mockConsole()
    api = nock('https://api.heroku.com:443')
    .post('/apps/myapp/addons', {
      attachment: {name: 'mydb'},
      config: {follow: 'otherdb', rollback: true, foo: true},
      plan: {name: 'heroku-postgresql:standard-0'}
    })
    .reply(200, addon)
  })

  afterEach(() => {
    api.done()
    nock.cleanAll()
  })

  it('creates an add-on', () => {
    return cmd.run({
      app: 'myapp',
      args: ['heroku-postgresql:standard-0', '--rollback', '--follow', 'otherdb', '--foo'],
      flags: {as: 'mydb'}
    })
      .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
      .then(() => expect(cli.stdout, 'to equal', `Created db3-swiftly-123 as DATABASE_URL
provision message
Use heroku addons:docs heroku-db3 to view documentation
`))
  })

  it('creates an addon with = args', () => {
    return cmd.run({
      app: 'myapp',
      args: ['heroku-postgresql:standard-0', '--rollback', '--follow=otherdb', '--foo'],
      flags: {as: 'mydb'}
    })
      .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
      .then(() => expect(cli.stdout, 'to equal', `Created db3-swiftly-123 as DATABASE_URL
provision message
Use heroku addons:docs heroku-db3 to view documentation
`))
  })
})
