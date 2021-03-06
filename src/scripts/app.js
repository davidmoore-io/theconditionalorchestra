'use strict';
var Tabs = require('./modules/tabs');
var jsLoad = require('./utilities/js-load');
var updateStatus = require('./modules/update-status');
require('./utilities/browser-tab-visibility');

// Web audio support?
if (!window.AudioContext && !window.webkitAudioContext) {
  updateStatus('noAudio');
  console.log('No Audio Context');
  return false;
} else {
  // Get url
  var splitUrl = location.href.split('?');
  var query = splitUrl[1];
  // start app
  var coordsForm = require('./modules/coords-form');
  var audioVisual = require('./modules/audio-visual');
  coordsForm(query);
  audioVisual();
  jsLoad();
  new Tabs( document.querySelector('[data-directive=tabs]') );
}
