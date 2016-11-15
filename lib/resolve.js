'use strict'

const memoize = require('lodash.memoize')

const addActionsHeader = function (headers) {
  return Object.assign({'Accept': 'application/vnd.heroku+json; version=3.actions'}, headers || {})
}

const appAddon = function (heroku, app, id, options = {}) {
  const headers = addActionsHeader(options.headers)
  return heroku.post('/actions/addons/resolve', {
    'headers': headers,
    'body': {'app': app, 'addon': id, 'addon_service': options.addon_service}
  })
  .then(singularize)
}

exports.appAddon = appAddon

const addonResolver = function (heroku, app, id, options = {}) {
  const headers = addActionsHeader(options.headers)

  let getAddon = function (id) {
    return heroku.post('/actions/addons/resolve', {
      'headers': headers,
      'body': {'app': null, 'addon': id, 'addon_service': options.addon_service}
    })
    .then(singularize)
  }

  if (!app || id.includes('::')) {
    return getAddon(id)
  } else {
    return appAddon(heroku, app, id, options)
    .catch(function (err) {
      if (err.statusCode === 404) return getAddon(id)
      throw err
    })
  }
}

/**
 * Replacing memoize with our own memoization function that works with promises
 * https://github.com/lodash/lodash/blob/da329eb776a15825c04ffea9fa75ae941ea524af/lodash.js#L10534
 */
const memoizePromise = function (func, resolver) {
  var memoized = function () {
    const args = arguments
    const key = resolver.apply(this, args)
    const cache = memoized.cache

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = func.apply(this, args)

    result.then(function () {
      memoized.cache = cache.set(key, result) || cache
      return arguments
    })

    return result
  }
  memoized.cache = new memoize.Cache()
  return memoized
}

exports.addon = memoizePromise(addonResolver, (_, app, id, options = {}) => `${app}|${id}|${options.addon_service}`)

function NotFound () {
  Error.call(this)
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name

  this.statusCode = 404
  this.message = 'Couldn\'t find that addon.'
}

function AmbiguousError (objects) {
  Error.call(this)
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name

  this.statusCode = 422
  this.message = `Ambiguous identifier; multiple matching add-ons found: ${objects.map((object) => object.name).join(', ')}.`
  this.body = {'id': 'multiple_matches', 'message': this.message}
}

const singularize = function (matches) {
  switch (matches.length) {
    case 0:
      throw new NotFound()
    case 1:
      return matches[0]
    default:
      throw new AmbiguousError(matches)
  }
}

const appAttachment = function (heroku, app, id, options = {}) {
  const headers = addActionsHeader(options.headers)
  return heroku.post('/actions/addon-attachments/resolve', {
    'headers': headers, 'body': {'app': app, 'addon_attachment': id, 'addon_service': options.addon_service}
  }).then(singularize)
}

exports.appAttachment = appAttachment

const filter = function (app, addonService) {
  return attachments => {
    return attachments.filter(attachment => {
      if (attachment.app.name !== app) {
        return false
      }

      if (addonService && attachment.addon_service.name !== addonService) {
        return false
      }

      return true
    })
  }
}

exports.attachment = function (heroku, app, id, options = {}) {
  const headers = addActionsHeader(options.headers)

  function getAttachment (id) {
    return heroku.post('/actions/addon-attachments/resolve', {
      'headers': headers, 'body': {'app': null, 'addon_attachment': id, 'addon_service': options.addon_service}
    }).then(singularize)
      .catch(function (err) { if (err.statusCode !== 404) throw err })
  }

  function getAppAddonAttachment (addon, app) {
    return heroku.get(`/addons/${encodeURIComponent(addon.id)}/addon-attachments`, {headers})
      .then(filter(app, options.addon_service))
      .then(singularize)
  }

  let promise
  if (!app || id.includes('::')) {
    promise = getAttachment(id)
  } else {
    promise = appAttachment(heroku, app, id, options)
    .catch(function (err) { if (err.statusCode !== 404) throw err })
  }

  // first check to see if there is an attachment matching this app/id combo
  return promise
    // if no attachment, look up an add-on that matches the id
    .then((attachment) => {
      if (attachment) return attachment
      // If we were passed an add-on slug, there still could be an attachment
      // to the context app. Try to find and use it so `context_app` is set
      // correctly in the SSO payload.
      else if (app) {
        return exports.addon(heroku, app, id, options)
        .then((addon) => getAppAddonAttachment(addon, app))
      } else {
        throw new NotFound()
      }
    })
}
