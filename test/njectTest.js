var nject = require('../'),
    should = require('should'),
    path = require('path');

describe('nject', function () {

  var tree;

  var config = {
    db: 'mongodb://user:password@server:123456',
    timeout: 1000
  }
  var stats = {
    a: 1,
    b: 2
  }

  var dep1Args = false;
  var dep1 = function (config) {
    dep1Args = arguments;
    return 1;
  }

  var dep2Args = false;
  var dep2 = function (config, stats) {
    dep2Args = arguments;
    return 2;
  }

  var dep3Args = false;
  var dep3 = function (dep2, dep1, stats) {
    dep3Args = arguments;
    return dep1 + dep2;
  }

  var dep4Args = false;
  var dep4 = function (dep3) {
    dep4Args = arguments;
    return 4;
  }

  var dep5Args = false;
  var dep5 = function (_done) {
    dep5Args = arguments
    setTimeout(function(){
      _done(null, 5)
    }, 100)
  }

  var dep6Args = false;
  var dep6 = function (_done) {
    dep6Args = arguments
    setTimeout(function(){
      _done(null, 6)
    }, 11000)
  }

  var dep7Args = false;
  var dep7 = function (_done) {
    dep7Args = arguments
    setTimeout(function(){
      _done(new Error('I am an error!'))
    }, 100)
  }

  var dep8Args = false;
  var dep8 = function (next) {
    dep8Args = arguments
    setTimeout(function(){
      next(null, 8)
    }, 100)
  }

  var badDep = function (asdf) {
  }

  var circ1 = function (circ2) {
  }
  var circ2 = function (circ1) {
  }
  var blocked1 = function (circ1) {
  }

  function reset() {
    dep1Args = dep2Args = dep3Args = dep4Args = dep5Args = dep6Args = dep7Args = dep8Args = false;
  }

  beforeEach(function () {
    reset()
    tree = new nject.Tree();
  })

  describe('constant', function () {
    it('works', function () {
      tree.constant('config', config);
    });
  });

  describe('register', function () {

    it('Throws an error if you register the same name twice', function () {
      function doubleRegister() {
        tree.register('fn1', fn1);
        tree.register('fn1', fn1);
      }

      doubleRegister.should.throw();
    });

  });

  describe('isRegistered', function () {

    it('returns true for a registered constant', function () {
      tree.constant('test', 7);
      tree.isRegistered('test').should.equal(true);
    });

    it('returns true for a registered dependency', function () {
      tree.register('test', function () {
        return 7;
      });
      tree.isRegistered('test').should.equal(true);
    });

    it('returns false for an runegistered key', function () {
      tree.isRegistered('test').should.equal(false);
    })

  })

  describe('resolve', function () {

    it('throws an error if you have an unregistered dependency', function () {
      tree.register('badDep', badDep);

      function doResolve() {
        tree.resolve();
      }

      doResolve.should.throw()
    })

    it('works with a stats dependency', function (done) {
      tree.constant('config', config);
      tree.register('dep1', dep1, 'dep1');
      tree.resolve(function (err, resolved) {
        dep1Args.should.be.ok;
        dep1Args[0].should.equal(config);
        done()
      });
    });

    it('works with 2 stats dependencies', function (done) {
      tree.constant('config', config);
      tree.constant('stats', stats);
      tree.register('dep1', dep1, 'dep1');
      tree.register('dep2', dep2, 'dep2');

      tree.resolve(function (err, resolved) {
        dep1Args.should.be.ok;
        dep1Args[0].should.equal(config);
        dep2Args.should.be.ok;
        dep2Args[0].should.equal(config);
        dep2Args[1].should.equal(stats);

        done()
      });
    });

    it('works with 2 resolved dependencies', function (done) {
      tree.constant('config', config);
      tree.constant('stats', stats);
      tree.register('dep1', dep1, 'dep1');
      tree.register('dep2', dep2, 'dep2');
      tree.register('dep3', dep3, 'dep3');

      tree.resolve(function (err, resolved) {
        dep3Args.should.be.ok;
        dep3Args[0].should.equal(2);
        dep3Args[1].should.equal(1);
        dep3Args[2].should.equal(stats);

        done()
      });
    });

    it('works with complex dependency trees', function (done) {
      tree.constant('config', config);
      tree.constant('stats', stats);
      tree.register('dep1', dep1, 'dep1');
      tree.register('dep2', dep2, 'dep2');
      tree.register('dep3', dep3, 'dep3');
      tree.register('dep4', dep4, 'dep4');


      tree.resolve(function (err, resolved) {
        dep4Args.should.be.ok;
        dep4Args[0].should.equal(3);
        done()
      });
    });

    it('throws an error on circular dependencies', function () {
      tree.register('blocked1', blocked1, 'blocked1');
      tree.register('circ1', circ1, 'circ1');
      tree.register('circ2', circ2, 'circ2');

      function doResolve() {
        tree.resolve();
      }

      doResolve.should.throw()
    });

    it('aggregates correctly', function (done) {
      tree.constant('config', config);
      tree.constant('stats', stats);
      tree.register('dep1', dep1, {
        aggregateOn: 'numbers',
        identifier: 'dep1'
      });
      tree.register('dep2', dep2, {
        aggregateOn: 'numbers',
        identifier: 'dep2'
      });
      tree.register('dep3', function (numbers) {
        numbers.dep1.should.equal(1);
        numbers.dep2.should.equal(2);
      });

      tree.resolve(function (err, resolved) {
        done()
      });
    });
  });

  describe('async resolution', function(){
    this.timeout(12000);

    it('passes a callback to the function', function(done){
      tree.register('dep5', dep5)

      tree.resolve(function(err, resolved){
        dep5Args[0].should.be.an.instanceOf(Function)
        done()
      });
    });
    it("resolves to the callback's second argument, rather than return value", function(done){
      tree.register('dep5', dep5)
      tree.register('dep6', function(dep5) {
        dep5.should.equal(5)
        return 6;
      })

      tree.resolve(function(err, resolved){
        done()
      });
    });
    it('the resolve callback receives the resolved object', function(done){
      tree.register('dep5', dep5)
      tree.register('dep6', function(dep5) {
        dep5.should.equal(5)
        return 6;
      });

      tree.resolve(function(err, resolved){
        should.exist(resolved);
        should.exist(resolved.dep5);
        should.exist(resolved.dep6);

        resolved.dep5.should.equal(5)
        resolved.dep6.should.equal(6)
        done();
      })
    });
    it('throws an error if the resolution takes longer than timeout', function(done){
      tree.register('dep6', dep6)

      tree.resolve(function(err, resolved){
        err.should.be.an.instanceOf(Error)
        done()
      });
    });
    it('_timeout can be changed on the tree object', function(done){
      tree.register('dep5', dep5)
      tree._timeout = 10

      tree.resolve(function(err, resolved){
        err.should.be.an.instanceOf(Error)
        done()
      });
    })
    it('_doneConstant can be changed on the tree object', function(done){
      tree._doneConstant = 'next'
      tree.register('dep8', dep8)

      tree.resolve(function(err, resolved){
        resolved.dep8.should.equal(8)
        done()
      });
    })
    it('will not continue to resolve dependencies if it breaks', function(done){
      var gotCalled = false;
      tree.register('dep7', dep7);
      tree.register('dep8', function(dep7) {
        gotCalled = true;
      });

      tree.resolve(function(err, resolved){
        err.should.be.an.instanceOf(Error)
        setTimeout(function(){
          gotCalled.should.equal(false);
          done()
        }, 1000)
      });
    });
  });
});