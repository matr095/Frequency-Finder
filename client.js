var PitchDetect = require('pitch-detect')

function geter(stream) {
    var results = pitchDetect.getPitch();
    document.querySelector("#setvalue").innerHTML = "<strong>Fréquence: </strong>" + Math.round(results.pitch)
    + " Hz<br/><strong>Note: </strong>" + results.note;
}

navigator.getUserMedia({audio:true,video:false}, successCallback, errorCallback);
function successCallback (stream) { 
   var video = document.querySelector('audio');
   video.src = window.URL.createObjectURL(stream);
   video.volume = 0;
   pitchDetect = new PitchDetect(stream);
   setInterval(geter, 100, stream)
    
}
function errorCallback () {
    console.log("navigator not supported")
}