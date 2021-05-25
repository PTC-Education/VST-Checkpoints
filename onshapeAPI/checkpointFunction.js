// Imports
var app = require('./lib/app.js');
var transform = require('./lib/transform.js');

// Onshape UR3e did, wid, eid, mvid
var did = "c4a311bb3aa38b94a0d9c83e";
var wid = "deca35608594128b69b0499a";
var eid = "41517917aefcc32b9d33e45c";
var mvid = "1c8d03a5b17f4eef07e7e342"; //Not used

// Checkpoint did, wid, eids, vid
var checkDid = "a1b859a8fa32ed77b6a98ef0";
var checkWid = "711d62fc0d00fce4a0289d79"; //Not used
var checkEids = ["494c89e6e3215f70111cd3c2", "da5e98cd4c5a99b798d4b535", "0d734f02d126f9709af97135", 
                "01062dc9ed41da3048e367c5", "faab2292c8ca63cde91c5d3b", "ce22671a39afc98d6af36870",
                "c94afff1a9e9ce98dd4dc6cc", "2c134f08d6d63891c70f80d8", "8fcda527e84876555f7d16d9",
                "e0c13b2d5840c1bc5d6a9e8b"];
var checkVid = "9e58b30feb62f9e3f35bc59e";
maxCheckpoints = checkEids.length;

rotation = [1, 0, 0, 0];

// Function that makes a checkpoint and then moves it to toolboxPos
var makeCheckpoint = function(toolboxPos, cb) {
    let pos = toolboxPos.concat(rotation);
    sortCheckpoints(function(checkpoints){
        if (checkpoints.length >= maxCheckpoints) {
            currCheckpoint = 0;
        }
        else {
            currCheckpoint = checkpoints.length;
        }
        app.createAssemblyInstance(did, wid, eid, checkDid, checkEids[currCheckpoint], checkVid, function(data){
            sortCheckpoints(function(checkpoints){
                transform.getTranslationMatrix(pos, false, function(M){
                    app.transformOccurrence(did, wid, eid, M, false, [checkpoints[checkpoints.length-1]["id"]], function(data){
                        console.log(data);
                        cb(data);
                    })
                })
            })
        })
    })
}

// Function that updates the checkpoint number by sending it to position toolboxPos
var updateCheckpoint = function(number, toolboxPos, cb) {
    let args = toolboxPos.concat(rotation);

    sortCheckpoints(function(checkpoints){
        if (number < checkpoints.length){
            transform.getTranslationMatrix(args, false, function(M){
                app.transformOccurrence(did, wid, eid, M, false, [checkpoints[number]["id"]], function(data){
                    cb(data);
                })
            })
        }
    })
}

// Function that deletes the checkpoint number
var deleteCheckpoints = function(cb) {
    sortCheckpoints(function(checkpoints){
        for(i = 0; i < checkpoints.length; i++){
            app.deleteAssemblyInstance(did, wid, eid, checkpoints[i]["id"], function(data){
                cb(data);
            })
        }
    })
}

// Function that gets the checkpoint XYZ positions in numerical order
var getCheckpointPositions = function(cb){
    sortCheckpoints(function(checkpoints){
        partIds = [];
        for (var i = 0; i < checkpoints.length; i++){
            partIds[i] = checkpoints[i]["id"];
        }
        app.assemblyDefinition(did, 'w', wid, eid, function(data){
            let assembly = JSON.parse(data)
            let occurrences = assembly["rootAssembly"]["occurrences"];
            positions = [];
            for (var i = 0; i < partIds.length; i++){
                for (var j = 0; j < occurrences.length; j++){
                    if (occurrences[j]["path"].length == 1 && partIds[i] == occurrences[j]["path"][0]){
                        decodeMatrix(occurrences[j]["transform"], function(position){
                            positions[i] = position;
                        })
                    }
                }
            }
            cb(positions)
        })
    })
}

// Set the did, wid, and eid of the Onshape document
var setOnshapeParams = function(toolboxDid, toolboxWid, toolboxEid, cb) {
    did = toolboxDid;
    wid = toolboxWid;
    eid = toolboxEid;
    cb("Set params");
}

// Function that gets XYZ positions from the transform matrix
function decodeMatrix(transform, cb){
    position = [transform[3], transform[7], transform[11]];
    cb(position)
}

// Function that sorts the checkpoints numerically
function sortCheckpoints(cb){
    var checkpoints = [];
    let sorted_checkpoints = [];
    app.assemblyDefinition(did, 'w', wid, eid, function(data){
        let assembly = JSON.parse(data);
        for (var i = 0; i < assembly["rootAssembly"]["instances"].length; i++){
            if (assembly["rootAssembly"]["instances"][i]["name"].includes("Checkpoint")){
                checkpoints.push(assembly["rootAssembly"]["instances"][i]);
            }
        }
        for (var i = 0; i < checkpoints.length; i++){
            for (var j = 0; j < checkpoints.length; j++){
                if (checkpoints[j]['name'].includes("Checkpoint " + (i+1).toString() + " <")){
                    sorted_checkpoints.push(checkpoints[j]);
                }
            }
        }
        if(sorted_checkpoints.length > maxCheckpoints){
            sorted_checkpoints = sorted_checkpoints.concat(sorted_checkpoints.splice(1,sorted_checkpoints.length-maxCheckpoints));
        }
        cb(sorted_checkpoints);
    })    
}

// Exported functions
module.exports = {
    makeCheckpoint: makeCheckpoint,
    updateCheckpoint: updateCheckpoint,
    deleteCheckpoints: deleteCheckpoints,
    getCheckpointPositions: getCheckpointPositions,
    setOnshapeParams: setOnshapeParams
}