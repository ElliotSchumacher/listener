/**
 */
"use strict";

const express = require("express"); 
// const ws = require("ws");
const app = express();
var expressWs = require('express-ws')(app); // npm install --save express-ws

app.ws('/echo', function(ws, req) {
    ws.on('message', function(msg) {
        console.log("msg: " + msg);
        ws.send(msg);
    });
    ws.on('/');
});

app.get("/", function(req, res) {
    res.send("Successful");
});

app.use(express.static("public"));

const PORT = process.env.PORT || 5001;
app.listen(PORT);
