/*
	This module manages the
  sonic and visual output of the app
 */

'use strict';

var P5 = require('../libs/p5');
require('../libs/p5.sound');
var audioSupported = true;
var postal = require('postal');
var channel = postal.channel();
var updateStatus = require('./update-status');
var SingleShape = require('./single-shape-cnstrctr');
var weatherCheck = require('./weather-checker-fns');
var intervals = require('../utilities/intervals');
var getFreqScales = require('../utilities/create-freq-scales');
var duplicateArray = require('../utilities/duplicate-array-vals');
var addMissingArrayItems = require('../utilities/add-missing-array-items');
var avSettings = require('../settings/av-settings');

module.exports = function() {
  /*
    Module scoped vars
  */
  var isPlaying = false;
	// Sound containers
	var padSounds = [];
  var choralSounds = [];
  var dropSound;
  var dropLightSound;
  var bass;
  var brassBass;
  var brassBass2;
  var arpDropPhrase;
  var arpDropLightPhrase;
  var arpPart;
  var soundFilter;
  var masterGain;
  var panArr = [-0.8,0,0.8];
  var rainDropsPattern = [];
	// Array for all visual shapes
	var shapeSet = [];
  // dialog / modal
  var dialogIsOpen = false;
  // Visuals
  var sqSize = 25;
  var temperatureColour = 0;
  // For audioContext support
  var pee5 = new P5();
  //Subscriptions
  var publishBrassOne;
  var publishBrassTwo;

  /*
    Utility functions
  */

	// Is this size or smaller
	function matchMediaMaxWidth(maxWidthVal) {
    return window.matchMedia('all and (max-width: ' + maxWidthVal + 'px)');
  }

  function fadeOutPadSounds(soundItem) {
    function stopPadSounds(padSound) {
      setTimeout(function() {
        padSound.stop();
      }, avSettings.fadeTime * 1000);
    }
    for (var padSound in soundItem) {
      soundItem[padSound].fade(0, avSettings.fadeTime);
      stopPadSounds(soundItem[padSound]);
    }
  }

  function fadeChoralSounds(soundItem) {
    soundItem.fade(0, avSettings.fadeTime);
    setTimeout(function(){
      soundItem.stop();
    }, avSettings.fadeTime * 1000);
  }

  function fadeBass() {
    bass.fade(0, avSettings.fadeTime);
    bass.stop();
  }

  function killCurrentSounds() {
      // Stop arrpeggio
      arpPart.stop(0);
      arpPart.removePhrase('rainDrops');
      arpPart.removePhrase('rainDropsLight');
      // Fade organ sounds
      padSounds.forEach(fadeOutPadSounds);
      // Fade choral
      choralSounds.forEach(fadeChoralSounds);
      // Fade bass
      fadeBass();
      //Fade brassbass
      brassBass.fade(0, avSettings.fadeTime);
      brassBass.stop();
      brassBass2.fade(0, avSettings.fadeTime);
      brassBass2.stop();
      publishBrassOne.unsubscribe();
      publishBrassTwo.unsubscribe();
      isPlaying = false;
      channel.publish('allStopped');
  }

  function makeDropSound(time, playbackRate) {
    dropSound.rate(playbackRate);
    dropSound.setVolume(0.1);
    dropSound.play(time);
  }

  function makeDropLightSound(time, playbackRate) {
    dropLightSound.rate(playbackRate);
    dropLightSound.setVolume(0.1);
    dropLightSound.play(time);
  }

  function getNumPadNotes(lwData, avSettings, isStormy) {
    var _numPadNotes;
    if (isStormy) {
      _numPadNotes = 3;
    } else {
      _numPadNotes = avSettings.numPadNotes; //4
    }
    return _numPadNotes;
  }

  /**
   * [createP5SoundObjs creates various P5 sound objects if AudioContext is supported]
   * @param  {[boolean]} audioSupported [whether AudioContext is supported]
   * @return {[object]}                [All the sound objects]
   */
  function createP5SoundObjs() {
    soundFilter = new P5.LowPass();
    // Create phrase: name, callback, sequence
    arpDropPhrase = new P5.Phrase('rainDrops', makeDropSound, rainDropsPattern);
    arpDropLightPhrase = new P5.Phrase('rainDropsLight', makeDropLightSound, rainDropsPattern);
    arpPart = new P5.Part();
    masterGain = new P5.Gain();
  }

	// main app init
	function init(lwData) {
    console.log('lwData', lwData);
    //Init scoped values
    var brassOneScaleArrayIndex = 0;
    var brassTwoScaleArrayIndex = 0;
    var scaleSetIndex = 0;
    var padIndexCount = 0;
    // TODO find better way of avoiding mutation
    //Empty, clear;
    choralSounds = [];
    padSounds = [];
    // weather checks
    var wCheck = {
      //single concept items
      isPrecip: weatherCheck.isPrecip(lwData.precipType, lwData.precipIntensity.value),
      isHumid: weatherCheck.isHumid(lwData.humidity.value),
      isWindy: weatherCheck.isWindy(lwData.windSpeed.value),
      isCloudy: weatherCheck.isCloudy(lwData.cloudCover.value),
      //temperature
      isCold: weatherCheck.isCold(lwData.temperature.value),
      isFreezing: weatherCheck.isFreezing(lwData.temperature.value),
      //broad conditions
      isFine: weatherCheck.isFine(lwData.cloudCover.value, lwData.windSpeed.value, lwData.temperature.value),
      isClement: weatherCheck.isClement(lwData.cloudCover.value, lwData.windSpeed.value, lwData.precipIntensity.value),
      isStormy: weatherCheck.isStormy(lwData.cloudCover.value, lwData.windSpeed.value, lwData.precipIntensity.value)
    };
    console.log('wCheck', wCheck);
    var numPadNotes = getNumPadNotes(lwData, avSettings, wCheck.isStormy);
    console.log('numPadNotes', numPadNotes);

		//Create p5 sketch
		var myP5 = new P5(function(sketch) {

      function precipCategory(lwData) {
        if (lwData.precipType === 'rain' && lwData.precipIntensity.value > 0.2) {
          return 'hard';
        } else if (lwData.precipType === 'sleet' && lwData.precipIntensity.value <= 0.2) {
          return 'soft';
        } else if (lwData.precipType === 'snow' || lwData.precipIntensity.value <= 0.1) {
          return 'softest';
        } else {
          console.log('no rain? type is: ', lwData.precipType);
          return null;
        }
      }

      function addRandomStops(notesArray) {
        //duplicate notes
        var _newNotesArray = duplicateArray(notesArray, 10);
        var _randomStopCount = _newNotesArray.length / 2;
        var _randomIndex;
        //Add stops
        for (var i = 0; i < _randomStopCount; i++) {
          _randomIndex = sketch.random(0,_newNotesArray.length);
          _newNotesArray.splice(_randomIndex, 0, 0);
        }
        return _newNotesArray;
      }

      function playArp(arpeggioType, arpScaleArray) {
        //Overwrite sequence with new notes
        var _newNotesArray = addRandomStops(arpScaleArray).reverse();
        arpDropPhrase.sequence = _newNotesArray;
        arpDropLightPhrase.sequence = _newNotesArray;
        //Only use dropSound for rain
        if (arpeggioType === 'hard') {
          arpPart.addPhrase(arpDropPhrase);
        } else {
          arpPart.addPhrase(arpDropLightPhrase);
        }
        arpPart.setBPM(60);
        // Type logic
        switch (arpeggioType) {
          case 'hard':
            arpPart.setBPM(150);
            console.log('hard');
            break;
          case 'soft':
            arpPart.setBPM(120);
            console.log('soft');
            break;
          case 'softest':
            arpPart.setBPM(90);
            console.log('softest');
            break;
          default:
            console.log('problem with arrpeggio ', arpeggioType);
        }
        console.log('arpPart', arpPart);
        arpPart.start();
        arpPart.loop();
      }

      function playBass(scaleSet) {
        bass.play();
        //Play 1st note of each chord
        bass.rate(scaleSet[scaleSetIndex][0]);
        bass.setVolume(0.5);
        console.log('bass playing');
      }

      function playBrassBass(scaleSetArray) {
        brassBass.play();
        brassBass.rate(scaleSetArray[brassOneScaleArrayIndex]);
        brassBass.setVolume(1);
        if (brassOneScaleArrayIndex >= 1) {
          brassOneScaleArrayIndex = 0;
        } else {
          brassOneScaleArrayIndex++;
        }
        console.log('brass bass playing');
      }

      function playBrassBassTwo(scaleArray) {
        var _newScaleArr = scaleArray.slice().reverse();
        brassBass.play();
        brassBass.rate(_newScaleArr[brassTwoScaleArrayIndex]);
        brassBass.setVolume(1);
        if (brassTwoScaleArrayIndex >= scaleArray.length -1) {
          brassTwoScaleArrayIndex = 0;
        } else {
          brassTwoScaleArrayIndex++;
        }
        console.log('brass bass two playing');
      }

      function getPanIndex(panIndex) {
        if (panIndex < panArr.length -1) {
          panIndex++;
        } else {
          panIndex = 0;
        }
        return panIndex;
      }

      function setScaleSetIndex(scaleSet) {
        if (scaleSetIndex >= scaleSet.length -1) {
          scaleSetIndex = 0;
        } else {
          scaleSetIndex++;
        }
        return scaleSetIndex;
      }

      function playPad(lwData, scaleSet, key) {
        var _panIndex = 0;
        for (var i = 0; i < padSounds.length; i++) {
          padSounds[i][key].disconnect();
          padSounds[i][key].connect(soundFilter);
          padSounds[i][key].play();
          padSounds[i][key].rate(scaleSet[scaleSetIndex][i]);
          padSounds[i][key].pan(panArr[_panIndex]);
          padSounds[i][key].setVolume(avSettings[key].volume);
          padSounds[i][key].onended(function() { padCallback(lwData, scaleSet, key); });
          _panIndex = getPanIndex(_panIndex);
          //console.log('padSounds[i][key].playbackRate', padSounds[i][key].playbackRate);
        }
        setScaleSetIndex(scaleSet);
        console.log(key + ' is playing');
        //playlogic
        //Avoid sound clash with Brass
        if (wCheck.isCloudy && !wCheck.isWindy) {
          playBass(scaleSet);
        }
      }

      function padCallback(lwData, scaleSet, key) {
        if (isPlaying) {
          padIndexCount++;
          // When all the sounds have played once, loop
          if (padIndexCount === padSounds.length) {
            playPad(lwData, scaleSet, key);
            padIndexCount = 0;
          }
        }
      }

      function handlePrecipitation(lwData, arpScaleArray, arpPart) {
        // Handle precipitation
        // playlogic
        if (wCheck.isPrecip) {
          playArp(precipCategory(lwData), arpScaleArray);
        } else {
          arpPart.stop(0);
        }
      }

      function handleFineWeather(lwData, scaleArray) {
        // playlogic
        if (wCheck.isFine) {
          console.log('weather is fine. choralSound playing');
          choralSounds.forEach(function(choralSound, i) {
            // must loop before rate is set
            // issue in Chrome only
            //choralSound.fade(0.17, avSettings.fadeTime);
            choralSound.loop();
            choralSound.rate(scaleArray[i]);
            choralSound.setVolume(0.17);
          });
        } else {
          console.log('weather is not fine. No choralSounds');
        }
      }

      function handlePadType(lwData, scaleSet) {
        //playlogic
        //Start with harshes conditions
        //and work our way up

        //This setting uses non western scale
        if (wCheck.isStormy && wCheck.isFreezing) {
          playPad(lwData, scaleSet, 'organ');
        } else if (wCheck.isStormy) {
          //TODO watch out for clash between
          //organDist and brass
          //stormy plays less notes
          playPad(lwData, scaleSet, 'organDist');
        } else if (wCheck.isFreezing) {
          playPad(lwData, scaleSet, 'trumpet');
        } else if (wCheck.isCold) {
          playPad(lwData, scaleSet, 'sax');
        } else {
          playPad(lwData, scaleSet, 'organ');
        }
      }

      /**
       * playSounds Handles playback logic
       * Though some of this is delegated
       * @param  {Object} lwData        Main weather data object
       * @param  {Array} padScales    sets of notes to play
       * @param  {Array} arpScaleArray a set of notes fot the sequencer to play
       * @return {boolean}               default value
       */
			function playSounds(lwData, padScales, arpScaleArray) {
        // Rain
        handlePrecipitation(lwData, arpScaleArray, arpPart);
        // Fine conditions
        handleFineWeather(lwData, padScales[0]);
        // Play brass
        publishBrassOne = channel.subscribe('triggerBrassOne', function() {
          //playlogic
          if (wCheck.isWindy) {
            playBrassBass(padScales[0]);
          }
        });
        publishBrassTwo = channel.subscribe('triggerBrassTwo', function() {
          //playlogic
          if (wCheck.isWindy) {
            playBrassBassTwo(padScales[0]);
          }
        });
        //Organ
        handlePadType(lwData, padScales);
        //Tell rest of app we're playing
        isPlaying = true;
        channel.publish('playing', audioSupported);
			}

      /*
        Use an equal temperament scale
        Major scale for clement weather
				Minor octave for anything else
        Returns an object containing
        the complete musical scale and the
        number of semitones in an octave
			*/
			function createEqTempPitchesArr(lwData, isWesternScale) {
        var _allNotesArray = [];
        var _numSemitones;
        if (isWesternScale) {
          _numSemitones = avSettings.numSemitones;
          console.log('western', _numSemitones);
        } else {
          _numSemitones = Math.round(sketch.random(avSettings.numSemitones + 2, avSettings.numSemitones * 2));
          console.log('non western _numSemitones', _numSemitones);
        }
        _allNotesArray = getFreqScales.createEqTempMusicalScale(1, avSettings.numOctaves, _numSemitones);
        return {
          allNotesArray: _allNotesArray,
          numSemitones: _numSemitones
        };
			}

      function allNotesScaleType(lwData) {
        //  Use equal temperament scale for cold & warm
        //  use arbitrary scale for freezing
        var _allNotesObj = {};
        //playlogic
        // non western eq temp scale
        if (wCheck.isStormy && wCheck.isFreezing) {
          _allNotesObj = createEqTempPitchesArr(lwData, false);
        }
        // western 12 note scale for warmer weather
        else {
          _allNotesObj = createEqTempPitchesArr(lwData, true);
        }
        return _allNotesObj;
      }

      /**
       * Returns a set of intervals that is
       * long enough for the sequence to play
       * @param  {Array} chosenIntervals  [Set of initial intervals]
       * @param  {Number} numNotes      [Number of notes needed]
       * @return {Array}                [current or new array]
       */
      function createIntervalsArray(chosenIntervals, numNotes, semisInOct) {
        var _newIntervals;
        var _difference = numNotes - chosenIntervals.length;
        var _numUpperOcts;
        //When using non western scale
        //ensure numbers don't balloon
        if (semisInOct > avSettings.numSemitones) {
          _numUpperOcts = 0;
        } else {
          _numUpperOcts = semisInOct;
        }
        //Error check
        if (_difference > 0) {
          _newIntervals = addMissingArrayItems(chosenIntervals, _difference, _numUpperOcts);
        } else {
          _newIntervals = chosenIntervals;
        }
        console.log('_newIntervals', _newIntervals);
        return _newIntervals;
      }

      function isOutofRange(arrLength, startingIndex, indicesToTest) {
        var remainder = arrLength - startingIndex;
        if (remainder <= 0) {
          throw new Error('array is less than the starting index');
        }
        findLargerValLoop:
        for (var i = 0; i < indicesToTest.length; i++) {
          if (indicesToTest[i] > remainder) {
            throw new Error('not enough array items, failed at ' + indicesToTest[i]);
          } else {
            continue findLargerValLoop;
          }
        }
        return false;
      }

      function getPitchesFromIntervals(allNotesScale, scaleIntervals, centreNoteIndex, numNotes, indexOffset) {
        var _scaleArray = [];
        var _newNote;
        var _indexOffset = indexOffset || 0;
        for (var i = 0; i < numNotes; i++) {
          _newNote = allNotesScale[scaleIntervals[_indexOffset] + centreNoteIndex];
          //error check
          if (_newNote !== undefined) {
            _scaleArray.push(_newNote);
          } else {
            console.log('undefined note');
          }
          _indexOffset++;
        }
        return _scaleArray;
      }

      function createMusicalScale(lwData, allNotesScale, numNotes, centreNoteOffset, key, semisInOct, chordIndexOffset) {
        var _scaleArray = [];
        var _centreNoteIndex = lwData.sParams.soundPitchOffset + centreNoteOffset;
        var _scaleIntervals = createIntervalsArray(intervals[key], numNotes, semisInOct);
        //error check
        try {
          isOutofRange(allNotesScale.length, centreNoteOffset, _scaleIntervals);
        } catch(exception) {
          console.error(exception.message);
        }
        _scaleArray = getPitchesFromIntervals(allNotesScale, _scaleIntervals, _centreNoteIndex, numNotes, chordIndexOffset);
        return _scaleArray;
      }

      function isRootNoteHigh(allNotesScale) {
        if (lwData.sParams.soundPitchOffset > Math.round(allNotesScale.length / 2)) {
          return true;
        } else {
          return false;
        }
      }

      function getChordOffsetKey(allNotesScale) {
        var _key;
        //For humid weather we use
        //the available notes in the intervals
        //therefore no offset is required
        //TODO not sure humidity is the best
        //value to use
        //playlogic
        if (wCheck.isHumid) {
          _key = 'chordsNoOffset';
        }
        //otherwise we use various offsets
        else if (wCheck.isClement) {
          if (isRootNoteHigh(allNotesScale)) {
            _key = 'chordsPositiveDown';
          } else {
            _key = 'chordsPositiveUp';
          }
        }
        else {
          if (isRootNoteHigh(allNotesScale)) {
            _key = 'chordsMelancholyDown';
          } else {
            _key = 'chordsMelancholyUp';
          }
        }
        console.log('chord seq type', _key);
        return _key;
      }

      function getChordsOffsetArr(numChords, allNotesScale) {
        var _chordOffsetArr = [];
        var _chordOffsetKey = getChordOffsetKey(allNotesScale);
        var _diff;
        _chordOffsetArr = intervals[_chordOffsetKey];
        // error check
        if (numChords > _chordOffsetArr.length) {
          _diff = numChords - _chordOffsetArr.length;
          //_chordOffsetArr = _chordOffsetArr.concat(getChords(_chordOffsetKey));
          _chordOffsetArr = addMissingArrayItems(_chordOffsetArr, _diff, null);
        }
        console.log('_chordOffsetArr', _chordOffsetArr);
        return _chordOffsetArr;
      }

      function getChordType() {
        var _chordType;
        //playlogic
        if (wCheck.isFine) {
          _chordType = 'minorSeventhIntervals';
        } else if (wCheck.isClement) {
          _chordType = 'heptMajorIntervals';
        } else {
          _chordType = 'heptMinorIntervals';
        }
        console.log('_chordType', _chordType);
        return _chordType;
      }

      function getNumChords() {
        var _numChords;
        //playlogic
        // We use a non western scale for freezing
        // so only play two chords
        if (wCheck.isStormy && wCheck.isFreezing) {
          _numChords = 2;
        } else if (wCheck.isStormy || wCheck.isFine) {
          _numChords = 3;
        } else {
          _numChords = avSettings.numChords; //4
        }
        console.log('_numChords', _numChords);
        return _numChords;
      }

      function getChordIndexOffsetKey() {
        var _key;
        //playlogic
        if (wCheck.isHumid) {
          _key = 'chordIndexes';
        } else {
          _key = 'chordIndexesNoOffset';
        }
        console.log('interval arr for chord ', _key);
        return _key;
      }

      function getChordIndexOffsetArr(numChords) {
        var _chordIndexOffSetArr = [];
        var _chordIndexOffSetKey = getChordIndexOffsetKey();
        var _diff;
        _chordIndexOffSetArr = intervals[_chordIndexOffSetKey];
        if (numChords > _chordIndexOffSetArr.length) {
          _diff = numChords - _chordIndexOffSetArr.length;
          _chordIndexOffSetArr = addMissingArrayItems(_chordIndexOffSetArr, _diff, null);
        }
        return _chordIndexOffSetArr;
      }

      function makeChordSequence(lwData, numChords, allNotesScale, semisInOct) {
        var _chordSeq = [];
        var _chordType = getChordType();
        var _chordOffSetArr = getChordsOffsetArr(numChords, allNotesScale);
        var _chordIndexOffsetArr = getChordIndexOffsetArr(numChords);
        for (var i = 0; i < numChords; i++) {
          _chordSeq.push(createMusicalScale(lwData, allNotesScale, numPadNotes, _chordOffSetArr[i], _chordType, semisInOct, _chordIndexOffsetArr[i]));
        }
        console.log('_chordSeq', _chordSeq);
        return _chordSeq;
      }

      function setRootNote(lwData, allNotesScale) {
        //Add global values to the main data object
        //Pressure determines root note. Range 1 octave
        lwData.sParams.soundPitchOffset = Math.round(sketch.map(
          lwData.pressure.value,
          lwData.pressure.min,
          lwData.pressure.max,
          avSettings.scaleStartIndexBuffer, //x amount from the beginning
          allNotesScale.length - avSettings.scaleStartIndexBuffer //x amount from the end
        ));
        console.log('lwData.sParams.soundPitchOffset', lwData.sParams.soundPitchOffset);
      }

      /*
      	Sound config algorithm
      	---------------
      	The distortion is set by cloud cover
      	The note volume is set by wind speed
      	The root key is set by the air pressure
      	The filter frequency is set by visibility
       */
			function configureSounds(lwData) {
        var _organScaleSets = [];
        var _arpScaleArray = [];
        // Create scales for playback
        var _allNotesObj = allNotesScaleType(lwData);
        var _allNotesScale = _allNotesObj.allNotesArray;
        var _semisInOct = _allNotesObj.numSemitones;
        var _arpCentreNoteOffset = -Math.abs(_semisInOct * 2);
        var _numChords = getNumChords();
        // Set root note for use with all sounds
        setRootNote(lwData, _allNotesScale);
        //Use math.abs for all pitch and volume values?
        // Set filter. Visibility is filter freq
        lwData.sParams.freq.value = sketch.map(Math.round(lwData.visibility.value), lwData.visibility.min, lwData.visibility.max, lwData.sParams.freq.min, lwData.sParams.freq.max);
        soundFilter.freq(lwData.sParams.freq.value);
        soundFilter.res(20);
        _organScaleSets = makeChordSequence(lwData, _numChords, _allNotesScale, _semisInOct);
        _arpScaleArray = createMusicalScale(lwData, _allNotesScale, avSettings.numArpNotes, _arpCentreNoteOffset, 'safeIntervals', _semisInOct);
        playSounds(lwData, _organScaleSets, _arpScaleArray);
			}

			//Accepts number of horizontal and vertical squares to draw
			function createShapeSet(hSquares, vSquares) {
        var shapeSet = [];
				var index = 0;
				for (var i = 0; i < hSquares; i++) {
					for (var j = 0; j < vSquares; j++) {
						index++;
						var shape = new SingleShape(i * sqSize, j * sqSize, sqSize - 1, sketch.random(70,130), index);
						shapeSet.push(shape);
					}
				}
        return shapeSet;
			}

			//Sound constructor
			function PadSound(organ, organDist, sax, trumpet) {
				this.organ = organ;
				this.organDist = organDist;
				this.sax = sax;
				this.trumpet = trumpet;
			}

			sketch.preload = function() {
				//loadSound called during preload
				//will be ready to play in time for setup
        if (audioSupported) {
          for (var i = 0; i < numPadNotes; i++) {
            padSounds[i] = new PadSound(
              sketch.loadSound('/audio/organ-C2.mp3'),
              sketch.loadSound('/audio/organ-C2d.mp3'),
              sketch.loadSound('/audio/sax-C2.mp3'),
              sketch.loadSound('/audio/trumpet-C2.mp3')
            );
          }
          for (var j = 0; j < 2; j++) {
            choralSounds.push(sketch.loadSound('/audio/choral.mp3'));
          }
          dropSound = sketch.loadSound('/audio/drop.mp3');
          dropLightSound = sketch.loadSound('/audio/drop-light.mp3');
          bass = sketch.loadSound('/audio/bass.mp3');
          brassBass = sketch.loadSound('/audio/brassbass.mp3');
          brassBass2 = sketch.loadSound('/audio/brassbass.mp3');
        }
			};

			sketch.setup = function setup() {
        //TODO create master channel
        //masterGain.amp(0, 0, 0);
				//If this size or smaller
				if (matchMediaMaxWidth(540).matches) {
						avSettings.cWidth = 400;
						avSettings.cHeight = 800;
						avSettings.cPadding = '200%';
				}
        //--------------------
				//Canvas setup
				//--------------------
				var myCanvas = sketch.createCanvas(avSettings.cWidth, avSettings.cHeight);
				myCanvas.parent(avSettings.cContainerName);
				var cContainer = document.getElementById(avSettings.cContainerName);
				cContainer.style.paddingBottom = avSettings.cPadding;
				sketch.frameRate(25);
				sketch.background(0, 0, 0);
        //---------------------
        //create shapes in grid
        //---------------------
				var hSquares = Math.round(sketch.width/sqSize);
				var vSquares = Math.round(sketch.height/sqSize);
        shapeSet = createShapeSet(hSquares, vSquares);
        //---------------------
        //set runtime constants
        //--------------------
				avSettings.animAmount = Math.round(lwData.windSpeed.value);
				avSettings.noiseInc = sketch.map(avSettings.animAmount, lwData.windSpeed.min, lwData.windSpeed.max, 0.01, 0.05);
				temperatureColour = sketch.map(lwData.temperature.value, lwData.temperature.min, lwData.temperature.max, 25, 255);
        //--------------------
        // handle sounds
        // --------------------
        if (audioSupported) {
          configureSounds(lwData);
        } else {
          updateStatus('error', lwData.name, true);
        }
			};

			sketch.draw = function draw() {
				sketch.background(0, 0, 0, 0);
        if (dialogIsOpen) {
          for (var i = 0; i < shapeSet.length; i++) {
            shapeSet[i].update(sketch, avSettings.noiseInc, avSettings.animAmount);
            shapeSet[i].paint(sketch, temperatureColour, avSettings.colourDim);
          }
        }
        if (sketch.frameCount % 350 === 0) {
          channel.publish('triggerBrassOne');
        }
        if (sketch.frameCount % 650 === 0) {
          channel.publish('triggerBrassTwo');
        }
			};

		}, 'canvas-container');
		return myP5;
	}

  // Check for audioContext support
  function isAudioSuppored(pee5) {
    if(pee5.noWebAudioCtx) {
      return false;
    } else {
      createP5SoundObjs();
      return true;
    }
  }

	channel.subscribe('userUpdate', function(data) {
    audioSupported = isAudioSuppored(pee5);
    init(data);
	});

  channel.subscribe('dialogOpen', function() {
    dialogIsOpen = true;
  });

  channel.subscribe('dialogClosed', function() {
    dialogIsOpen = false;
  });

  channel.subscribe('stop', function() {
    killCurrentSounds();
  });

	return true;
};
