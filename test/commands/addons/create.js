'use strict'
/* globals commands it describe context beforeEach afterEach cli nock */

const cmd = commands.find(c => c.topic === 'addons' && c.command === 'create')
const expect = require('unexpected')
const _ = require('lodash')

describe('addons:create', () => {
  let api

  let addon = {
    id: 201,
    name: 'db3-swiftly-123',
    addon_service: {name: 'heroku-db3'},
    app: {name: 'myapp', id: 101},
    config_vars: ['DATABASE_URL'],
    plan: {price: {cents: 10000, unit: 'month'}},
    state: 'provisioned',
    provision_message: 'provision message'
  }

  beforeEach(() => {
    cli.mockConsole()
    api = nock('https://api.heroku.com:443')
  })

  afterEach(() => {
    api.done()
    nock.cleanAll()
  })

  context('creating a db', () => {
    beforeEach(() => {
      api.post('/apps/myapp/addons', {
        attachment: {name: 'mydb'},
        config: {follow: 'otherdb', rollback: true, foo: true},
        plan: {name: 'heroku-postgresql:standard-0'}
      })
      .reply(200, addon)
    })

    it('creates an add-on with proper output', () => {
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
    })
  })

  context('when add-on is async', () => {
    context('provisioning message and config vars provided by add-on provider', () => {
      beforeEach(() => {
        let asyncAddon = _.clone(addon)

        asyncAddon.state = 'provisioning'

        api.post('/apps/myapp/addons', {
          attachment: {name: 'mydb'},
          config: {},
          plan: {name: 'heroku-postgresql:standard-0'}
        })
        .reply(200, asyncAddon)
      })

      it('creates an add-on with output about async provisioning', () => {
        return cmd.run({
          app: 'myapp',
          args: ['heroku-postgresql:standard-0'],
          flags: {as: 'mydb'}
        })
          .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
          .then(() => expect(cli.stdout, 'to equal', `Provisioning db3-swiftly-123...
provision message
myapp will have DATABASE_URL set and restart when complete...
Use heroku addons:info to check provisioning progress
Use heroku addons:docs heroku-db3 to view documentation
`))
      })
    })
    context('and no provision message supplied', () => {
      beforeEach(() => {
        let asyncAddon = _.clone(addon)

        asyncAddon.state = 'provisioning'
        asyncAddon.provision_message = undefined

        api.post('/apps/myapp/addons', {
          attachment: {name: 'mydb'},
          config: {},
          plan: {name: 'heroku-postgresql:standard-0'}
        })
        .reply(200, asyncAddon)
      })

      it('creates an add-on with output about async provisioning', () => {
        return cmd.run({
          app: 'myapp',
          args: ['heroku-postgresql:standard-0'],
          flags: {as: 'mydb'}
        })
          .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
          .then(() => expect(cli.stdout, 'to equal', `Provisioning db3-swiftly-123...
myapp will have DATABASE_URL set and restart when complete...
Use heroku addons:info to check provisioning progress
Use heroku addons:docs heroku-db3 to view documentation
`))
      })
    })
    context('and no config vars supplied by add-on provider', () => {
      beforeEach(() => {
        let asyncAddon = _.clone(addon)

        asyncAddon.state = 'provisioning'
        asyncAddon.config_vars = undefined

        api.post('/apps/myapp/addons', {
          attachment: {name: 'mydb'},
          config: {},
          plan: {name: 'heroku-postgresql:standard-0'}
        })
        .reply(200, asyncAddon)
      })

      it('creates an add-on with output about async provisioning', () => {
        return cmd.run({
          app: 'myapp',
          args: ['heroku-postgresql:standard-0'],
          flags: {as: 'mydb'}
        })
          .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
          .then(() => expect(cli.stdout, 'to equal', `Provisioning db3-swiftly-123...
provision message
myapp will restart when complete...
Use heroku addons:info to check provisioning progress
Use heroku addons:docs heroku-db3 to view documentation
`))
      })
    })
  })

  context('--follow=--otherdb', () => {
    beforeEach(() => {
      api.post('/apps/myapp/addons', {
        attachment: {name: 'mydb'},
        config: {follow: '--otherdb', rollback: true, foo: true},
        plan: {name: 'heroku-postgresql:standard-0'}
      })
      .reply(200, addon)
    })

    it('creates an addon with =-- args', () => {
      return cmd.run({
        app: 'myapp',
        args: ['heroku-postgresql:standard-0', '--rollback', '--follow=--otherdb', '--foo'],
        flags: {as: 'mydb'}
      })
    })
  })
  context('no config vars supplied by add-on provider', () => {
    beforeEach(() => {
      let noConfigAddon = _.clone(addon)
      noConfigAddon.config_vars = undefined

      api.post('/apps/myapp/addons', {
        attachment: {name: 'mydb'},
        config: {},
        plan: {name: 'heroku-postgresql:standard-0'}
      })
      .reply(200, noConfigAddon)
    })

    it('creates an add-on without the config vars listed', () => {
      return cmd.run({
        app: 'myapp',
        args: ['heroku-postgresql:standard-0'],
        flags: {as: 'mydb'}
      })
        .then(() => expect(cli.stderr, 'to equal', 'Creating heroku-postgresql:standard-0 on myapp... $100/month\n'))
        .then(() => expect(cli.stdout, 'to equal', `Created db3-swiftly-123
provision message
Use heroku addons:docs heroku-db3 to view documentation
`))
    })
  })
})
