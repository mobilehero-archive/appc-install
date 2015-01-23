/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copy or otherwise redistributed without expression
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var should = require('should'),
	fs = require('fs'),
	path = require('path'),
	chalk = require('chalk'),
	util = require('../lib/util');


describe('util', function(){

	describe('should parseArgs', function(){

		it('as single arg',function(){
			process.argv = process.argv.slice(0,2).concat(['foo']);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).have.length(1);
		});

		it('as multiple args',function(){
			process.argv = process.argv.slice(0,2).concat(['foo','bar']);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).containEql('bar');
			should(args).have.length(2);
		});

		it('skip options after',function(){
			process.argv = process.argv.slice(0,2).concat(['foo','--bar']);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).not.containEql('bar');
			should(args).have.length(1);
		});

		it('skip options before',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo','bar']);
			var args = util.parseArgs({});
			should(args).not.containEql('foo');
			should(args).containEql('bar');
			should(args).have.length(1);
		});

	});

	describe('should parseOpts', function(){
	
		it('as boolean true',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo']);
			var opts = util.parseOpts();
			should(opts).have.property('foo',true);
		});

		it('as string',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo','true']);
			var opts = util.parseOpts();
			should(opts).have.property('foo',true);
		});

		it('as boolean false',function(){
			process.argv = process.argv.slice(0,2).concat(['--no-foo',false]);
			var opts = util.parseOpts();
			should(opts).have.property('foo',false);
		});

		it('as multiple booleans true',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo','--bar']);
			var opts = util.parseOpts();
			should(opts).have.property('foo',true);
			should(opts).have.property('bar',true);
		});

		it('as boolean true using equal',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo=true']);
			var opts = util.parseOpts();
			should(opts).have.property('foo',true);
		});

		it('as booleans using equal',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo=true','--bar=false']);
			var opts = util.parseOpts();
			should(opts).have.property('foo',true);
			should(opts).have.property('bar',false);
		});

		it('skip non-options',function(){
			process.argv = process.argv.slice(0,2).concat(['foo']);
			var opts = util.parseOpts();
			should(opts).not.have.property('foo');
			should(Object.keys(opts)).have.length(0);
		});

		it('remove arg from version (with equal)',function(){
			process.argv = process.argv.slice(0,2).concat(['--version=0.0.117']);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('version','0.0.117');
			should(Object.keys(args)).have.length(0);
		});

		it('remove arg from version (without equal)',function(){
			process.argv = process.argv.slice(0,2).concat(['--version','0.0.117']);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('version','0.0.117');
			should(Object.keys(args)).have.length(0);
		});

		it('support single dash (without equal)',function(){
			process.argv = process.argv.slice(0,2).concat(['-o','json']);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('o','json');
			should(Object.keys(args)).have.length(0);
		});

		it('support single dash (with equal)',function(){
			process.argv = process.argv.slice(0,2).concat(['-o=json']);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('o','json');
			should(Object.keys(args)).have.length(0);
		});

	});

	describe('should makeURL', function(){

		afterEach(function(){
			delete process.env.APPC_REGISTRY;
		});

		it('parse using opts', function(){
			should(util.makeURL({registry:'http://foo'},'bar')).be.equal('http://foo/bar');
		});

		it('parse using env', function(){
			process.env.APPC_REGISTRY = 'http://bar';
			should(util.makeURL(null,'foo')).be.equal('http://bar/foo');
		});

		it('parse using default', function(){
			should(util.makeURL({},'foo')).be.equal('https://9bcfd7d35d3f2ad0ad069665d0120b7a381f81e9.cloudapp.appcelerator.com/foo');
		});

	});

	describe('should expandPath', function(){

		it('to home', function(){
			var home = util.getHomeDir();
			var hp = util.expandPath('~');
			should(home).be.ok;
			should(hp).be.ok;
			should(home).equal(hp);
		});

		it('to home with leading slash', function(){
			var home = util.getHomeDir();
			var hp = util.expandPath('~/');
			should(home).be.ok;
			should(hp).be.ok;
			should(hp).equal(home+'/');
		});

	});

	describe('should pad', function(){

		it('if required', function(){
			var result = util.pad('a',2);
			should(result).be.equal('a ');
		});

		it('if not required', function(){
			var result = util.pad('a',1);
			should(result).be.equal('a');
		});

	});

	describe('should ensureDir', function() {

		var TMPDIR = './foo/bar/ok';

		function cleanup() {
			try {
				util.rmdirSyncRecursive(TMPDIR);
			}
			catch (E) {
			}
		}

		before(cleanup);
		after(cleanup);

		it('as needed', function(){
			util.ensureDir(TMPDIR);
			should(fs.existsSync(TMPDIR)).be.true;
		});

	});

	describe('should fail', function() {

		var exit = process.exit,
			error = console.error,
			tty = process.stdout.isTTY,
			enabled = chalk.enabled,
			code,
			message = '';

		function cleanup () {
			process.stdout.isTTY = tty;
			process.exit = exit;
			console.error = error;
			chalk.enabled = enabled;
			code = undefined;
			message = '';
		}

		function hook () {
			process.stdout.isTTY = false;
			process.exit = function(_code) {
				code = _code;
			};
			console.error = function() {
				message += Array.prototype.slice.call(arguments).join(' ') + '\n';
			};
		}

		beforeEach(hook);
		afterEach(cleanup);

		it('with exit code 1 (with color)', function(){
			util.fail('a');
			should(code).be.equal(1);
			should(message).be.equal('\n'+chalk.red('a')+'\n');
		});

		it('with exit code 1 (without color)', function(){
			chalk.enabled = false;
			util.fail('a');
			should(code).be.equal(1);
			should(message).be.equal('\na\n');
		});

	});

	describe('should canWriteDir', function(){

		if (process.platform === 'win32' || process.env.TRAVIS) {
			return;
		}
		this.timeout(30000);


		var exec = require('child_process').exec;

		var USERWRITABLE = { dir: './tmp-uw', perm: '0755', user: process.env.USER, result: true, message:'user should be writable', skip:false },
			USERNOTWRITABLE = { dir: './tmp-unw', perm: '0755', user: 'root', result: false, message:'user should not be writable', skip:false },
			GROUPWRITABLE = { dir: './tmp-gw', perm: '0770', user: 'root', result: true, message:'group should be writable', skip:false },
			GROUPNOTWRITABLE = { dir:'./tmp-gnw', perm: '0700', user: 'root', result: false, message:'group should not be writable', skip:false },
			WORLDWRITABLE = { dir:'./tmp-ww', perm: '0777', user: 'root', result: true, message:'all should be writable', skip:false },
			WORLDNOTWRITABLE = { dir:'./tmp-wnw', perm: '0700', user: 'root', result: false, message:'all should not be writable', skip:false },
			DIRS = [USERWRITABLE, USERNOTWRITABLE, GROUPWRITABLE, GROUPNOTWRITABLE, WORLDWRITABLE, WORLDNOTWRITABLE];


		function makedirs(cb) {
			var index = 0;
			function makeNextDir() {
				var entry = DIRS[index++];
				if (entry) {
					try {
						if (!entry.skip) {
							var dirpath = path.join(__dirname, entry.dir),
								prefix = entry.user==='root' ? 'sudo' : '',
								cmd = prefix+' mkdir '+dirpath+'; '+prefix+' chmod '+entry.perm+' '+dirpath;
							// console.log(entry.message, '->', cmd);
							exec(cmd, makeNextDir);
						}
						else {
							makeNextDir();
						}
					}
					catch (e) {
						makeNextDir();
					}
				}
				else {
					cb();
				}
			}
			makeNextDir();
		}

		function cleanup (cb) {
			var index = 0;
			function deleteNextDir(err) {
				if (err) { console.error(err); }
				var entry = DIRS[index++];
				if (entry) {
					try {
						var dirpath = path.join(__dirname, entry.dir),
							cmd = 'sudo rm -rf '+dirpath;
						// console.log(cmd);
						exec(cmd, deleteNextDir);
					}
					catch (e) {
						deleteNextDir();
					}
				}
				else {
					cb();
				}
			}
			deleteNextDir();
		}

		before(function(cb) {
			console.log(chalk.blue('this test requires sudo ... you may need to enter your root password below'));
			makedirs(cb);
		});

		after(cleanup);

		DIRS.forEach(function(entry){
			(entry.skip?it.skip:it)(entry.message, function(){
				var dirpath = path.join(__dirname, entry.dir);
				should(util.canWriteDir(dirpath)).be.equal(entry.result);
			});
		});

	});

	describe('registry', function(){
		this.timeout(30000);
		it('should validate fingerprint',function(done){
			util.getRequest().get(util.makeURL('/'), function(err,resp,body) {
				should(err).be.null;
				should(body).be.a.string;
				should(util.getRequest().getLastURL()).be.a.string;
				should(util.getRequest().getLastURL()+'/').be.eql(util.makeURL(''));
				done();
			});
		});

	});
});
