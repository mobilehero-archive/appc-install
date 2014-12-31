var should = require('should'),
	wrench = require('wrench'),
	fs = require('fs'),
	chalk = require('../vendor/chalk'),
	util = require('../lib/util');


describe('util', function(){

	describe('should parseArgs', function(){

		it('as single arg',function(){
			process.argv = process.argv.slice(0,2).concat(['foo']);
			var args = util.parseArgs();
			should(args).containEql('foo');
			should(args).have.length(1);
		});

		it('as multiple args',function(){
			process.argv = process.argv.slice(0,2).concat(['foo','bar']);
			var args = util.parseArgs();
			should(args).containEql('foo');
			should(args).containEql('bar');
			should(args).have.length(2);
		});

		it('skip options after',function(){
			process.argv = process.argv.slice(0,2).concat(['foo','--bar']);
			var args = util.parseArgs();
			should(args).containEql('foo');
			should(args).not.containEql('bar');
			should(args).have.length(1);
		});

		it('skip options before',function(){
			process.argv = process.argv.slice(0,2).concat(['--foo','bar']);
			var args = util.parseArgs();
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
				wrench.rmdirSyncRecursive(TMPDIR);
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

});
