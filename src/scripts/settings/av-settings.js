//Audio Visual Settings
module.exports = {
  animAmount: 1,
  noiseInc: 0.01,
  //Colour offset
  colourDim: 18,
  //Pitch / rate / volume
  dropSoundVol: {
    hard: 1,
    soft: 0.8,
    light: 0.7,
  },
  volume: 0.75,
  //padSounds
  aeroflute: {volume : 0.5},
  guitar: {volume : 0.425},
  harmonium: {volume : 0.5},
  homeswinger: {volume : 0.6},
  organ: {volume : 0.75},
  saxophone: {volume : 0.75},
  vocal: {volume : 0.75},
  numPadNotes: 5,
  numChords: 3,
  numChordsMin: 2,
  numChordsMax: 6,
  mainSeqRepeat: 2,
  mainSeqRepeatMin: 1,
  mainSeqRepeatMax: 6,
  noteLengthMultMin: 1,
  noteLengthMultMax: 5,
  numPrecipArpNotes: 12,
  numHumidArpNotes: 6, //should match closeIntervals
  numOctaves: 2,
  numSemitones: 12,
  scaleStartIndexBuffer: 10,
  pitchOffsetInc: 0.5,
  fadeTime: 1,
  //Frequency
  //Lowest (10 Hz) to highest (22,050 Hz)
  masterFilter: {
    min: 700,
    max: 5000
  },
	//DOM
	cContainerName: 'canvas-container'
};
