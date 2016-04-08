'use strict';

let cmd = commands.find(c => c.topic === 'addons' && c.command === 'docs');

describe('addons:docs', function() {
  beforeEach(() => cli.mockConsole());

  it('opens an addon by name', function() {
    let api = nock('https://api.heroku.com:443')
              .get('/addon-services/slowdb')
              .reply(200, {name: 'slowdb'});

    return cmd.run({args: {addon: 'slowdb:free'}, flags: {url: true}})
      .then(() => expect(cli.stdout).to.equal('https://devcenter.heroku.com/articles/slowdb\n'))
      .then(() => expect(cli.stderr).to.equal(''))
      .then(() => api.done());
  });

  it('opens an addon by attachment name', function() {
    let api = nock('https://api.heroku.com:443')
              .get('/addon-services/my-attachment-1111')
              .reply(404)
              .get('/addons/my-attachment-1111')
              .reply(200, {addon_service: {name: 'slowdb'}});

    return cmd.run({args: {addon: 'my-attachment-1111'}, flags: {url: true}})
      .then(() => expect(cli.stdout).to.equal('https://devcenter.heroku.com/articles/slowdb\n'))
      .then(() => expect(cli.stderr).to.equal(''))
      .then(() => api.done());
  });

  it('opens an addon by app/attachment name', function() {
    let api = nock('https://api.heroku.com:443')
              .get('/addon-services/my-attachment-1111')
              .reply(404)
              .get('/apps/myapp/addons/my-attachment-1111')
              .reply(200, {addon_service: {name: 'slowdb'}});

    return cmd.run({app: 'myapp', args: {addon: 'my-attachment-1111'}, flags: {url: true}})
      .then(() => expect(cli.stdout).to.equal('https://devcenter.heroku.com/articles/slowdb\n'))
      .then(() => expect(cli.stderr).to.equal(''))
      .then(() => api.done());
  });
});
