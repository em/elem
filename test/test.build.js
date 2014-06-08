var assert = require('assert');
var elem = require('../lib/elem');

describe('#build', function() {
  var sample = elem(__dirname+'/sample');

  context('development', function() {
     it('creates ', function() {
      sample.build();
      // assert.equal(ext, undefined);
    });
  });

});
