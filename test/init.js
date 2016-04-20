'use strict';

global.cli = require('heroku-cli-util');
cli.raiseErrors = true;
global.commands = require('..').commands;
global.expect   = require('chai').expect;
global.nock     = require('nock');
process.stdout.columns = 80;
process.stderr.columns = 80;
