/**
 * This is an elem that wraps its innerHTML
 * in a <span>.
 */

module.exports = function(render) {
  var contents = this.innerHTML;

  render('<span>'+contents+'</span>');

  // Count number of calls
  if (window.count !== undefined) {
    window.count++;
  }

  this.dispatchEvent(new Event('hello'))
}
