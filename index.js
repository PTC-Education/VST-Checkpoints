//Carter Silvey

var server = require('@libraries/hardwareInterfaces');
var api = require('./onshapeAPI/checkpointFunction.js');
var settings = server.loadHardwareInterface(__dirname);

var TOOL_NAME = "checkpoint"; // This is what is made on the webserver for the image target
let objectName = "checkpointNode"; // This is the name of the folder in spatialToolbox in Documents 

exports.enabled = settings('enabled');
exports.configurable = true;

let inMotion = false;                   // When robot is moving
let pathData = [];                      // List of paths with checkpoints
let activeCheckpointName = null;        // Current active checkpoint
var onshapeX, onshapeY;

if (exports.enabled){
    // Code executed when your robotic addon is enabled
    setup();
    console.log('checkpoint: Settings loaded: ', objectName)
    console.log("Checkpoint is connected");

    // Sets up the settings that can be customized on localhost:8080
    function setup() {
        exports.settings = {
            // Name for the object
            checkpointName: { // CHANGED HERE --> Name is changed here 
                value: settings('checkpointName', objectName),
                type: 'text',
                default: objectName,
                disabled: true,
                helpText: 'The name of the object that connects to this hardware interface.'
            },
            // documentId
            checkpointOnshapeUrl: {
                value: settings('checkpointOnshapeUrl', "url"),
                type: 'text',
                default: 'url',
                disabled: false,
                helpText: 'The URL of the Onshape model to insert checkpoints into.'
            },
            // Onshape origin offset in X
            checkpointRobotOffsetX: {
                value: settings('checkpointOnshapeOffsetX', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The X axis offset from the image target to base of the robot.'
            },
            // Onshape origin offset in Y
            checkpointRobotOffsetY: {
                value: settings('checkpointOnshapeOffsetY', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The Y axis offset from the image target to base of the robot.'
            },
            checkpointRobotOffsetZ: {
                value: settings('checkpointOnshapeOffsetZ', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The Z axis offset from the image target to base of the robot.'
            },
            checkpointOnshapeOffsetX: {
                value: settings('checkpointOnshapeOffsetX', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The X axis offset from the Onshape origin.'
            },
            // Onshape origin offset in Y
            checkpointOnshapeOffsetY: {
                value: settings('checkpointOnshapeOffsetY', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The Y axis offset from the Onshape origin.'
            },
            checkpointOnshapeOffsetZ: {
                value: settings('checkpointOnshapeOffsetZ', 0),
                type: 'number',
                default: 0,
                disabled: false,
                helpText: 'The Z axis offset from the Onshape origin.'
            }
        };
    }

    // Get the settings that the user defined on localhost:8080
    objectName = exports.settings.checkpointName.value;
    console.log("checkpoint: " + objectName)
    onshapeUrl = exports.settings.checkpointOnshapeUrl.value; //parse
    robotOffsetX = exports.settings.checkpointRobotOffsetX.value;
    robotOffsetY = exports.settings.checkpointRobotOffsetY.value;
    robotOffsetZ = exports.settings.checkpointRobotOffsetZ.value;
    onshapeOffsetX = exports.settings.checkpointOnshapeOffsetX.value;
    onshapeOffsetY = exports.settings.checkpointOnshapeOffsetY.value;
    onshapeOffsetZ = exports.settings.checkpointOnshapeOffsetZ.value;

    if (onshapeUrl != 'url') {
        onshapeUrl = onshapeUrl.replace(/\n/g,'');
        console.log("checkpoint thinks it is connected to: " + onshapeUrl);
        onshapeUrl_object = onshapeUrl.split('/');
        if(onshapeUrl_object.length >= 9) {
            documentId = onshapeUrl_object[4]; 
            workspaceId = onshapeUrl_object[6]; 
            elementId = onshapeUrl_object[8];
        }
        else if (onshapeUrl_object.length >= 7) {
            documentId = onshapeUrl_object[2]; 
            workspaceId = onshapeUrl_object[4]; 
            elementId = onshapeUrl_object[6];
        }
        api.setOnshapeParams(documentId, workspaceId, elementId, function(data){
            console.log(data);
        });
    }

    server.addEventListener('reset', function () {
        settings = server.loadHardwareInterface(__dirname);
        setup();

        console.log('checkpoint: Settings loaded: ', objectName);
    });
}

function startHardwareInterface() {
    console.log('checkpoint: Starting up')

    server.enableDeveloperUI(true)

    console.log('checkpoint: Setting default tool to motion');
    server.setTool('checkpoint', 'kineticAR', 'motion', __dirname);
    server.removeAllNodes('checkpoint', 'kineticAR');

    server.addNode("checkpoint", "kineticAR", "kineticNode1", "storeData");     // Node for checkpoint stop feedback
    server.addNode("checkpoint", "kineticAR", "kineticNode2", "storeData");     // Node for the data path. Follow Checkpoints
    server.addNode("checkpoint", "kineticAR", "kineticNode4", "storeData");     // Node for cleaning the path

    server.addPublicDataListener("checkpoint", "kineticAR", "kineticNode4","ClearPath",function (data) {

        console.log("checkpoint:    -   -   -   Frame has requested to clear path: ", data);

        pathData.forEach(path => {
            path.checkpoints.forEach(checkpoint => {
                server.removeNode("checkpoint", "kineticAR", checkpoint.name);
                api.deleteCheckpoints(function(data){
                    console.log(data);
                });
            });
            path.checkpoints = [];
        });
        pathData = [];

        server.pushUpdatesToDevices("checkpoint");

        inMotion = false;
        activeCheckpointName = null;

    });

    server.addPublicDataListener("checkpoint", "kineticAR", "kineticNode2","pathData",function (data){
        data.forEach(framePath => {             // We go through array of paths

            let pathExists = false;

            pathData.forEach(serverPath => {

                if (serverPath.index === framePath.index){   // If this path exists on the server, proceed to update checkpoints
                    pathExists = true;
                    
                    framePath.checkpoints.forEach(frameCheckpoint => {              // Foreach checkpoint received from the frame

                        let exists = false;
                        
                        serverPath.checkpoints.forEach(serverCheckpoint => {        // Check against each checkpoint stored on the server

                            if (serverCheckpoint.name === frameCheckpoint.name){    // Same checkpoint. Check if position has changed and update
                                
                                exists = true;

                                if (serverCheckpoint.posX !== frameCheckpoint.posX) serverCheckpoint.posX = frameCheckpoint.posX;
                                if (serverCheckpoint.posY !== frameCheckpoint.posY) serverCheckpoint.posY = frameCheckpoint.posY;
                                if (serverCheckpoint.posZ !== frameCheckpoint.posZ) serverCheckpoint.posZ = frameCheckpoint.posZ;
                                if (serverCheckpoint.posXUR !== frameCheckpoint.posXUR) serverCheckpoint.posXUR = frameCheckpoint.posXUR;
                                if (serverCheckpoint.posYUR !== frameCheckpoint.posYUR) serverCheckpoint.posYUR = frameCheckpoint.posYUR;
                                if (serverCheckpoint.posZUR !== frameCheckpoint.posZUR) serverCheckpoint.posZUR = frameCheckpoint.posZUR;
                                if (serverCheckpoint.orientation !== frameCheckpoint.orientation) serverCheckpoint.orientation = frameCheckpoint.orientation;

                                // <node>, <frame>, <Node>, x, y, scale, matrix
                                server.moveNode("checkpoint", "kineticAR", frameCheckpoint.name, frameCheckpoint.posX, frameCheckpoint.posZ, 0.3,[
                                    1, 0, 0, 0,
                                    0, 1, 0, 0,
                                    0, 0, 1, 0,
                                    0, 0, frameCheckpoint.posY * 3, 1
                                ], true);
                                server.pushUpdatesToDevices("checkpoint");

                                onshapeX = onshapeOffsetX + frameCheckpoint.posXUR/1000;
                                onshapeY = onshapeOffsetY - frameCheckpoint.posYUR/1000;
                                onshapeZ = onshapeOffsetZ + frameCheckpoint.posZUR/1000;

                                console.log("checkpoint num: " + serverCheckpoint.name.substring(13,14));
                                checkNum = serverCheckpoint.name.substring(13,14);

                                api.updateCheckpoint(checkNum, [onshapeX, onshapeY, onshapeZ], function(data){
                                    console.log(data);
                                });
                            }
                        });

                        // If the checkpoint is not in the server, add it and add the node listener.
                        if (!exists){
                            serverPath.checkpoints.push(frameCheckpoint);

                            server.addNode("checkpoint", "kineticAR", frameCheckpoint.name, "node");

                            console.log('checkpoint: NEW ' + frameCheckpoint.name + ' | position: ', frameCheckpoint.posX, frameCheckpoint.posY, frameCheckpoint.posZ);

                            // <node>, <frame>, <Node>, x, y, scale, matrix
                            server.moveNode("checkpoint", "kineticAR", frameCheckpoint.name, frameCheckpoint.posX, frameCheckpoint.posZ, 0.3,[
                                1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, frameCheckpoint.posY * 3, 1
                            ], true);

                            server.pushUpdatesToDevices("checkpoint");

                            console.log('checkpoint: ************** Add read listener to ', frameCheckpoint.name);

                            // Add listener to node
                            server.addReadListener("checkpoint", "kineticAR", frameCheckpoint.name, function(data){

                                let indexValues = frameCheckpoint.name.split("_")[1];
                                let pathIdx = parseInt(indexValues.split(":")[0]);
                                let checkpointIdx = parseInt(indexValues.split(":")[1]);
                                nodeReadCallback(data, checkpointIdx, pathIdx);

                            });

                            onshapeX = onshapeOffsetX + frameCheckpoint.posXUR/1000;
                            onshapeY = onshapeOffsetY - frameCheckpoint.posYUR/1000;
                            onshapeZ = onshapeOffsetZ + frameCheckpoint.posZUR/1000;

                            api.makeCheckpoint([onshapeX, onshapeY, onshapeZ], function(data){
                                console.log(data);
                            });
                        }
                    });
                }
            });

            if (!pathExists){   // If the path doesn't exist on the server, add it to the server path data

                pathData.push(framePath);

            }
        });

        console.log("checkpoint: Current PATH DATA in SERVER: ", JSON.stringify(pathData));

    });
}

function nodeReadCallback(data, checkpointIdx, pathIdx){

    // if the value of the checkpoint node changed to 1, we need to send the robot to that checkpoint
    // if the value of the checkpoint node changed to 0, the robot just reached the checkpoint and we can trigger other stuff

    console.log('NODE ', checkpointIdx, ' path: ', pathIdx, ' received ', data);

    let checkpointTriggered = pathData[pathIdx].checkpoints[checkpointIdx];

    if (data.value === 1){

        if (!checkpointTriggered.active){

            console.log('Checkpoint has changed from not active to active: ', checkpointTriggered.name);

            // Checkpoint has changed from not active to active. We have to send robot here
            activeCheckpointName = checkpointTriggered.name;
            checkpointTriggered.active = 1; // This checkpoint gets activated

            inMotion = false
            server.write("checkpoint", "kineticAR", activeCheckpointName, 0)
            
            server.writePublicData("checkpoint", "kineticAR", "kineticNode1", "CheckpointTriggered", checkpointIdx);          // Alert frame of new checkpoint goal

        } else {
            console.log('checkpoint: WARNING - This checkpoint was already active!');
        }

    } else if (data.value === 0){   // If node receives a 0

        if (checkpointTriggered.active){

            console.log('Checkpoint has changed from active to not active: ', checkpointTriggered.name);

            if (inMotion){

                // The node has been deactivated in the middle of the move mission!
                // We need to delete the mission from the mission queue

                console.log('MISSION INTERRUPTED');

                // TODO: STOP UR

                ur_mission_interrupted = true;

            } else {    // Checkpoint has changed from active to not active, robot just got here. We have to trigger next checkpoint
                
                console.log('Checkpoint reached: ', checkpointTriggered.name);
                checkpointTriggered.active = 0; // This checkpoint gets deactivated

                server.writePublicData("checkpoint", "kineticAR", "kineticNode1", "CheckpointStopped", checkpointIdx);

                let nextCheckpointToTrigger = null;

                if (checkpointIdx + 1 < pathData[pathIdx].checkpoints.length){                      // Next checkpoint in same path
                    nextCheckpointToTrigger = pathData[pathIdx].checkpoints[checkpointIdx + 1];

                    console.log('Next checkpoint triggered: ', nextCheckpointToTrigger.name);
                    server.write("checkpoint", "kineticAR", nextCheckpointToTrigger.name, 1);

                } else {                                                                            // We reached end of path

                    activeCheckpointName = null;

                }
            }
        }
    }
}

server.addEventListener("reset", function () {

});

// Wait for the connection to be established with the Spike Prime before starting up
server.addEventListener("initialize", function () {
    if (exports.enabled) startHardwareInterface()
});

// Stop motors on server shutdown
server.addEventListener("shutdown", function () {

});