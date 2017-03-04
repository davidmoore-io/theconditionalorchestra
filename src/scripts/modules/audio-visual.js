/*
	This module manages the
  sonic and visual output of the app
 */

'use strict';
//3rd party
var P5 = require('../libs/p5');
require('../libs/p5.sound');
var postal = require('postal');
var channel = postal.channel();
var appTemplate = require('../templates/index').codisplay;
var he = require('he');
//custom
var frnhtToCelcius = require('../utilities/frnht-to-celcius');
var coDisplayDataFn = require('./co-display-data');
var updateStatus = require('./update-status');
var weatherCheck = require('./weather-checker-fns');
var microU = require('../utilities/micro-utilities');
var intervals = require('../utilities/intervals');
var getFreqScales = require('../utilities/create-freq-scales');
var duplicateArray = require('../utilities/duplicate-array-vals');
var getLargestPosNumInArr = require('../utilities/largest-pos-num-in-array');
var getLargestNegNumInArr = require('../utilities/largest-neg-num-in-array');
var addMissingArrayItems = require('../utilities/add-missing-array-items');
var avSettings = require('../settings/av-settings');

module.exports = function() {
  /*
    Module scoped vars
    and constants
  */
  var audioSupported = true;
  var isPlaying = false;
  //rate
  var appFrameRate = 25;
  var framesPerMinute = appFrameRate * 60;
  var sequenceStart = true;
  //bass
  var bass;
  //Windy/ Brass
  var brassBaritone;
  var brassBaritone2;
  var harpSoundTwo;
  //Percussion
  var cymbals;
  var cymbalsRide;
  //clement / brass
  var harpSound;
  //long notes
  var longNotes;
  //precipitation / drops
  var dropSounds;
  //windChime
  var windChime;
  //Globals
  var soundFilter;
  var freezingFilter;
  var reverb;
  //pan
  var angle = 0;
  var sinVal = 0;
  var cosVal = 0;
  var panArr = [-0.8, 0, 0.8];
  //Sound objects
  var padSounds = [];
  var choralSounds = [];
  // dialog / modal
  var dialogIsOpen = false;
  // Visuals
  var temperatureColour = 0;
  //Subscriptions
  var publishBrassOne;
  var publishBrassTwo;
  //Display data
  var coDisplayData = coDisplayDataFn();
  //DOM
  var cdContainer = document.querySelector('.conditions-display__list');

  function fadeInDisplayItem(thisDisplayItem) {
    var _opacity = 0;
    var _aniLoop = setInterval(function() {
      if (_opacity < 1) {
        thisDisplayItem.style.opacity = _opacity + '';
        _opacity += 0.05;
      } else {
        clearInterval(_aniLoop);
      }
    }, 50);
  }

  function fadeOutDisplayItems(thisDisplayItem, index, totalItems, doneFn, autoStart) {
    var _opacity = 1;
    var _aniLoop = setInterval(function() {
      if (_opacity > 0) {
        thisDisplayItem.style.opacity = _opacity + '';
        _opacity -= 0.05;
      } else {
        clearInterval(_aniLoop);
        //when all are done
        if (index + 1 === totalItems) {
          //Run the callback
          doneFn(autoStart);
        }
      }
    }, 50);
  }

  //TODO could use same function
  //as fadeLongNotes
  function fadeDropSounds() {
    for (var _dropSound in dropSounds) {
      if (longNotes.hasOwnProperty(_dropSound)) {
        dropSounds[_dropSound].fade(0, avSettings.fadeTime);
        setTimeout(function(){
          dropSounds[_dropSound].stop();
        }, avSettings.fadeTime * 1000);
      }
    }
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

  function fadeLongNotes() {
    for (var _longNote in longNotes) {
      if (longNotes.hasOwnProperty(_longNote)) {
        longNotes[_longNote].fade(0, avSettings.fadeTime);
        setTimeout(function(){
          longNotes[_longNote].stop();
        }, avSettings.fadeTime * 1000);
      }
    }
  }

  function killCurrentSounds(autoStart) {
      //Fades
      padSounds.forEach(fadeOutPadSounds);
      choralSounds.forEach(fadeChoralSounds);
      fadeLongNotes();
      fadeDropSounds();
      brassBaritone.fade(0, avSettings.fadeTime);
      brassBaritone2.fade(0, avSettings.fadeTime);
      harpSoundTwo.fade(0, avSettings.fadeTime);
      windChime.fade(0, avSettings.fadeTime);
      bass.fade(0, avSettings.fadeTime);
      harpSound.fade(0, avSettings.fadeTime);
      cymbals.fade(0, avSettings.fadeTime);
      cymbalsRide.fade(0, avSettings.fadeTime);
      //Stop after fades
      setTimeout(function(){
        brassBaritone.stop();
        brassBaritone2.stop();
        harpSoundTwo.stop();
        windChime.stop();
        bass.stop();
        harpSound.stop();
        cymbals.stop();
        cymbalsRide.stop();
      }, avSettings.fadeTime * 1000);
      //Unsubs
      publishBrassOne.unsubscribe();
      publishBrassTwo.unsubscribe();
      isPlaying = false;
      channel.publish('allStopped', autoStart);
  }

  function getLongNoteType(wCheck) {
    var _longNoteType;
    //playlogic
    //This errs towards the flute
    if (wCheck.isMuggy) {
      _longNoteType = 'harmonica';
    } else if (wCheck.isArid) {
      _longNoteType = 'shiney';
    } else if (wCheck.isHarsh) {
      _longNoteType = 'string';
    } else {
      _longNoteType = 'flute';
    }
    return _longNoteType;
  }

  function hasMajor(intervalString) {
    var _hasMajor = /Major/;
    return _hasMajor.test(intervalString);
  }

  function getNumPadNotes(wCheck, avSettings) {
    var _numPadNotes;
    //playlogic
    // We use a non western scale
    // and the guitar sound for windy and freezing
    // so only use 3 notes in a chord
    if (wCheck.isBitter) {
      _numPadNotes = 3;
    } else if (wCheck.isFine) {
      _numPadNotes = 4;
    } else {
      _numPadNotes = avSettings.numPadNotes; //5
    }
    return _numPadNotes;
  }

  function getNumChords(lwData) {
    var _numChords;
    var _numExtraChords;
    //TODO needs to be tested for realism
    //Is it possible to have a max dew point
    //and a max ozone level?
    //playlogic
    _numChords = Math.round(microU.mapRange(
      lwData.dewPoint.value,
      lwData.dewPoint.min,
      lwData.dewPoint.max,
      avSettings.numChordsMin,
      avSettings.numChordsMax
    ));
    _numExtraChords = Math.round(microU.mapRange(
      lwData.ozone.value,
      lwData.ozone.min,
      lwData.ozone.max,
      0,
      _numChords * 2
    ));
    return {
      numChords: _numChords,
      numExtraChords: _numExtraChords
    };
  }

  function getNumSemisPerOctave(avSettings, wCheck) {
    //  Use equal temperament scale for cold & warm
    //  use arbitrary scale for freezing
    var _numSemitones;
    //playlogic
    // non western eq temp scale
    if (wCheck.isBitter) {
      _numSemitones = avSettings.numSemitones * 2; //24
      console.log('non western: ', _numSemitones);
    } else {
      _numSemitones = avSettings.numSemitones; //12
    }
    return _numSemitones;
  }

  function getPadType(wCheck) {
    var padType = '';
    //playlogic
    //Start with harshest conditions
    //and work our way up

    //isBitter generates a non western scale
    //organ is used so as not to use a sound
    //that might clash with the brass barritone
    //when conditions are windy
    if (wCheck.isBitter || wCheck.isStormy) {
      padType = 'organ';
    } else if (wCheck.isViolentStorm) {
      padType = 'guitar';
    } else if (wCheck.isCold) {
      padType = 'saxophone';
    } else if (wCheck.isFreezing) {
      padType = 'zummarta';
    } else if (wCheck.isFine) {
      padType = 'aeroflute';
    } else {
      padType = 'horn';
    }
    return padType;
  }

  function getChordType(wCheck) {
    var _chordType;
    //playlogic
    if (wCheck.isClement && wCheck.isCold) {
      _chordType = 'octatonicMinorIntervals';
    } else if (wCheck.isFine) {
      _chordType = 'heptatonicMajorIntervals';
    } else if (wCheck.isCold) {
      _chordType = 'minorSeventhIntervals';
    } else if (wCheck.isStormy) {
      _chordType = 'heptatonicMinorIntervals';
    } else {
      _chordType = 'majorSeventhIntervals';
    }
    return _chordType;
  }

  function getChordSeqKey(wCheck, rootNoteHigh) {
    var _key;
    //playlogic
    if (wCheck.isFine || wCheck.isFreezing || wCheck.isWindy) {
      _key = 'noChordOffset';
    } else if (wCheck.isClement) {
      if (rootNoteHigh) {
        _key = 'blissfulDownward';
      } else {
        _key = 'blissfulUpward';
      }
    } else {
      if (rootNoteHigh) {
        _key = 'melancholyDownward';
      } else {
        _key = 'melancholyUpward';
      }
    }
    return _key;
  }

  //Inversions manager
  function getInversionOffsetKey(wCheck) {
    var _key;
    // playlogic
    // important!
    if (wCheck.isFine) {
      _key = 'inversionsDownward';
    } else if (wCheck.isWindy) {
      _key = 'inversionsMixed';
    } else if (wCheck.isFreezing) {
      _key = 'inversionsUpward';
    } else {
      _key = 'inversionsNoOffset';
    }
    return _key;
  }

  function getSeqRepeatMaxMult(numChords) {
    //If the number of chords is high
    //lower the multiplier
    var _mean = Math.round((avSettings.numChordsMin + avSettings.numChordsMax) / 2);
    var _diff = avSettings.numChordsMax - _mean;
    if (numChords > _mean) {
      return avSettings.mainSeqRepeatMax - _diff;
    } else {
      return avSettings.mainSeqRepeatMax;
    }
  }

  function getMainSeqRepeatNum(lwData, numChords) {
    var _upperMult = getSeqRepeatMaxMult(numChords);
    //playlogic
    return Math.round(microU.mapRange(
      lwData.apparentTemperature.value,
      lwData.apparentTemperature.min,
      lwData.apparentTemperature.max,
      numChords * _upperMult,
      numChords * 1
    ));
  }

  function getRootNote(lwData, numSemisPerOctave) {
    //Pressure determines root note.
    //In western scale it will be between + 6 or - 12
    var _rangePlus = Math.round(numSemisPerOctave / 2);
    var _rangeMinus = -Math.abs(numSemisPerOctave);
    //playlogic
    var _rootNote = Math.round(microU.mapRange(
      lwData.pressure.value,
      lwData.pressure.min,
      lwData.pressure.max,
      _rangeMinus,
      _rangePlus
    ));
    if (_rootNote === -0) {
      _rootNote = 0;
    }
    return _rootNote;
  }

  function getRootNoteLetter(numSemisPerOctave, rootNote) {
    var _rootNoteLetter = '';
    //Add one as the 1st note is 0 based
    var _rootNoteNumber = rootNote + 1;
    if (numSemisPerOctave !== 12) {
      _rootNoteLetter = microU.getOrdinal(_rootNoteNumber) + ' note in a non western scale';
    } else {
      if (rootNote < 0) {
        _rootNoteLetter = getFreqScales.CHROMATIC_SCALE[getFreqScales.CHROMATIC_SCALE.length + rootNote] + '2';
      } else {
        _rootNoteLetter = getFreqScales.CHROMATIC_SCALE[rootNote] + '3';
      }
    }
    return _rootNoteLetter;
  }

  function getLongNoteIndex(lwData, numPadNotes) {
    var _longNoteIndex;
    var _timesToDivide = numPadNotes;
    var _bearingSlice = 360 / _timesToDivide;
    //playlogic
    //bearing decides which note in scale to play
    //Could use reduce
    for (var i = 0; i < _timesToDivide; i++) {
      var _currentBearingSlice = _bearingSlice * i;
      if (lwData.windBearing.value <= _currentBearingSlice) {
        _longNoteIndex = i;
      } else {
        _longNoteIndex = _timesToDivide - 1;
      }
    }
    return _longNoteIndex;
  }

  function getLongNoteOffset(lwData) {
    return Math.round(microU.mapRange(
      lwData.visibility.value,
      lwData.visibility.min,
      lwData.visibility.max,
      -1,
      1
    ));
  }

  function getPrecipCategory(lwData) {
    if (lwData.precipType === undefined) {
      return undefined;
    } else if (lwData.precipType === 'rain' && lwData.precipIntensity.value > 0.2) {
      return 'hard';
    } else if (lwData.precipType === 'sleet' || lwData.precipIntensity.value <= 0.2) {
      return 'soft';
    } else if (lwData.precipType === 'snow' || lwData.precipIntensity.value <= 0.1) {
      return 'light';
    }
  }

  //TODO could use regex
  function getDropSoundKey(precipCategory) {
    if (precipCategory === 'hard') {
      return 'dropSound';
    } else if (precipCategory === 'soft') {
      return 'dropSoftSound';
    } else if (precipCategory === 'light') {
      return 'dropLightSound';
    } else {
      return undefined;
    }
  }

  //TODO this is wrong figure
  //comes out at 25 for 60
  function getPrecipArpBpm(lwData) {
    // playlogic
    return Math.round(microU.mapRange(
      lwData.precipIntensity.value,
      lwData.precipIntensity.min,
      lwData.precipIntensity.max,
      framesPerMinute / 60,
      framesPerMinute / 150
    ));
  }

  //TODO this is wrong figure
  //comes out at 25 for 60
  function getHumidArpBpm(lwData) {
    return Math.round(microU.mapRange(
      lwData.humidity.value,
      lwData.humidity.min,
      lwData.humidity.max,
      framesPerMinute / 40,
      framesPerMinute / 70
    ));
  }

  function getHumidArpIntervals(lwData, chordType) {
    var _hIntervals;
    //playlogic
    if (lwData.pressure.value > 1000) {
      if (hasMajor(chordType)) {
        _hIntervals = 'closeMajorIntervals';
      } else {
        _hIntervals = 'closeMinorIntervals';
      }
    } else {
      if (hasMajor(chordType)) {
        _hIntervals = 'farMajorIntervals';
      } else {
        _hIntervals = 'farMinorIntervals';
      }
    }
    return _hIntervals;
  }

  function getMasterFilterFreq(lwData) {
    //Use math.abs for all pitch and volume values?
    // Set filter. Visibility is filter freq
    // playlogic
    return microU.mapRange(
      lwData.cloudCover.value,
      lwData.cloudCover.max,
      lwData.cloudCover.min,
      avSettings.masterFilter.min,
      avSettings.masterFilter.max
    );
  }

  function isRootNoteHigh(rootNote) {
    if (rootNote > 0) {
      return true;
    } else {
      return false;
    }
  }

  function getCymbalsRate(lwData) {
    return microU.mapRange(
      Math.round(lwData.nearestStormBearing.value),
      lwData.nearestStormBearing.min,
      lwData.nearestStormBearing.max,
      0.5,
      1.2
    );
  }

  function getCymbalsVolume(lwData) {
    return microU.mapRange(
      Math.round(lwData.nearestStormDistance.value),
      lwData.nearestStormDistance.min,
      lwData.nearestStormDistance.max,
      0.8,
      0
    );
  }

  function getCymbalsRideVolume(lwData) {
    return microU.mapRange(
      Math.round(lwData.precipProbability.value),
      lwData.precipProbability.min,
      lwData.precipProbability.max,
      0,
      0.8
    );
  }

  /**
   * [createP5SoundObjs creates various P5 sound objects if AudioContext is supported]
   */
  function createP5SoundObjs() {
    soundFilter = new P5.LowPass();
    freezingFilter = new P5.HighPass();
    reverb = new P5.Reverb();
  }

	// main app init
	function init(lwData) {
    console.log('lwData', lwData);
    //Init scoped values
    var mainSeqCount = 0;
    var extraSeqCount = 0;
    var extraSeqPlaying = false;
    var brassOneScaleArrayIndex = 0;
    var brassTwoScaleArrayIndex = 0;
    var scaleSetIndex = 0;
    var padIndexCount = 0;
    var precipArpScale = [];
    var humidArpScale = [];
    var humidArpReady = false;
    var precipArpReady = false;
    var precipArpScaleIndex = 0;
    var humidArpScaleIndex = 0;
    var precipArpSteps = 0;
    var humidArpSteps = 0;
    var freezingFilterFreq = 2000;
    var windChimeRate = 1;
    var windChimeVol = 0.4;
    var masterGain = 0;
    //clear data
    padSounds = [];
    choralSounds = [];
    // grouped weather booleans
    var wCheck = {
      //single concept items
      isPrecip: weatherCheck.isPrecip(lwData.precipType, lwData.precipIntensity.value),
      isWindy: weatherCheck.isWindy(lwData.windSpeed.value),
      isCloudy: weatherCheck.isCloudy(lwData.cloudCover.value),
      //Humidity
      isHumid: weatherCheck.isHumid(lwData.humidity.value),
      isMuggy: weatherCheck.isMuggy(lwData.humidity.value, lwData.temperature.value),
      isArid: weatherCheck.isArid(lwData.humidity.value, lwData.temperature.value),
      isCrisp: weatherCheck.isCrisp(lwData.humidity.value, lwData.temperature.value),
      //temperature
      isCold: weatherCheck.isCold(lwData.temperature.value),
      isFreezing: weatherCheck.isFreezing(lwData.temperature.value),
      //broad conditions
      isFine: weatherCheck.isFine(lwData.cloudCover.value, lwData.windSpeed.value, lwData.temperature.value),
      isClement: weatherCheck.isClement(lwData.cloudCover.value, lwData.windSpeed.value, lwData.precipIntensity.value, lwData.humidity.value),
      isBitter: weatherCheck.isBitter(lwData.temperature.value, lwData.windSpeed.value),
      isStormy: weatherCheck.isStormy(lwData.cloudCover.value, lwData.windSpeed.value, lwData.precipIntensity.value),
      isViolentStorm: weatherCheck.isViolentStorm(lwData.cloudCover.value, lwData.windSpeed.value, lwData.precipIntensity.value)
    };
    console.log('wCheck', wCheck);
    //Get and set core values
    var numPadNotes = getNumPadNotes(wCheck, avSettings);
    var numChords = getNumChords(lwData).numChords;
    var numExtraChords = getNumChords(lwData, avSettings, wCheck).numExtraChords;
    var chordNumGreatest = numChords > numExtraChords ? numChords : numExtraChords;
    var numSemisPerOctave = getNumSemisPerOctave(avSettings, wCheck);
    var precipCategory = getPrecipCategory(lwData);
    var precipArpBpm = getPrecipArpBpm(lwData);
    var dropSoundKey = getDropSoundKey(precipCategory);
    var padType = getPadType(wCheck);
    var chordType = getChordType(wCheck);
    var inversionOffsetType = getInversionOffsetKey(wCheck);
    var humidArpBpm = getHumidArpBpm(lwData);
    var humidArpIntervals = getHumidArpIntervals(lwData, chordType);
    var seqRepeatNum = getMainSeqRepeatNum(lwData, numChords);
    var rootNote = getRootNote(lwData, numSemisPerOctave);
    var rootNoteHigh = isRootNoteHigh(rootNote);
    var longNoteIndex = getLongNoteIndex(lwData, numPadNotes);
    var longNoteOffset = getLongNoteOffset(lwData);
    var longNoteType = getLongNoteType(wCheck);
    var masterFilterFreq = getMasterFilterFreq(lwData);
    var chordSeqKey = getChordSeqKey(wCheck, rootNoteHigh);
    var cymbalsRate = getCymbalsRate(lwData);
    var cymbalsVolume = getCymbalsVolume(lwData);
    var cymbalsRideVolume = getCymbalsRideVolume(lwData);

		//Create p5 sketch
		var myP5 = new P5(function(sketch) {

      channel.subscribe('allStopped', function() {
        sketch.noLoop();
      });

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

      function getAllegrettoRhythm(scaleArray, includeFills) {
        var _newScaleArr = [];
        for (var i = 0; i < scaleArray.length; i++) {
          if (i % 2 === 0) {
            _newScaleArr.push(scaleArray[i]);
            _newScaleArr.push(0);
            _newScaleArr.push(scaleArray[i]);
            if (!includeFills) {
              _newScaleArr.push(scaleArray[i]);
            }
            if (includeFills) {
              _newScaleArr.splice(_newScaleArr.length - 1, 0, 0, 0, 0);
            }
          } else if (i % 2 !== 0) {
            _newScaleArr.push(scaleArray[i]);
            if (includeFills) {
              _newScaleArr.splice(_newScaleArr.length - 1, 0, 0, 0, 0);
              _newScaleArr.push(scaleArray[i]);
            }
          }
        }
        return _newScaleArr;
      }

      function getPanIndex(panIndex) {
        if (panIndex < panArr.length -1) {
          panIndex++;
        } else {
          panIndex = 0;
        }
        return panIndex;
      }

      function getAllegrettoRhythmType(humidArpScaleArray) {
        var _newNotesArray = [];
        //playlogic
        if (wCheck.isWindy) {
          _newNotesArray = getAllegrettoRhythm(humidArpScaleArray, true);
        } else {
          _newNotesArray = getAllegrettoRhythm(humidArpScaleArray, false);
        }
        return _newNotesArray;
      }

      function humidArpEnd(notesArray) {
        var _randomNote = sketch.random(notesArray);
        harpSoundTwo.disconnect();
        reverb.process(harpSoundTwo, 4, 10);
        reverb.amp(0.7);
        harpSoundTwo.rate(_randomNote * 2);
        harpSoundTwo.setVolume(1);
        harpSoundTwo.play();
      }

      function playHumidArp(humidArpScaleArray) {
        //Overwrite sequence with new notes
        humidArpScale = getAllegrettoRhythmType(humidArpScaleArray);
        humidArpReady = true;
      }

      function playPrecipArp(precipArpScaleArray) {
        //Overwrite sequence with new notes
        precipArpScale = addRandomStops(precipArpScaleArray).reverse();
        precipArpReady = true;
      }

      function playBrassBaritone(scale) {
        brassBaritone.rate(scale[brassOneScaleArrayIndex]);
        brassBaritone.setVolume(0.9);
        brassBaritone.play();
        if (brassOneScaleArrayIndex >= 1) {
          brassOneScaleArrayIndex = 0;
        } else {
          brassOneScaleArrayIndex++;
        }
      }

      function playBrassBaritoneTwo(scale) {
        var _newScaleArr = scale.slice().reverse();
        var _rateMultArr = [1, 2];
        var _randomRateMultVal = sketch.random(_rateMultArr);
        brassBaritone2.rate(_newScaleArr[brassTwoScaleArrayIndex] * _randomRateMultVal);
        brassBaritone2.setVolume(0.4);
        brassBaritone2.play();
        if (brassTwoScaleArrayIndex >= scale.length -1) {
          brassTwoScaleArrayIndex = 0;
        } else {
          brassTwoScaleArrayIndex++;
        }
      }

      function playLongNote(scale, extraSeqPlaying) {
        //playlogic
        var _longNote = longNotes[longNoteType];
        var _longNoteRate;
        _longNote.disconnect();
        _longNote.connect(soundFilter);
        if (longNoteOffset > 0) {
          _longNoteRate = scale[longNoteIndex] * 2;
        } else if (longNoteOffset < 0) {
          _longNoteRate = scale[longNoteIndex] / 2;
        } else {
          _longNoteRate = scale[longNoteIndex];
        }
        //Lower by one octave
        //if the lower chords are playing
        if (extraSeqPlaying) {
          _longNoteRate = _longNoteRate / 2;
        }
        _longNote.rate(_longNoteRate);
        _longNote.pan(sketch.random(panArr));
        _longNote.setVolume(sketch.random([0.1, 0.20, 0.5]));
        //_longNote.playMode('restart');
        _longNote.play();
      }

      function playBass(scale) {
        //Play 1st note of each chord
        bass.rate(scale[0]);
        bass.setVolume(0.5);
        bass.playMode('restart');
        bass.play();
      }

      function setScaleSetIndex(scaleSet, numExtraChords) {
        if (scaleSetIndex >= scaleSet.length - 1 - numExtraChords) {
          scaleSetIndex = 0;
        } else {
          scaleSetIndex++;
        }
        return scaleSetIndex;
      }

      function playPad(scaleSet, padTypeKey) {
        var _panIndex = 0;
        // Master sequence
        if (mainSeqCount === seqRepeatNum && numExtraChords > 0) {
          //If we've played the whole sequence
          //seqRepeatNum number of times
          //play the first chord of extraChords
          scaleSetIndex = scaleSet.length - numExtraChords + extraSeqCount;
          extraSeqCount++;
          extraSeqPlaying = true;
          //Once we've played all the extraChords
          //start over
          if (extraSeqCount === numExtraChords) {
            mainSeqCount = 0;
            extraSeqCount = 0;
          }
        } else {
          extraSeqPlaying = false;
          mainSeqCount++;
        }
        for (var i = 0; i < padSounds.length; i++) {
          padSounds[i][padTypeKey].disconnect();
          padSounds[i][padTypeKey].connect(soundFilter);
          padSounds[i][padTypeKey].rate(scaleSet[scaleSetIndex][i]);
          padSounds[i][padTypeKey].pan(panArr[_panIndex]);
          padSounds[i][padTypeKey].setVolume(avSettings[padTypeKey].volume);
          padSounds[i][padTypeKey].playMode('restart');
          padSounds[i][padTypeKey].play();
          padSounds[i][padTypeKey].onended(function() {
            padCallback(scaleSet, padTypeKey);
          });
          _panIndex = getPanIndex(_panIndex);
        }
        //playlogic
        //Avoid sound clash with Brass
        if (wCheck.isCloudy && !wCheck.isWindy) {
          playBass(scaleSet[scaleSetIndex]);
        }
        playLongNote(scaleSet[scaleSetIndex], extraSeqPlaying);
        //increment indices
        setScaleSetIndex(scaleSet, numExtraChords);
      }

      function padCallback(scaleSet, padTypeKey) {
        if (isPlaying) {
          padIndexCount++;
          // When all the sounds have played once, loop
          if (padIndexCount === padSounds.length) {
            playPad(scaleSet, padTypeKey);
            padIndexCount = 0;
          }
        }
      }

      function playChoralSound(scaleArray) {
        // playlogic
        choralSounds.forEach(function(choralSound, i) {
          // must loop before rate is set
          // issue in Chrome only
          if (wCheck.isFreezing) {
            choralSound.disconnect();
            choralSound.connect(freezingFilter);
          }
          choralSound.loop();
          //playlogic
          if (wCheck.isFreezing) {
            choralSound.rate(scaleArray[i] / 2);
            choralSound.setVolume(0.23);
          } else {
            choralSound.rate(scaleArray[i]);
            choralSound.setVolume(0.1);
          }
        });
      }

      /**
       * playSounds Handles playback logic
       * Though some of this is delegated
       * @param  {Array} padScales    sets of notes to play
       * @param  {Array} precipArpScaleArray a set of notes fot the sequencer to play
       * @param  {Array} humidArpScaleArray a set of notes fot the sequencer to play
       * @return {boolean}               default value
       */
			function playSounds(padScales, precipArpScaleArray, humidArpScaleArray) {
        // playlogic
        // Only the first chord is passed in
        if (wCheck.isFine || wCheck.isFreezing) {
          playChoralSound(padScales[0]);
        }
        // Play brass
        publishBrassOne = channel.subscribe('triggerBrassOne', function() {
          //playlogic
          if (wCheck.isWindy) {
            playBrassBaritone(padScales[scaleSetIndex]);
          }
        });
        publishBrassTwo = channel.subscribe('triggerBrassTwo', function() {
          //playlogic
          if (wCheck.isWindy) {
            playBrassBaritoneTwo(padScales[scaleSetIndex]);
          }
        });
        //Organ
        playPad(padScales, padType);
        //Clement arpeggio
        if (humidArpScaleArray.length > 0) {
          playHumidArp(humidArpScaleArray);
        }
        //Precipitation arpeggio
        if (precipArpScaleArray.length > 0) {
          playPrecipArp(precipArpScaleArray);
        }
        windChime.loop();
        windChime.rate(windChimeRate);
        windChime.setVolume(windChimeVol);
        //Tell rest of app we're playing
        isPlaying = true;
        channel.publish('playing', audioSupported);
			}

      /**
       * Critical function - if the correct number of octaves
       * are not produced the app fails
       * @param  {Number}  largestNumber  [highest positive number]
       * @param  {Number}  smallestNumber [highest negative number]
       * @param  {Number}  rootAndOffset  [root note plus the chord offset]
       * @param  {Number} semisInOct      [Number of semitones in octave]
       * @return {Object}                 [The scale and the total number of octaves]
       */
      function getAllNotesScale(largestNumber, smallestNumber, rootAndOffset, semisInOct) {
        var _highestNoteIndex = largestNumber + Math.abs(rootAndOffset);
        var _lowestNoteIndex = Math.abs(smallestNumber) + Math.abs(rootAndOffset);
        var _highestFraction = _highestNoteIndex / semisInOct;
        var _lowestFraction = _lowestNoteIndex / semisInOct;
        var _numUpperOctaves = Math.ceil(_highestFraction);
        var _numLowerOctaves = Math.ceil(_lowestFraction);
        var _totalOctaves = _numUpperOctaves + _numLowerOctaves;
        var _downFirst = false;
        if (_lowestNoteIndex > _highestNoteIndex) {
          _downFirst = true;
        }
        //console.log('creating array with ' + _totalOctaves + ' octaves ');
        var _allNotesScaleCentreNoteObj = getFreqScales.createEqTempMusicalScale(1, _totalOctaves, semisInOct, _downFirst);
        return {
          allNotesScale: _allNotesScaleCentreNoteObj.scale,
          centreNoteIndex: _allNotesScaleCentreNoteObj.centreFreqIndex,
          numOctaves: _totalOctaves
        };
      }

      /**
       * Returns a set of intervals that is
       * long enough for the sequence to play
       * @param  {Array} chosenIntervals  [Set of initial intervals]
       * @param  {Number} numNotes      [Number of notes needed]
       * @return {Array}                [current or new array]
       */
      function errorCheckIntervalsArr(chosenIntervals, numNotes, semisInOct, repeatMultiple) {
        var _newIntervals;
        var _difference = numNotes - chosenIntervals.length;
        var _semitonesInOct;
        var _repeatMultiple = repeatMultiple || 0;
        //When using non western scale
        //ensure numbers don't balloon
        if (semisInOct > avSettings.numSemitones) {
          _semitonesInOct = 0;
        } else {
          _semitonesInOct = semisInOct;
        }
        //Error check
        if (_difference > 0) {
          _newIntervals = addMissingArrayItems(chosenIntervals, _difference, _semitonesInOct, _repeatMultiple);
          console.log('added missing items to', _newIntervals);
        } else {
          _newIntervals = chosenIntervals;
        }
        return _newIntervals;
      }

      function errorCheckScaleIntervals(scaleIntervals, intervalIndexOffset, numNotes) {
        var _scaleIntervals = [];
        var _highestIndex = intervalIndexOffset + numNotes;
        if (_highestIndex > scaleIntervals.length) {
          var _diff = _highestIndex - scaleIntervals.length;
          _scaleIntervals = addMissingArrayItems(scaleIntervals, _diff, null, null);
        } else {
          _scaleIntervals = scaleIntervals;
        }
        return _scaleIntervals;
      }

      function getPitchesFromIntervals(allNotesScale, scaleIntervals, centreNoteIndex, numNotes, intervalIndexOffset, type) {
        //console.log('type of instrument', type);
        var _scaleArray = [];
        var _intervalIndexOffset = intervalIndexOffset || 0;
        //add missing scale intervals
        var _scaleIntervals = errorCheckScaleIntervals(scaleIntervals, _intervalIndexOffset, numNotes);
        var _newNote;
        for (var i = 0; i < numNotes; i++) {
          _newNote = allNotesScale[_scaleIntervals[_intervalIndexOffset] + centreNoteIndex];
          //error check
          if (_newNote !== undefined || isNaN(_newNote) === false) {
            _scaleArray.push(_newNote);
          } else {
            console.error('undefined or NaN note');
          }
          _intervalIndexOffset++;
        }
        return _scaleArray;
      }

      function createMusicalScale(numNotes, centreNoteOffset, key, intervalIndexOffset, repeatMultiple, type) {
        var _numOcts;
        var _allNotesScale = [];
        var _centreFreqIndex;
        var _scaleArray = [];
        var _rootAndOffset = rootNote + centreNoteOffset;
        var _scaleIntervals = errorCheckIntervalsArr(intervals[key], numNotes, numSemisPerOctave, repeatMultiple);
        var _largestPosNumber = getLargestPosNumInArr(_scaleIntervals);
        var _largestNegNumber = getLargestNegNumInArr(_scaleIntervals);
        //Once we know the total range required
        //get all the notes/frequencies
        var _allNotesNumOctsCentreFreq = getAllNotesScale(_largestPosNumber, _largestNegNumber, _rootAndOffset, numSemisPerOctave);
        _allNotesScale = _allNotesNumOctsCentreFreq.allNotesScale;
        _centreFreqIndex = _allNotesNumOctsCentreFreq.centreNoteIndex;
        _numOcts = _allNotesNumOctsCentreFreq.numOctaves;
        //Get centre note
        //After all notes scale has been created
        var _centreNoteIndex = _centreFreqIndex + _rootAndOffset;
        _scaleArray = getPitchesFromIntervals(_allNotesScale, _scaleIntervals, _centreNoteIndex, numNotes, intervalIndexOffset, type);
        return _scaleArray;
      }

      function getChordSeqOffsetArr(numChords) {
        var _chordOffsetArr = [];
        var _diff;
        _chordOffsetArr = intervals[chordSeqKey];
        // error check
        if (numChords > _chordOffsetArr.length) {
          _diff = numChords - _chordOffsetArr.length;
          _chordOffsetArr = addMissingArrayItems(_chordOffsetArr, _diff, null, null);
        }
        return _chordOffsetArr;
      }

      function getInversionOffsetArr(numChords) {
        var _chordInversionOffSetArr = intervals[inversionOffsetType];
        var _diff;
        if (numChords > _chordInversionOffSetArr.length) {
          _diff = numChords - _chordInversionOffSetArr.length;
          _chordInversionOffSetArr = addMissingArrayItems(_chordInversionOffSetArr, _diff, null, null);
        }
        return _chordInversionOffSetArr;
      }

      //If the key's not from a sequence
      //then get the generic chord type
      function getValidChordType(key) {
        var _chordType;
        if (key) {
          _chordType = key;
        } else {
          _chordType = chordType;
        }
        return _chordType;
      }

      function makeChordSequence() {
        var _chordSeq = [];
        //Chord shift
        var _chordSeqOffsetArr = getChordSeqOffsetArr(chordNumGreatest);
        //Chord inversion shift
        var _inversionOffsetArr = getInversionOffsetArr(chordNumGreatest);
        if (chordNumGreatest > _chordSeqOffsetArr.length) {
          _chordSeqOffsetArr = addMissingArrayItems(_chordSeqOffsetArr, chordNumGreatest - _chordSeqOffsetArr.length, null, null);
        }
        for (var i = 0; i < numChords; i++) {
          _chordSeq.push(createMusicalScale(numPadNotes, _chordSeqOffsetArr[i].index, getValidChordType(_chordSeqOffsetArr[i].key), _inversionOffsetArr[i], 0, 'pad'));
        }
        //Adding extra chord(s) - pitched down
        for (var j = 0; j < numExtraChords; j++) {
          _chordSeq.push(createMusicalScale(numPadNotes, _chordSeqOffsetArr[j].index - numSemisPerOctave, getValidChordType(_chordSeqOffsetArr[j].key), _inversionOffsetArr[j], 0, 'padLower'));
        }
        return _chordSeq;
      }

      function setFilter() {
        soundFilter.freq(masterFilterFreq);
        soundFilter.res(20);
      }

      function createHumidArpScale() {
        var _repeatMultiple = 0;
        var _intervalIndexOffset = 0;
        var _hArpCNoteOffset = 0;
        //playlogic
        if (wCheck.isFine) {
          _hArpCNoteOffset = -Math.abs(numSemisPerOctave);
        }
        return createMusicalScale(avSettings.numCArpNotes, _hArpCNoteOffset, humidArpIntervals, _intervalIndexOffset, _repeatMultiple, 'humid arp');
      }

      function createPrecipArpScale() {
        var _pArpCNoteOffset = -Math.abs(numSemisPerOctave * 2);
        var _repeatMultiple = 1;
        var _intervalIndexOffset = 0;
        var _intervalType;
        if (hasMajor(chordType)) {
          _intervalType = 'safeNthMajorIntervals';
        } else {
          _intervalType = 'safeNthMinorIntervals';
        }
        _repeatMultiple = 2;
        return createMusicalScale(avSettings.numRArpNotes, _pArpCNoteOffset, _intervalType, _intervalIndexOffset, _repeatMultiple, 'precip arp');
      }

      /*
      	Sound config algorithm
      	---------------
      	The distortion is set by cloud cover
      	The note volume is set by wind speed
      	The root key is set by the air pressure
      	The filter frequency is set by visibility
       */
			function configureSounds() {
        var _organScaleSets = [];
        var _precipArpScaleArray = [];
        var _humidArpScaleArray = [];
        //Make arrays of frequencies for playback
        _organScaleSets = makeChordSequence();
        // Set filter for pad sounds
        setFilter();
        //playlogic
        if (wCheck.isPrecip) {
          _precipArpScaleArray = createPrecipArpScale();
        }
        if (wCheck.isHumid && !wCheck.isPrecip) {
          _humidArpScaleArray = createHumidArpScale();
        }
        playSounds(_organScaleSets, _precipArpScaleArray, _humidArpScaleArray);
			}

      function outputChordSeqType() {
        if (chordSeqKey === 'noChordOffset') {
          return 'Using inversions';
        } else {
          return microU.addSpacesToString(chordSeqKey);
        }
      }

      function outputPrecipArpType() {
        if (precipCategory === 'hard') {
          return 'forwards';
        } else {
          return 'backwards';
        }
      }

      function setLwDataVals(rawCoDisplayData, lwDataArr) {
        return rawCoDisplayData.map(function(coDisplayObj) {
          for (var i = 0; i < lwDataArr.length; i++) {
            if (coDisplayObj.key === lwDataArr[i]) {
              coDisplayObj.value = lwData[lwDataArr[i]].value === undefined ? lwData[lwDataArr[i]] : lwData[lwDataArr[i]].value;
            }
          }
          return coDisplayObj;
        });
      }

      function setLwDataNegVals(coDisplayDataLw, lwDataArr) {
        return coDisplayDataLw.map(function(coDisplayObj) {
          for (var i = 0; i < lwDataArr.length; i++) {
            if (coDisplayObj.negativeKey === lwDataArr[i]) {
              console.log('there was an lwData negativeKey');
              coDisplayObj.negativeValue = lwData[lwDataArr[i]].value;
            }
          }
          return coDisplayObj;
        });
      }

      function setWcheckDataVals(coDisplayDataLwNeg, wCheckArr) {
        return coDisplayDataLwNeg.map(function(coDisplayObj) {
          for (var i = 0; i < wCheckArr.length; i++) {
            if (coDisplayObj.key === wCheckArr[i]) {
              coDisplayObj.value = wCheck[wCheckArr[i]];
            }
          }
          return coDisplayObj;
        });
      }

      function setWcheckDataNegVals(coDisplayDataWCheck, wCheckArr) {
        return coDisplayDataWCheck.map(function(coDisplayObj) {
          for (var i = 0; i < wCheckArr.length; i++) {
            if (coDisplayObj.negativeKey === wCheckArr[i]) {
              coDisplayObj.negativeValue = wCheck[wCheckArr[i]];
            }
          }
          return coDisplayObj;
        });
      }

      function mapConditionsToDisplayData(rawCoDisplayData) {
        var _lwDataArr = Object.keys(lwData);
        var _wCheckArr = Object.keys(wCheck);
        var _coDisplayDataLw = setLwDataVals(rawCoDisplayData, _lwDataArr);
        //TODO not sure this does anthing
        //because negativeValues can only apply to booleans
        var _coDisplayDataLwNeg = setLwDataNegVals(_coDisplayDataLw, _lwDataArr);
        var _coDisplayDataWCheck = setWcheckDataVals(_coDisplayDataLwNeg, _wCheckArr);
        var _coDisplayDataWCheckNeg = setWcheckDataNegVals(_coDisplayDataWCheck, _wCheckArr);
        return _coDisplayDataWCheckNeg;
      }

      function constrainDecimals(rawCoDisplayData) {
        return rawCoDisplayData.map(function(coProp) {
          if (typeof coProp.value === 'number' && coProp.constrain) {
            coProp.value = coProp.value.toFixed(2);
          }
          return coProp;
        });
      }

      function unitiseData(rawCoDisplayData) {
        return rawCoDisplayData.map(function(coProp) {
          if (coProp.key === 'temperature' || coProp.key === 'apparentTemperature') {
            coProp.value = frnhtToCelcius(coProp.value).toFixed(2);
            coProp.unit = 'C' + he.decode('&deg');
          }
          if (coProp.key === 'windBearing' || coProp.key === 'nearestStormBearing') {
            coProp.unit = he.decode('&deg');
          }
          if (coProp.key === 'cloudCover' || coProp.key === 'humidity') {
            coProp.unit = he.decode('&#37');
          }
          return coProp;
        });
      }

      function exceptionCheckData(rawCoDisplayData) {
        return rawCoDisplayData.map(function(coProp) {
          if (coProp.key === 'precipIntensity' && coProp.value === 0) {
            coProp.value = false;
          }
          return coProp;
        });
      }

      function setIconPath(rawCoDisplayData) {
        return rawCoDisplayData.map(function(coProp) {
          if (coProp.value) {
            if(coProp.key === 'precipType' || coProp.key === 'precipIntensity' || coProp.key === 'precipProbability') {
              coProp.iconPath = '/img/' + lwData.precipType + '-icon.svg';
            }
          }
          return coProp;
        });
      }

      function addPrimaryMusicVals(rawCoDisplayData) {
        return rawCoDisplayData.map(function(coProp) {
            switch (coProp.key) {
              case 'dewPoint':
                coProp.musicValue = numChords;
                break;
              case 'ozone':
                coProp.musicValue = numExtraChords;
                break;
              case 'pressure':
                coProp.musicValue = getRootNoteLetter(numSemisPerOctave, rootNote);
                break;
              case 'cloudCover':
                coProp.musicValue = Math.round(masterFilterFreq);
                break;
              case 'apparentTemperature':
                coProp.musicValue = Math.round(seqRepeatNum / numChords);
                break;
              case 'windSpeed':
                coProp.musicValue = windChimeRate.toFixed(2);
                break;
              case 'windBearing':
                coProp.musicValue = microU.getOrdinal(longNoteIndex);
                break;
              case 'temperature':
                coProp.musicValue = numSemisPerOctave;
                break;
              case 'visibility':
                coProp.musicValue = longNoteOffset;
                break;
              case 'precipIntensity':
                coProp.musicValue = precipArpBpm;
                break;
              case 'precipType':
                coProp.value = !coProp.value ? false : precipCategory + ' ' + coProp.value;
                coProp.musicValue = outputPrecipArpType();
                break;
              case 'precipProbability':
                coProp.musicValue = cymbalsRideVolume.toFixed(2);
                break;
              case 'nearestStormBearing':
                coProp.musicValue = cymbalsRate.toFixed(2);
                break;
              case 'nearestStormDistance':
                coProp.musicValue = cymbalsVolume.toFixed(2);
                break;
              case 'windSpeedHigh':
                coProp.musicValue = humidArpBpm;
                break;
              case 'isWindyArp':
                coProp.musicValue = humidArpIntervals;
                break;
            }
          return coProp;
        });
      }

      function isvalidConditionTrue(displayDataGroup) {
          var _anyValidPropTrue = false;
          for (var i = 0; i < displayDataGroup.length; i++) {
            if (displayDataGroup[i].key !== 'isOther' && displayDataGroup[i].value) {
              return true;
            }
          }
          return _anyValidPropTrue;
      }

      function addOtherMapVals(displayDataGroup, musicVal) {
        //TODO really we should only use the first truthy value
        //rather than multiple ones
        var _validConditionTrue = isvalidConditionTrue(displayDataGroup);
        return displayDataGroup.map(function(displayProp) {
          //if any other value is true
          if (displayProp.key === 'isOther' && _validConditionTrue) {
            displayProp.value = false;
          }
          if (displayProp.hasOwnProperty('musicValue')) {
            displayProp.musicValue = musicVal;
          }
          return displayProp;
        });
      }

      function setHumidMapVals(displayDataGroup) {
        return displayDataGroup.map(function(displayProp) {
          //Set to false if not humid
          //thus not rendering them
          if (!wCheck.isHumid) {
            displayProp.value = false;
          }
          if (displayProp.key === 'humidity') {
            displayProp.musicValue = humidArpBpm;
          } else if (displayProp.key === 'pressure') {
            displayProp.musicValue = humidArpIntervals;
          }
          return displayProp;
        });
      }

      function formatCoStrings(displayData) {
        return displayData.map(function(displayProp) {
          var _musicValue;
          //Add spaces where necessary
          if (typeof displayProp.musicValue === 'string') {
            _musicValue = microU.removeStrFromStart('inversions', displayProp.musicValue);
            displayProp.musicValue = microU.addSpacesToString(_musicValue);
          } else {
            displayProp.musicValue = displayProp.musicValue;
          }
          return displayProp;
        });
      }

      function configureDisplay() {
        var _finalCoData = [];
        var _currArr;
        for (var coDataGroup in coDisplayData) {
          if (coDisplayData.hasOwnProperty(coDataGroup)) {
            //Assign condition values, images and units
            var _mappedDisplayData = mapConditionsToDisplayData(coDisplayData[coDataGroup]);
            var _unitisedDisplayData = unitiseData(_mappedDisplayData);
            var _exceptionCheckedData = exceptionCheckData(_unitisedDisplayData);
            var _iconisedData = setIconPath(_exceptionCheckedData);
            var _constrainedDisplayData = constrainDecimals(_iconisedData);
            //Assgin music values
            switch (coDataGroup) {
              case 'primaryMap':
                _currArr = addPrimaryMusicVals(_constrainedDisplayData);
                break;
              case 'chordTypeMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, chordType);
                break;
              case 'chordSeqTypeMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, outputChordSeqType());
                break;
              case 'padTypeMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, padType);
                break;
              case 'longNoteTypeMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, longNoteType);
                break;
              case 'inversionMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, inversionOffsetType);
                break;
              case 'numNotesMap':
                _currArr = addOtherMapVals(_constrainedDisplayData, numPadNotes);
                break;
              case 'humidArpMap':
                _currArr = setHumidMapVals(_constrainedDisplayData);
                break;
            }
            //Convert sets to one single array
            _finalCoData.push.apply(_finalCoData, _currArr);
          }
        }
        //Format strings and numbers
        var _formatCoStrings = formatCoStrings(_finalCoData);
        _formatCoStrings.forEach(function(coProp) {
          //Only show true or valid values
          //Zero is valid for most conditions
          if (coProp.value !== undefined && coProp.value !== false) {
            //filter out negative values that are true
            //or don't exist
            if (coProp.negativeValue === undefined || coProp.negativeValue === false) {
              var _itemTmpl = appTemplate(coProp);
              cdContainer.insertAdjacentHTML('beforeend', _itemTmpl);
              var _lastItem = cdContainer.lastElementChild;
              fadeInDisplayItem(_lastItem);
            }
          } else {
            //console.log('Not displayed because not defined or false ', coProp);
          }
        });
      }

			//Sound constructor
			//changes to this may need to be reflected
			//within the volume objects in avSettings
			function PadSound(organ, guitar, sax, aeroflute, zummarta, horn) {
				this.organ = organ;
				this.guitar = guitar;
				this.saxophone = sax;
				this.aeroflute = aeroflute;
				this.zummarta = zummarta;
				this.horn = horn;
			}

      function LongNotes(harmonica, flute, harmonium, string) {
        this.harmonica = harmonica;
        this.flute = flute;
        this.harmonium = harmonium;
        this.string = string;
      }

      function DropSounds(dropSound, dropSoftSound, dropLightSound) {
        this.dropSound = dropSound;
        this.dropSoftSound = dropSoftSound;
        this.dropLightSound = dropLightSound;
      }

			sketch.preload = function() {
				//loadSound called during preload
				//will be ready to play in time for setup
        if (audioSupported) {
          //Pad sounds for various weather types
          for (var i = 0; i < numPadNotes; i++) {
            padSounds.push(new PadSound(
              sketch.loadSound('/audio/organ-C2.mp3'),
              sketch.loadSound('/audio/guitar-C2.mp3'),
              sketch.loadSound('/audio/sax-C2.mp3'),
              sketch.loadSound('/audio/aeroflute-C2.mp3'),
              //TODO try this
              //sketch.loadSound('/audio/zummarta-C2.mp3'),
              sketch.loadSound('/audio/harmonium-C2.mp3'),
              sketch.loadSound('/audio/horn-C2.mp3')
            ));
          }
          //choral sounds for fine weather
          for (var j = 0; j < 2; j++) {
            choralSounds.push(sketch.loadSound('/audio/choral.mp3'));
          }
          dropSounds = new DropSounds(
            sketch.loadSound('/audio/drop.mp3'),
            sketch.loadSound('/audio/drop-soft.mp3'),
            sketch.loadSound('/audio/drop-light.mp3')
          );
          bass = sketch.loadSound('/audio/bass.mp3');
          brassBaritone = sketch.loadSound('/audio/brass-baritone.mp3');
          brassBaritone2 = sketch.loadSound('/audio/brass-baritone.mp3');
          harpSound = sketch.loadSound('/audio/harp-C3.mp3');
          harpSoundTwo = sketch.loadSound('/audio/harp-C3.mp3');
          longNotes = new LongNotes(
            sketch.loadSound('/audio/harmonica-C3.mp3'),
            sketch.loadSound('/audio/flute-C3.mp3'),
            sketch.loadSound('/audio/shiney-C3.mp3'),
            sketch.loadSound('/audio/string-C3.mp3')
          );
          windChime = sketch.loadSound('/audio/wooden-wind-chime-edit3a.mp3');
          cymbals = sketch.loadSound('/audio/cymbals.mp3');
          cymbalsRide = sketch.loadSound('/audio/cymbals2.mp3');
        }
			};

			sketch.setup = function setup() {
				sketch.frameRate(appFrameRate);
        //---------------------
        //set runtime constants
        //--------------------
				avSettings.animAmount = Math.round(lwData.windSpeed.value);
				avSettings.noiseInc = sketch.map(avSettings.animAmount, lwData.windSpeed.min, lwData.windSpeed.max, 0.01, 0.05);
        temperatureColour = sketch.map(lwData.temperature.value, lwData.temperature.min, lwData.temperature.max, 25, 255);
        // playlogic
        windChimeRate = sketch.map(lwData.windSpeed.value, lwData.windSpeed.min, lwData.windSpeed.max, 0.5, 1.4);
        windChimeVol = sketch.map(lwData.windSpeed.value, lwData.windSpeed.min, lwData.windSpeed.max, 0.1, 0.6);
        //--------------------------
        // Handle sounds / Start app
        // -------------------------
        if (audioSupported) {
          configureSounds();
          configureDisplay();
        } else {
          updateStatus('error', lwData.name, true);
        }
			};

      function updateCymbals() {
        if (sketch.frameCount % 1000 === 0 && sketch.frameCount !== 0) {
          cymbals.play();
          cymbals.setVolume(cymbalsVolume);
          cymbals.rate(cymbalsRate);
        }
      }

      function updateCymbalsRide() {
        if (sketch.frameCount % 1450 === 0 && sketch.frameCount !== 0) {
          cymbalsRide.play();
          cymbalsRide.setVolume(cymbalsRideVolume);
          cymbalsRide.rate(cymbalsRate);
        }
      }

      function updateBrass() {
        if (angle > 360) {
          angle = 0;
        }
        sinVal = sketch.sin(angle);
        cosVal = sketch.cos(angle);
        brassBaritone.pan(sinVal);
        brassBaritone2.pan(cosVal);
        if (sketch.frameCount % 350 === 0) {
          channel.publish('triggerBrassOne');
        }
        if (sketch.frameCount % 650 === 0) {
          channel.publish('triggerBrassTwo');
        }
        angle += 0.03;
      }

      function updateFilter() {
        if (freezingFilterFreq >= 5500) {
          freezingFilterFreq = 0;
        }
        freezingFilter.freq(freezingFilterFreq);
        freezingFilter.res(33);
        freezingFilterFreq++;
      }

      function updateHumidArp() {
        if (sketch.frameCount % humidArpBpm === 0) {
          if (humidArpScaleIndex >= humidArpScale.length) {
            humidArpScaleIndex = 0;
          }
          harpSound.rate(humidArpScale[humidArpScaleIndex]);
          harpSound.setVolume(0.5);
          harpSound.play();
          humidArpScaleIndex++;
        }
        else {
          humidArpEnd(humidArpScale);
        }
        //humidArpSteps++;
      }

      function updatePrecipArp() {
        if (sketch.frameCount % precipArpBpm === 0) {
          if (precipArpScaleIndex >= precipArpScale.length) {
            precipArpScaleIndex = 0;
          }
          dropSounds[dropSoundKey].rate(precipArpScale[precipArpScaleIndex]);
          dropSounds[dropSoundKey].setVolume(0.35);
          dropSounds[dropSoundKey].play();
          precipArpScaleIndex++;
        }
        //precipArpSteps++;
      }

			sketch.draw = function draw() {
        //playlogic
        if (wCheck.isCloudy || wCheck.isWindy) {
          updateCymbals();
          updateCymbalsRide();
        }
        if (wCheck.isWindy) {
          updateBrass();
        }
        if (wCheck.isPrecip) {
          if (precipArpReady && sequenceStart) {
            updatePrecipArp();
          }
        }
        if (wCheck.isHumid && !wCheck.isPrecip) {
          if (humidArpReady && sequenceStart) {
            updateHumidArp();
          }
        }
        if (wCheck.isFreezing) {
          updateFilter();
        }
        //sequencer counter
        if (sketch.frameCount % 2000 === 0 && sequenceStart === false) {
          sequenceStart = true;
          console.log('sequenceStart', sequenceStart);
        } else if (sketch.frameCount % 2000 === 0 && sequenceStart === true) {
          sequenceStart = false;
          console.log('sequenceStart', sequenceStart);
        }
        //Master volume
        //Fade in on play
        sketch.masterVolume(masterGain);
        if (masterGain < 0.9) {
          masterGain += 0.01;
        }
			};

		});
		return myP5;
	}

  // Check for audioContext support
  function isAudioSuppored() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return false;
    } else {
      return true;
    }
  }

	channel.subscribe('userUpdate', function(data) {
    audioSupported = isAudioSuppored();
    createP5SoundObjs();
    init(data);
	});

  channel.subscribe('dialogOpen', function() {
    dialogIsOpen = true;
  });

  channel.subscribe('dialogClosed', function() {
    dialogIsOpen = false;
  });

  function clearAndStopWhenDone(autoStart) {
    cdContainer.innerHTML = '';
    killCurrentSounds(autoStart);
  }

  channel.subscribe('stop', function(autoStart) {
    var _allDisplayItems = document.querySelectorAll('.conditions-display__item');
    for (var i = 0; i < _allDisplayItems.length; i++) {
      fadeOutDisplayItems(_allDisplayItems[i], i, _allDisplayItems.length, clearAndStopWhenDone, autoStart);
    }
  });

	return true;
};
