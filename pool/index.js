// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('../')(server);
var port = process.env.PORT || 3000;
var mysql = require('mysql');

var numUsers = 0;
var OwnerSocketObjects = {};
var GuardSocketObjects = {};

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

connection.query('SELECT * from vecurityapiapp_carowner', function (err, rows, fields) {
    if (err) throw err;

    for (var i = 0; i < rows.length; i++) {
        console.log('User: ', rows[i].first_name);
    }

});

//connection.end();

/**
 * Routes
 * */

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/request_guard.html');
});

app.get('/find-guard', function (req, res) {
    findActiveGuard(res);
});

app.get('/active-guards', function (req, res) { //Route for logging active guards
    listGuards(res);
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

function findActiveGuard(res) {///todo Add a single guard selection criteria to this method
    var guard = null;
    if (Object.size(GuardSocketObjects) > 0) {
        for (var i = 0; i < Object.size(GuardSocketObjects); i++) {
            connection.query('SELECT * FROM vecurityapiapp_guard WHERE id=' + Object.keys(GuardSocketObjects)[i],
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
                            msg:"found guard"
                        }
                    }

                    res.send(guard);

                });
        }
    } else {
        guard = {
            success: 0,
            msg: "No active guard found"
        };

        res.send(guard);
    }
}

/**
 * Sockets pool
 * */
// Pool
io.on('connection', function (socket) {
    console.log('a user connected');


    socket.on('add owner', function (ownerId) {
        console.log('OwnerID: ' + ownerId);
        delete OwnerSocketObjects[ownerId];
        OwnerSocketObjects[ownerId] = socket;
    });

    socket.on('add guard', function (guardId) {
        console.log('GuardID: ' + guardId);
        delete GuardSocketObjects[guardId];
        GuardSocketObjects[guardId] = socket;
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

        GuardSocketObjects[guard].emit('send request', {
            carOwnerId: carOwnerId,
            carOwnerName: carOwnerName,
            licenseNumber: licenseNumber,
            vehicleType: vehicleType,
            duration: duration
        });
    });

    socket.on('accept', function (data) {

        if (OwnerSocketObjects[data.ownerId]) {
            OwnerSocketObjects[data.ownerId].emit('new message', {
                guardId: data.guardId,
                status: data.status
            });
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
                status: data.status
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