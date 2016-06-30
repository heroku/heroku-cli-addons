'use strict'

const memoize = require('lodash.memoize')
const cli = require('heroku-cli-util')

exports.addon = memoize(function (app, id, headers) {
  let getAddon = function (id) {
    return cli.heroku.get(`/addons/${encodeURIComponent(id)}`, {headers: headers || {}})
  }

  if (!app || id.indexOf('::') !== -1) return getAddon(id)
  return cli.heroku.get(`/apps/${app}/addons/${encodeURIComponent(id)}`, {headers: headers || {}})
    .catch(function (err) { if (err.statusCode === 404) return getAddon(id); else throw err })
}, (app, id) => `${app}-${id}`)

exports.attachment = function (app, id) {
  function getAttachment (id) {
    return cli.heroku.get(`/addon-attachments/${encodeURIComponent(id)}`)
      .catch(function (err) { if (err.statusCode !== 404) throw err })
  }

  function getAppAttachment (app, id) {
    if (!app || id.indexOf('::') !== -1) return getAttachment(id)
    return cli.heroku.get(`/apps/${app}/addon-attachments/${encodeURIComponent(id)}`)
      .catch(function (err) { if (err.statusCode !== 404) throw err })
  }

  function getAppAddonAttachment (addon, app) {
    return cli.heroku.get(`/addons/${encodeURIComponent(addon.id)}/addon-attachments`)
      .then((attachments) => attachments.find((att) => att.app.name === app))
  }

  // first check to see if there is an attachment matching this app/id combo
  return getAppAttachment(app, id)
    // if no attachment, look up an add-on that matches the id
    .then((attachment) => {
      if (attachment) return attachment
      // If we were passed an add-on slug, there still could be an attachment
      // to the context app. Try to find and use it so `context_app` is set
      // correctly in the SSO payload.
      else {
        return exports.addon(app, id)
        .then((addon) => getAppAddonAttachment(addon, app))
      }
    })
}
