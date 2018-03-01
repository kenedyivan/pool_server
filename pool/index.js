// Setup basic express server
var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('../')(server);
var port = process.env.PORT || 3000;
var mysql = require('mysql');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

var numUsers = 0;
var OwnerSocketObjects = {};
var GuardSocketObjects = {};
var activeGuardsArray = [];
var inActiveGuardsArray = [];

// Routing
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'vecurity_db'
});

connection.connect();

/*connection.query('SELECT * from vecurityapiapp_carowner', function (err, rows, fields) {
    if (err) throw err;

    for (var i = 0; i < rows.length; i++) {
        console.log('User: ', rows[i].first_name);
    }

});*/

//connection.end();

/**
 * Routes
 * */

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/request_guard.html');
});

app.get('/find-guard', function (req, res) {
    findOnlineGuard(res);
});

app.get('/active-guards', function (req, res) { //Route for logging active guards
    listGuards(res);
});

app.post('/finish-guard', function (req, res) { //Route for logging active guards
    finishGuardProcess(req, res);
});

/**
 * End of Routes
 * */

Object.size = function (obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function listGuards(res) { //Lists active guards
    console.log("Active guards");

    if (Object.size(GuardSocketObjects) > 0) {
        for (var i = 0; i < Object.size(GuardSocketObjects); i++) {
            connection.query('SELECT * FROM vecurityapiapp_guard WHERE id=' + Object.keys(GuardSocketObjects)[i],
                function (err, rows, fields) {
                    if (err) throw err;

                    for (var i = 0; i < rows.length; i++) {
                        console.log('User: ', rows[i].first_name);
                    }

                });
        }
    } else {
        console.log("No active guards");
    }

    res.send("See console logs");
}

function findOnlineGuard(res) {///todo Add a single guard selection criteria to this method
    var guard = null;
    var found = false;
    if (Object.size(GuardSocketObjects) > 0) {
        for (var i = 0; i < Object.size(GuardSocketObjects); i++) {
            var gId = Object.keys(GuardSocketObjects)[i];
            console.log("GID: ", gId);
            if (GuardSocketObjects[gId].status === 'active') {
                continue;
            }
            found = true;
            console.log('Status: ', GuardSocketObjects[gId].status);
            connection.query('SELECT * FROM vecurityapiapp_guard WHERE id=' + gId,
                function (err, rows, fields) {
                    if (err) throw err;

                    for (var i = 0; i < rows.length; i++) {
                        data = rows[i];
                        guard = {
                            id: data.id,
                            first_name: data.first_name,
                            last_name: data.last_name,
                            email: data.email,
                            phone: data.phone,
                            gender: data.gender,
                            success: 1,
                            msg: "found guard"
                        }
                    }

                    res.send(guard);

                });

        }

        if (!found) {
            guard = {
                success: 0,
                msg: "All guards active"
            };
            res.send(guard);
        }

    } else {
        guard = {
            success: 0,
            msg: "No guards found"
        };

        res.send(guard);
    }
}

function finishGuardProcess(req, res) {
    var ownerId = req.body.ownerId;
    var guardId = req.body.guardId;

    if (GuardSocketObjects[guardId].status === 'active') {
        GuardSocketObjects[guardId].status = 'inactive';
        OwnerSocketObjects[ownerId].emit('new message', {
            msg: 'Guarding ended, time to pay up',
            success: 1
        });
        res.send({success: 1, msg: 'guarding completed'});
    } else {
        res.send({success: 0, msg: 'process failed'});
    }


}

/**
 * Sockets pool
 * */
// Pool
io.on('connection', function (socket) {
    console.log('a user connected');


    socket.on('add owner', function (ownerId) { ///todo Implement the new owner object
        console.log('OwnerID: ' + ownerId);
        if (OwnerSocketObjects[ownerId] === undefined) {
            delete OwnerSocketObjects[ownerId];
            OwnerSocketObjects[ownerId] = socket;
        }

    });

    socket.on('add guard', function (guardId) { ///todo Implement the new guard object
        console.log('GuardID: ' + guardId);
        delete GuardSocketObjects[guardId];
        GuardSocketObjects[guardId] = {id: guardId, socket: socket, status: "inactive"};
        console.log("Guards: ", GuardSocketObjects);

    });

    //var addedUser = false;

    // when the client emits 'new message', this listens and executes
    socket.on('new request', function (data) {
        value = data;
        var carOwnerId = value.carOwnerId;
        var carOwnerName = value.carOwnerName;
        var licenseNumber = value.licenseNumber;
        var vehicleType = value.vehicleType;
        var duration = value.duration;
        var guard = value.guard;

        console.log('Payload: ', data);

        //console.log('Guards: ', GuardSocketObjects);

        GuardSocketObjects[guard].socket.emit('send request', {
            carOwnerId: carOwnerId,
            carOwnerName: carOwnerName,
            licenseNumber: licenseNumber,
            vehicleType: vehicleType,
            duration: duration
        });
    });

    socket.on('accept', function (data) {

        var gId;
        if (OwnerSocketObjects[data.ownerId]) {
            gId = data.guardId;
            OwnerSocketObjects[data.ownerId].emit('new message', {
                guardId: data.guardId,
                status: data.status
            });

            if (GuardSocketObjects[gId].status === 'inactive') {
                GuardSocketObjects[gId].status = 'active';
            }
        }
    });

    socket.on('decline', function (data) {

        if (OwnerSocketObjects[data.ownerId]) {
            OwnerSocketObjects[data.ownerId].emit('new message', {
                guardId: data.guardId,
                status: data.status
            });
        }
    });

    socket.on('no response', function (data) {

        if (OwnerSocketObjects[data.ownerId]) {
            OwnerSocketObjects[data.ownerId].emit('new message', {
                guardId: data.guardId,
                status: 'no_response'
            });
        }
    });

    //when the user disconnects.. perform this
    /* socket.on('disconnect', function () {
         console.log("Deleted object");
         /!*console.log("Sockets: ", socketObjects);
         delete socketObjects[data];*!/
     });*/

    socket.on('disconn owner', function (data) {

        if (OwnerSocketObjects[data]) {
            console.log("Deleted owner object");
            delete OwnerSocketObjects[data];
        }
        /*console.log("Sockets: ", socketObjects);
         delete socketObjects[data];*/
    });

    socket.on('disconn guard', function (data) {

        if (GuardSocketObjects[data]) {
            console.log("Deleted guard object");
            delete GuardSocketObjects[data];
        }
        /*console.log("Sockets: ", socketObjects);
         delete socketObjects[data];*/
    });
});

/**
 * End of sockets pool
 * */