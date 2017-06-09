(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var PitchDetect = require('pitch-detect')

function geter(stream) {
    var results = pitchDetect.getPitch();
    document.querySelector("#setvalue").innerHTML = "<strong>Fréquence: </strong>" + Math.round(results.pitch) +
        " Hz<br/><strong>Note: </strong>" + results.note;
}

if(navigator.getUserMedia) {
    navigator.getUserMedia({
    audio: true,
    video: false
}, successCallback, errorCallback);
} else {
    document.querySelector("#setvalue").innerHTML = "Ton navigateur Internet n'est pas supporté. Change et passe à Google Chrome !"
}


function successCallback(stream) {
    var video = document.querySelector('audio');
    video.src = window.URL.createObjectURL(stream);
    video.volume = 0;
    pitchDetect = new PitchDetect(stream);
    setInterval(geter, 100, stream)

}

function errorCallback() {
    document.querySelector("#setvalue").innerHTML = "Mets un micro !";
}
},{"pitch-detect":3}],2:[function(require,module,exports){
"use strict";

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

var api = {
  noteNumberFromPitch: function noteFromPitch(frequency) {
    var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
  },
  frequencyFromNoteNumber: function frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  },
  centsOffFromPitch: function centsOffFromPitch(frequency, note) {
    return Math.floor(1200 * Math.log(frequency / this.frequencyFromNoteNumber(note)) / Math.log(2));
  },
  noteFromPitch: function noteFromPitch(frequency) {
    return noteStrings[this.noteNumberFromPitch(frequency) % 12];
  }
};

module.exports = api;
},{}],3:[function(require,module,exports){
'use strict';

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var notes = require('./notes.js');
var AudioContext = window.AudioContext || window.webkitAudioContext;
var BUFFER_LENGTH = 1024;

var calculateRMS = function calculateRMS(audioBuffer) {
  var bufLength = audioBuffer.length;

  var rms = 0,
      i = undefined;

  for (i = 0; i < bufLength; i++) {
    rms += audioBuffer[i] * audioBuffer[i];
  }

  return Math.sqrt(rms / bufLength);
};

var autoCorrelate = function autoCorrelate(audioBuffer, sampleRate) {
  var SIZE = audioBuffer.length;
  var MAX_SAMPLES = Math.floor(SIZE / 2);
  var MIN_SAMPLES = 0;

  var bestOffset = -1;
  var bestCorrelation = 0;
  var rms = calculateRMS(audioBuffer);
  var foundGoodCorrelation = false;
  var correlations = new Array(MAX_SAMPLES);
  var i = undefined;
  var lastCorrelation = undefined;
  var offset = undefined;
  var correlation = undefined;

  // not enough signal
  if (rms < 0.01) {
    return -1;
  }

  lastCorrelation = 1;

  for (offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
    correlation = 0;

    for (i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(audioBuffer[i] - audioBuffer[i + offset]);
    }

    correlation = 1 - correlation / MAX_SAMPLES;

    // store it, for the tweaking we need to do below.
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
      // Now we need to tweak the offset - by interpolating between the values to the left and right of the
      // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
      // we need to do a curve fit on correlations[] around bestOffset in order to better determine precise
      // (anti-aliased) offset.

      // we know bestOffset >=1,
      // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
      // we can't drop into this clause until the following pass (else if).
      var shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
      return sampleRate / (bestOffset + 8 * shift);
    }

    lastCorrelation = correlation;
  }

  if (bestCorrelation > 0.01) {
    return sampleRate / bestOffset;
  }

  return -1;
};

var PitchDetect = (function () {
  function PitchDetect(stream) {
    _classCallCheck(this, PitchDetect);

    if (stream.ended) {
      return console.warn('Can not use PitchDetect on an ended stream');
    }

    this.stream = stream;
    this.audioContext = new AudioContext();
    this.audioBuffer = new Float32Array(BUFFER_LENGTH);

    this.enumerateStream();
  }

  _createClass(PitchDetect, [{
    key: 'enumerateStream',
    value: function enumerateStream() {
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.mediaStreamSource.connect(this.analyser);
    }
  }, {
    key: 'getPitch',
    value: function getPitch() {
      var pitch = undefined;

      this.analyser.getFloatTimeDomainData(this.audioBuffer);
      pitch = autoCorrelate(this.audioBuffer, this.audioContext.sampleRate);

      if (pitch == -1) {
        return {
          type: 'vague'
        };
      } else {
        var noteNumber = notes.noteNumberFromPitch(pitch);
        var note = notes.noteFromPitch(pitch);
        var detune = notes.centsOffFromPitch(pitch, notes.noteNumberFromPitch(pitch));

        return {
          type: 'confident',
          pitch: pitch,
          noteNumber: noteNumber,
          note: note,
          detune: detune,
          flat: detune < 0,
          sharp: detune >= 0
        };
      }
    }
  }]);

  return PitchDetect;
})();

module.exports = PitchDetect;
},{"./notes.js":2}]},{},[1]);
