'use strict'
/* globals describe it context beforeEach */

let cli = require('heroku-cli-util')
let cmd = require('../../commands/addons')
let expect = require('chai').expect
let fixtures = require('../fixtures')
let nock = require('nock')
let util = require('../util')

describe('addons --app', function () {
  function mockAPI (appName, addons, attachments) {
    addons = addons || []
    attachments = attachments || []

    nock('https://api.heroku.com', {reqheaders: {'Accept-Expansion': 'addon_service,plan'}})
      .get(`/apps/${appName}/addons`)
      .reply(200, addons)

    nock('https://api.heroku.com')
      .get('/addon-attachments')
      .reply(200, attachments)
  }

  beforeEach(() => cli.mockConsole())

  function run (app, cb) {
    return cmd.run({flags: {}, app: app}).then(cb)
  }

  it('prints message when there are no add-ons', function () {
    let appName = 'acme-inc-www'

    mockAPI(appName)

    return run(appName, function () {
      util.expectOutput(cli.stdout, 'No add-ons for app acme-inc-www.')
    })
  })

  context('with add-ons', function () {
    it('prints add-ons in a table with attachments', function () {
      mockAPI('acme-inc-www', [
        fixtures.addons['www-db'],
        fixtures.addons['www-redis']
      ], [
        fixtures.attachments['acme-inc-www::DATABASE'],
        fixtures.attachments['acme-inc-www::REDIS']
      ])

      return run('acme-inc-www', function () {
        util.expectOutput(cli.stdout, `
Add-on                      Plan       Price      State
──────────────────────────  ─────────  ─────────  ────────────
heroku-postgresql (www-db)  hobby-dev  free       provisioned
 └─ as DATABASE

heroku-redis (www-redis)    premium-2  $60/month  provisioning
 └─ as REDIS

The table above shows add-ons and the attachments to the current app (acme-inc-www) or other apps.
                `)
      })
    })

    it('shows attachments to foreign apps for owned add-ons', function () {
      mockAPI('acme-inc-www', [fixtures.addons['www-db']], [
        fixtures.attachments['acme-inc-www::DATABASE'],
        fixtures.attachments['acme-inc-dwh::WWW_DB']
      ])
      return run('acme-inc-www', function () {
        util.expectOutput(cli.stdout, `
Add-on                             Plan       Price  State
─────────────────────────────────  ─────────  ─────  ───────────
heroku-postgresql (www-db)         hobby-dev  free   provisioned
 ├─ as DATABASE
 └─ as WWW_DB on acme-inc-dwh app

The table above shows add-ons and the attachments to the current app (acme-inc-www) or other apps.
`)
      })
    })

    it('shows add-ons owned by foreign apps if attached to targeted app', function () {
      mockAPI('acme-inc-dwh', [fixtures.addons['www-db']], [
        fixtures.attachments['acme-inc-www::DATABASE'],
        fixtures.attachments['acme-inc-dwh::WWW_DB']
      ])

      return run('acme-inc-dwh', function () {
        util.expectOutput(cli.stdout, `
Add-on                               Plan       Price                         State
───────────────────────────────────  ─────────  ────────────────────────────  ───────────
heroku-postgresql (www-db)           hobby-dev  (billed to acme-inc-www app)  provisioned
 ├─ as WWW_DB
 └─ as DATABASE on acme-inc-www app

The table above shows add-ons and the attachments to the current app (acme-inc-dwh) or other apps.
                `)
      })
    })

    it("doesn't show attachments that are not related to the targeted app", function () {
      mockAPI('acme-inc-dwh', [], [fixtures.attachments['acme-inc-www::DATABASE']])

      return run('acme-inc-dwh', function () {
        util.expectOutput(cli.stdout, 'No add-ons for app acme-inc-dwh.')
      })
    })

    describe('attachment app info', function () {
      beforeEach(function () {
        mockAPI('acme-inc-dwh', [fixtures.addons['www-db']], [
          fixtures.attachments['acme-inc-www::DATABASE'],
          fixtures.attachments['acme-inc-dwh::WWW_DB']
        ])
      })

      it('omits attachment app for local attachments', function () {
        return run('acme-inc-dwh', function () {
          expect(cli.stdout).to.match(/├─ as WWW_DB\s*$/m)
        })
      })

      it('includes app name for foreign attachments', function () {
        return run('acme-inc-dwh', function () {
          expect(cli.stdout).to.match(/└─ as DATABASE on acme-inc-www app\s*$/m)
        })
      })
    })

    describe('sorting', function () {
      context('add-ons', function () {
        it('sorts owned add-ons first, foreign add-ons second', function () {
          mockAPI('acme-inc-dwh', [
            fixtures.addons['dwh-db'],
            fixtures.addons['www-db']
          ], [
            fixtures.attachments['acme-inc-dwh::DATABASE'],
            fixtures.attachments['acme-inc-dwh::WWW_DB']
          ])

          return run('acme-inc-dwh', function () {
            expect(cli.stdout.indexOf('dwh-db')).to.be.lt(cli.stdout.indexOf('www-db'))
          })
        })

        it('sorts add-ons of same ownership by service', function () {
          mockAPI('acme-inc-www', [
            fixtures.addons['www-redis'],
            fixtures.addons['www-db']
          ], [
            fixtures.attachments['acme-inc-www::REDIS'],
            fixtures.attachments['acme-inc-www::DATABASE']
          ])

          return run('acme-inc-www', function () {
            expect(cli.stdout.indexOf('heroku-postgresql')).to.be.lt(cli.stdout.indexOf('heroku-redis'))
          })
        })

        it('sorts add-ons of same ownership and service by plan', function () {
          mockAPI('acme-inc-dwh', [
            fixtures.addons['dwh-db'],
            fixtures.addons['dwh-test-db']
          ], [
            fixtures.attachments['acme-inc-dwh::DATABASE'],
            fixtures.attachments['acme-inc-dwh::TEST']
          ])

          return run('acme-inc-dwh', function () {
            expect(cli.stdout.indexOf('hobby-dev')).to.be.lt(cli.stdout.indexOf('standard-2'))
          })
        })

        it('sorts add-ons of same ownership and service and plan by name', function () {
          mockAPI('acme-inc-dwh', [
            fixtures.addons['dwh-db-2'],
            fixtures.addons['dwh-db']
          ], [
            fixtures.attachments['acme-inc-dwh::DATABASE'],
            fixtures.attachments['acme-inc-dwh::DATABASE_FOLLOWER']
          ])

          return run('acme-inc-dwh', function () {
            expect(cli.stdout.indexOf('(dwh-db)')).to.be.lt(cli.stdout.indexOf('(dwh-db-2)'))
          })
        })
      })

      context('attachments', function () {
        it('sorts local attachments first', function () {
          mockAPI('acme-inc-dwh', [
            fixtures.addons['www-db']
          ], [
            fixtures.attachments['acme-inc-www::DATABASE'],
            fixtures.attachments['acme-inc-dwh::WWW_DB']
          ])

          return run('acme-inc-dwh', function () {
            expect(cli.stdout.indexOf('as WWW_DB')).to.be.lt(cli.stdout.indexOf('as DATABASE on acme-inc-www app'))
          })
        })

        it('sorts local attachments by name', function () {
          mockAPI('acme-inc-www', [fixtures.addons['www-db']], [
            fixtures.attachments['acme-inc-www::HEROKU_POSTGRESQL_RED'],
            fixtures.attachments['acme-inc-www::DATABASE']
          ])

          return run('acme-inc-www', function () {
            expect(cli.stdout.indexOf('DATABASE')).to.be.lt(cli.stdout.indexOf('HEROKU_POSTGRESQL_RED'))
          })
        })

        it('sorts foreign attachments by app', function () {
          mockAPI('acme-inc-api', [fixtures.addons['www-db']], [
            fixtures.attachments['acme-inc-api::WWW_DB'],
            fixtures.attachments['acme-inc-dwh::WWW_DB'],
            fixtures.attachments['acme-inc-www::DATABASE']
          ])

          return run('acme-inc-api', function () {
            expect(cli.stdout.indexOf('as WWW_DB on acme-inc-dwh')).to.be.lt(cli.stdout.indexOf('as DATABASE on acme-inc-www'))
          })
        })

        it('sorts foreign attachments for same app by name', function () {
          mockAPI('acme-inc-api', [fixtures.addons['www-db']], [
            fixtures.attachments['acme-inc-api::WWW_DB'],
            fixtures.attachments['acme-inc-www::DATABASE'],
            fixtures.attachments['acme-inc-www::HEROKU_POSTGRESQL_RED']
          ])

          return run('acme-inc-api', function () {
            expect(cli.stdout.indexOf('as DATABASE on acme-inc-www')).to.be.lt(cli.stdout.indexOf('as HEROKU_POSTGRESQL_RED on acme-inc-www'))
          })
        })
      })
    })
  })

  it('prints add-on line for attachment when add-on info is missing from API (e.g. no permissions on billing app)', function () {
    mockAPI('acme-inc-api', [ /* no add-on ! */], [fixtures.attachments['acme-inc-api::WWW_DB']])

    return run('acme-inc-api', function () {
      util.expectOutput(cli.stdout, `
Add-on         Plan  Price                         State
─────────────  ────  ────────────────────────────  ─────
? (www-db)     ?     (billed to acme-inc-www app)
 └─ as WWW_DB

The table above shows add-ons and the attachments to the current app (acme-inc-api) or other apps.
`)
    })
  })
})
