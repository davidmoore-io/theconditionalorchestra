'use strict';

var arrayInsertAt = require('./array-insert-at');

module.exports = (function generateFrequencyScales() {
    /**
    * [createUpperScale Create a musical scale starting at a given frequency and counting up or down]
    * @param  {[Number]} startFreq     [A frequency or number to start at]
    * @param  {[Number]} numTones      [the number of tones (or semitone) in an octave ]
    * @param  {[Boolean]} includeOctave [a Boolean which determines whether an closing note is applied or not ]
    * @return {[Array]}               [an array containing all the frequencies in the scale]
    */

    var CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    function createScale(startFreq, numTones, includeOctave, upwardsScale) {
      var _scale = [];
      var _freqHigh;
      var _freqLow;
      var _toneLoopLength = numTones;
      if (includeOctave) {
        _toneLoopLength = numTones + 1;
      }
      if (upwardsScale) {
        for (var i = 1; i < _toneLoopLength; i++) {
          _freqHigh = startFreq * Math.pow(2, i/numTones);
          _scale.push(_freqHigh);
        }
      } else {
        for (var j = _toneLoopLength; j > 0; j--) {
          _freqLow = startFreq / Math.abs(Math.pow(2, j/numTones));
          _scale.push(_freqLow);
        }
      }
      return _scale;
    }

    /**
     * [findCentreFreqIndex finds the index in an array of notes or tones based on the number of octaves and semitones]
     * essentially it finds the median
     * @param  {[Number]} numOctaves   [the number of octaves in the scale]
     * @param  {[Number]} numSemitones [the number of semitones per octave]
     * @return {[Number]}              [the index representing the start frequency]
     */
    function findCentreFreqIndex(numOctaves, numSemitones, downFirst) {
      var _totalNotes = numOctaves * numSemitones;
      var _noteIndex = null;
      //odd
      if(numOctaves % 2 === 1) {
        //If we went down first
        if (downFirst) {
          _noteIndex = numSemitones * ((numOctaves + 1) / 2);
        }
        //If we went up first
        else {
          _noteIndex = numSemitones * ((numOctaves - 1) / 2);
        }
        return _noteIndex;
      }
      //even
      else {
        _noteIndex = _totalNotes / 2;
        return _noteIndex;
      }
    }

    /**
     * [createJustMusicalExpScale creates an equal temperament musical scale of any length]
     * @param  {[Number]} startFreq    [a number representing the frequency or pitch]
     * @param  {[Number]} numOctaves   [the number of octaves to create]
     * @param  {[Number]} numSemitones [the number of semitones per octave]
     * @return {[Array]}              [an array of frequencies or pitches]
     */
    function createEqTempMusicalScale(startFreq, numOctaves, numSemitones, downFirst) {
      var _scale = [];
      var _centreFreqIndex = findCentreFreqIndex(numOctaves, numSemitones, downFirst);
      var _posCount = startFreq;
      var _negCount = startFreq;
      var _modRemainder = 1;
      if (downFirst) {
        _modRemainder = 0;
      } else {
        _modRemainder = 1;
      }
      for (var i = 0; i < numOctaves; i++) {
        //Create downwards _scale
        if (i % 2 === _modRemainder) {
          //always insert the smallest freqs at the start
          _scale = arrayInsertAt(_scale, 0, createScale(_negCount, numSemitones, false, false));
          _negCount = _negCount / 2;
        } else {
          //Create upwards _scale
          _scale = _scale.concat(createScale(_posCount, numSemitones, true, true));
          _posCount *= 2;
        }
      }
      //Add centre frequency
      _scale.splice(_centreFreqIndex, 0, startFreq);
      return {
        scale : _scale,
        centreFreqIndex : _centreFreqIndex
      };
    }

    return {
        createEqTempMusicalScale: createEqTempMusicalScale,
        CHROMATIC_SCALE: CHROMATIC_SCALE
    };
})();
