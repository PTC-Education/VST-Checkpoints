var feature = require('./lib/feature.js')

let points = [0, 0, 1, 0, 1, 1, 2, 1];
let name = 'Test';
var did = 'ee61e6f250d2c324d8ef264b';
var wid = '3105b4bf84e8ea3fdd5074a1';
var eid = 'f06c4bc382926e56e6534f92';

feature.makeSpline(did, wid, eid, name, points, deletePrevious = true);