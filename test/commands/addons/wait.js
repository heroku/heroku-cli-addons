'use strict'
/* globals describe context it expect beforeEach afterEach */

let fixtures = require('../../fixtures')
let cli = require('heroku-cli-util')
let nock = require('nock')
let cmd = require('../../../commands/addons/wait')
let _ = require('lodash')
const lolex = require('lolex')

let clock

describe('addons:wait', function () {
  beforeEach(function () {
    cli.mockConsole()
    cli.exit.mock()
    nock.cleanAll()
    clock = lolex.install()
    clock.setTimeout = function (fn, timeout) { fn() }
  })

  afterEach(function () {
    clock.uninstall()
  })

  context('waiting for an individual add-on', function () {
    context('when the add-on is provisioned', function () {
      beforeEach(function () {
        nock('https://api.heroku.com', {reqheaders: {'Accept-Expansion': 'addon_service,plan'}})
          .get('/apps/example/addons/www-db')
          .reply(200, fixtures.addons['www-db']) // provisioned
      })

      it('prints output indicating that it is done', function () {
        return cmd.run({flags: {}, args: {addon: 'www-db'}})
          .then(() => expect(cli.stdout, 'to equal', ''))
          .then(() => expect(cli.stderr, 'to equal', 'Done! www-db is provisioned'))
      })
    })
    context('for an add-on that is still provisioning', function () {
      it('waits until the add-on is provisioned, then shows config vars', function () {
        const expansionHeaders = {'Accept-Expansion': 'addon_service,plan'}
        // Call to resolve the add-on:
        let resolverResponse = nock('https://api.heroku.com')
          .get('/addons/www-redis')
          .reply(200, fixtures.addons['www-redis']) // provisioning

        let provisioningResponse = nock('https://api.heroku.com', {reqheaders: expansionHeaders})
          .get('/apps/acme-inc-www/addons/www-redis')
          .reply(200, fixtures.addons['www-redis']) // provisioning

        let provisionedAddon = _.clone(fixtures.addons['www-redis'])
        provisionedAddon.state = 'provisioned'

        let provisionedResponse = nock('https://api.heroku.com', {reqheaders: expansionHeaders})
          .get('/apps/acme-inc-www/addons/www-redis')
          .reply(200, provisionedAddon)

        return cmd.run({args: {addon: 'www-redis'}, flags: {'wait-interval': '1'}})
          .then(() => resolverResponse.done())
          .then(() => provisioningResponse.done())
          .then(() => provisionedResponse.done())
          .then(() => expect(cli.stdout).to.equal(''))
          .then(() => expect(cli.stderr).to.equal('Provisioning www-redis... done\n'))
      })
    })
    // it('shows that it failed to provision', function () {
    // return cmd.run({flags: {}, args: {addon: 'www-redis'}}).then(function () {
    // util.expectOutput(cli.stderr, 'error')
    // })
    // })
    // })
    // })
    context('when app is provided and multiple add-ons on app', function () {
      context('including add-ons still provisioning', function () {
      })
    })
  })
})
