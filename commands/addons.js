'use strict';

let cli    = require('heroku-cli-util');
let co     = require('co');
let printf = require('printf');
let _      = require('lodash');
let util   = require('../lib/util');

let table       = util.table,
    style       = util.style,
    formatPrice = util.formatPrice;

// Gets *all* attachments and add-ons and filters locally because the API
// returns *owned* items not associated items.
function* addonGetter(api, app) {
    let attachments, addons;

    if(app) { // don't disploy attachments globally
        addons = api.request({
            method:  'GET',
            path:    `/apps/${app}/addons`,
            headers: {'Accept-Expansion': 'addon_service,plan'}
        });

        let sudoHeaders = JSON.parse(process.env.HEROKU_HEADERS || '{}');
        if(sudoHeaders['X-Heroku-Sudo'] && !sudoHeaders['X-Heroku-Sudo-User']) {
            // because the root /addon-attachments endpoint won't include relevant
            // attachments when sudo-ing for another app, we will use the more
            // specific API call and sacrifice listing foreign attachments.
            attachments = api.request({
                method:  'GET',
                path:    `/apps/${app}/addon-attachments`
            });
        } else {
            // In order to display all foreign attachments, we'll get out entire
            // attachment list
            attachments = api.addonAttachments().list();
        }
    } else {
        addons = api.request({
            method:  'GET',
            path:    '/addons',
            headers: {'Accept-Expansion': 'addon_service,plan'}
        });
    }

    // Get addons and attachments in parallel
    let items = yield [addons, attachments];

    function isRelevantToApp(addon) {
        return !app ||
            addon.app.name === app ||
            _.any(addon.attachments, function(att) { return att.app.name === app; });
    }

    attachments = _.groupBy(items[1], _.property('addon.id'));

    addons = [];
    items[0].forEach(function(addon) {
        addon.attachments = attachments[addon.id] || [];

        delete attachments[addon.id];

        if(isRelevantToApp(addon)) {
            addons.push(addon);
        }
    });

    // Any attachments left didn't have a corresponding add-on record in API.
    // This is probably normal (because we are asking API for all attachments)
    // but it could also be due to certain types of permissions issues, so check
    // if the attachment looks relevant to the app, and then render whatever
    // information we can.
    _.values(attachments).forEach(function(atts) {
        let inaccessibleAddon = {
            app: atts[0].addon.app,
            name: atts[0].addon.name,
            addon_service: {},
            plan: {},
            attachments: atts
        };

        if(isRelevantToApp(inaccessibleAddon)) {
            addons.push(inaccessibleAddon);
        }
    });

    return addons;
}

function displayAll(addons) {
    addons = _.sortByAll(addons, 'app.name', 'plan.name', 'addon.name');

    if(addons.length === 0) {
        cli.log("No add-ons.");
        return;
    }

    table(addons, {
        headerAnsi: cli.color.bold,
        columns: [{
            key:    'app.name',
            label:  'Owning App',
            format: style('app'),
        }, {
            key:    'name',
            label:  'Add-on',
            format: style('addon'),
        }, {
            key:    'plan.name',
            label:  'Plan',
            format: function(plan) {
                if(typeof plan === 'undefined') return style('dim', '?');
                return plan;
            },
        }, {
            key:    'plan.price',
            label:  'Price',
            format: function(price) {
                if(typeof price === 'undefined') return style('dim', '?');
                return formatPrice(price);
            }
        }],

    });
}

function formatAttachment(attachment, showApp) {
    if(showApp === undefined) { showApp = true; }

    let attName = style('attachment', attachment.name);

    let output = [style('dim', 'as'), attName];
    if(showApp) {
        let appInfo = `on ${style('app', attachment.app.name)} app`;
        output.push(style('dim', appInfo));
    }

    return output.join(' ');
}

function renderAttachment(attachment, app, isFirst) {
    let line = isFirst ? '└─' : '├─';
    let attName = formatAttachment(attachment, attachment.app.name !== app);
    return printf(' %s %s', style('dim', line), attName);
}

function displayForApp(app, addons) {
    if(addons.length === 0) {
        cli.log(`No add-ons for app ${app}.`);
        return;
    }

    function isForeignApp(attOrAddon) { return attOrAddon.app.name !== app; }

    function presentAddon(addon) {
        let name    = style('addon', addon.name);
        let service = addon.addon_service.name;

        if(service === undefined) {
            service = style('dim', '?');
        }

        let addonLine = `${service} (${name})`;

        let atts = _.sortByAll(addon.attachments,
                               isForeignApp,
                               'app.name',
                               'name');

        // render each attachment under the add-on
        let attLines = atts.map(function(attachment, idx) {
            let isFirst = (idx === addon.attachments.length - 1);
            return renderAttachment(attachment, app, isFirst);
        });

        return [addonLine].concat(attLines).join("\n");
    }

    addons = _.sortByAll(addons,
                         isForeignApp,
                         'plan.name',
                         'name');

    cli.log();
    table(addons, {
        headerAnsi: cli.color.bold,
        columns: [{
            label: 'Add-on',
            format: presentAddon
        }, {
            label: 'Plan',
            key: 'plan.name',
            format: function(name) {
                if(name === undefined) { return style('dim', '?'); }
                return name.replace(/^[^:]+:/, '');
            }
        }, {
            label: 'Price',
            format: function(addon) {
                if(addon.app.name === app) {
                    return formatPrice(addon.plan.price);
                } else {
                    return style('dim', printf('(billed to %s app)', style('app', addon.app.name)));
                }
            }
        }],

        // Separate each add-on row by a blank line
        after: function() { cli.log(""); }
    });

    cli.log(`The table above shows ${style('addon', 'add-ons')} and the ` +
            `${style('attachment', 'attachments')} to the current app (${app}) ` +
            `or other ${style('app', 'apps')}.\n`);
}

function displayJSON (addons) {
  cli.log(JSON.stringify(addons, null, 2));
}

function* run (ctx, api) {
  if(!ctx.flags.all && ctx.app) {
    let addons = yield co(addonGetter(api, ctx.app));
    if (ctx.flags.json) displayJSON(addons);
    else displayForApp(ctx.app, addons);
  } else {
    let addons = yield co(addonGetter(api));
    if (ctx.flags.json) displayJSON(addons);
    else displayAll(addons);
  }
}

let topic = 'addons';
module.exports = {
    topic:     topic,
    default:   true,
    needsAuth: true,
    preauth:   true,
    wantsApp:  true,
    flags:     [
      {
        name:        'all',
        char:        'A',
        hasValue:    false,
        description: 'show add-ons and attachments for all accessible apps'
      },
      {
        name:        'json',
        hasValue:    false,
        description: 'return add-ons in json format'
      }
    ],

    run:         cli.command(co.wrap(run)),
    usage:       `${topic} [--all|--app APP]`,
    description: 'lists your add-ons and attachments',
    help:        `The default filter applied depends on whether you are in a Heroku app
directory. If so, the --app flag is implied. If not, the default of --all
is implied. Explicitly providing either flag overrides the default
behavior.

Examples:

  $ heroku ${topic} --all
  $ heroku ${topic} --app acme-inc-www

Overview of Add-ons:

  Add-ons are created with the \`addons:create\` command, providing a reference
  to an add-on service (such as \`heroku-postgresql\`) or a service and plan
  (such as \`heroku-postgresql:hobby-dev\`).

  At creation, each add-on is assigned a globally unique name (or one can be
  provided by the user). Each add-on has at least one attachment alias to each
  application which uses the add-on. In all cases, the owning application will
  be attached to the add-on. An attachment alias is unique to its application,
  and is used as a prefix to any environment variables it exports to the
  application.

  For instance, a \`heroku-postgresql:hobby-dev\` add-on named \`www-db\`, which
  is owned by \`acme-inc-www\` and shared with \`acme-inc-dwh\` is represented
  below:

    $ heroku addons --app acme-inc-www
    Add-on                               Plan       Price
    ───────────────────────────────────  ─────────  ──────
    heroku-postgresql (www-db)           hobby-dev  free
     ├─ as DATABASE
     └─ as WWW_DB on acme-inc-dwh app

  In that example, \`DATABASE\` is an attachment alias on the owning application
  and exports \`DATABASE_URL\` to that application while \`WWW_DB\` is an
  attachment alias to the \`acme-inc-dwh\` application and shares the add-on to
  that application by exporting \`WWW_DB_URL\` to it.

  For more information, read https://devcenter.heroku.com/articles/add-ons.`
};
