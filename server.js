/**
 * Author: Elliot Schumacher
 * This server acts as a back-up for the temperature sensor arduino gadget.
 * If no communication between the arduino gadget and the server is made for a 
 * specified amount of time, the server will notify the client through the
 * notifier applet on IFTTT.
 * 
 * Endpoints:
 * 1) The /temp_sensors POST endpoint requires a key post parameter and
 * resets the temperature sensor timeout timer.
 * ERRORS: All errors are returned in JSON format. Failure to provide a key
 * returns a 400 error. An invalid key returns a 401 error.
 */
"use strict";

const express = require("express"); 
const multer = require("multer");
const axios = require('axios');
const { json } = require("express");

const app = express();
// app.use(express.urlencoded({ extended: true }));
app.use(multer().none());

const TEMP_SENSOR_MESSAGE = "There has been no request made from the temperature sensor"; 
const CLIENT_ERROR = 400;
const CLIENT_ERROR_JSON = {"error": "You have made an invalid request"};
const CONNECTED_MSG = "Arduino device connected";
const IFTTT_URL = "http://maker.ifttt.com/trigger/";
const IFTTT_KEY = "/with/key/jtVyseeuuPpAePoO0VdfHahhA6xwZHvaeNGDzfsUsmt";
const TEMP_NOTIFICATION_INTERVAL = 60000; // 1800000 30 mins
const TEMP_LOG_INTERVAL = 30000;
const ARDUINO_TIMEOUT = 50000;

let arduinoConstants = {
    "errorInterval": 45000,
    "tempCheckInterval": 30000
};
let bounds = {
    "warmUpper": 0,
    "warmLower": 0,
    "coolUpper": 0,
    "coolLower": 0
};
let lastTemperature = {
    "time": Date.now(),
    "warmTemp": 0,
    "coolTemp": 0
};

let timeoutTimer;
let previousValidate = Date.now();
let previousLog = Date.now();

app.get("/connect", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("CONNECT");
    callIFTTT("notify", CONNECTED_MSG);
    res.send(arduinoConstants);
});

app.post("/error", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("ERROR");
    let errorType = req.body.errorType;
    if (!errorType) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        callIFTTT("notify", "A " + errorType + " error has occured");
        res.send(arduinoConstants);
    }
});

app.post("/temperature", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("TEMPERATURE");
    let warmTemp = parseInt(req.body.warmTemp);
    let coolTemp = parseInt(req.body.coolTemp);
    console.log("WARM:  " + warmTemp + " COOL: " + coolTemp);
    if (!warmTemp || !coolTemp) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        let now = Date.now();
        lastTemperature.warmTemp = warmTemp;
        lastTemperature.coolTemp = coolTemp;
        let message = "";
        if ((now - previousValidate) >= TEMP_NOTIFICATION_INTERVAL) {
            message = processTemperature(warmTemp, coolTemp);
            if (message !== "") {
                callIFTTT("notify", message);
                previousValidate = Date.now();
            }
        }
        console.log("now: " + now);
        console.log("previousLog:" + previousLog);
        console.log("difference: " + (now - previousLog));
        if (((now - previousLog) >= TEMP_LOG_INTERVAL) || message !== "") {
            console.log("LOGGING");
            callIFTTT("temp_log", warmTemp, coolTemp);
            previousLog = Date.now();
        }
        res.send(arduinoConstants);
    }
});

app.get("/get_bounds_and_settings", function(req, res) {
    res.type("json");
    let data = bounds;
    data.errorInterval = arduinoConstants.errorInterval / 1000;
    data.tempCheckInterval = arduinoConstants.tempCheckInterval / 1000;
    res.send(data);
});

app.get("/get_temperatures", function(req, res) {
    res.type("json");
    res.send(lastTemperature);
});

app.post("/save_settings", function(req, res) {
    res.type("json");
    let tempCheckInterval = req.body.tempCheckInterval;
    let errorInterval = req.body.errorInterval;
    if (!tempCheckInterval || !errorInterval) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        console.log("errorInterval-OLD: " + arduinoConstants.errorInterval);
        console.log("tempCheckInterval-OLD " + arduinoConstants.tempCheckInterval);
        arduinoConstants.errorInterval = errorInterval;
        arduinoConstants.tempCheckInterval = tempCheckInterval;
        console.log("errorInterval-NEW: " + arduinoConstants.errorInterval);
        console.log("tempCheckInterval-NEW " + arduinoConstants.tempCheckInterval);
        res.send({"status": "Success"});
    }
});

app.post("/save_bounds", function(req, res) {
    res.type("json");
    let warmUpper = req.body.warmUpper;
    let warmLower = req.body.warmLower;
    let coolUpper = req.body.coolUpper;
    let coolLower = req.body.coolLower;
    if(!warmUpper || !warmLower || !coolUpper || !coolLower) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        bounds.warmUpper = warmUpper;
        bounds.warmLower = warmLower;
        bounds.coolUpper = coolUpper;
        bounds.coolLower = coolLower;
        console.log("warmUpper: " + bounds.warmUpper);
        console.log("warmLower: " + bounds.warmLower);
        console.log("coolUpper: " + bounds.coolUpper);
        console.log("coolLower: " + bounds.coolLower);
        res.send({"status": "Success"});
    }
})

/**
 * This is just a test endpoint for heroku. It just responds with a success message
 * in plain text format when triggered.
 */
app.get("/test", function(req, res) {res.type("text").send("success")});

/**
 * Sends a web request to the IFTTT notify applet with a message informing the
 * applet subscribers that the temperature sensor has not communicated with this server
 * in a specified amount of time.
 */
function callIFTTT(applet, value1, value2) {
    let url = IFTTT_URL + applet + IFTTT_KEY;
    let body = {value1: value1};
    if (value2) {
        body.value2 = value2;
    }
    axios({
        method: 'post',
        url: url,
        data: body
    })
    .then(function (response) {
        console.log(response);
        console.log("<-----STATUS-----> " + response.status);
    })
    .catch(function (error) {
        console.log(error);
    });
}

function processTemperature(warmTemp, coolTemp) {
    let message = "";
    if ((warmTemp < bounds.warmLower) || (bounds.warmUpper < warmTemp)) {
        message += tempMessage(warmTemp, "warm");
    }
    if ((coolTemp < bounds.coolLower) || (bounds.coolUpper < coolTemp)) {
        if (message !== "") {
            message += ". ";
        }
        message += tempMessage(coolTemp, "cool");
    }
    return message;
}

function tempMessage(temp, position) {
    // "The temperature on the WARM side is too HOT (72.3 F)"
    let adjective;
    let upperBound;
    let lowerBound;
    if (position === "warm") {
        upperBound = bounds.warmUpper;
        lowerBound = bounds.warmLower;
    } else if(position === "cool") {
        upperBound = bounds.coolUpper;
        lowerBound = bounds.coolLower;
    }
    if (temp < lowerBound) {
        adjective = "cold";
    } else if (upperBound < temp) {
        adjective = "hot";
    }
    let message = "The temperature on the " + position + " side is too " + 
        adjective + "(" + temp + ")";
    console.log(message);
    return message;
}

function resetTimeout() {
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
    }
    timeoutTimer = setTimeout(() => {
        callIFTTT("notify", TEMP_SENSOR_MESSAGE);
    }, ARDUINO_TIMEOUT);
}

function combineJson(obj1, obj2) {
    const result = {};
    let key;
    for (key in obj1) {
        if(obj1.hasOwnProperty(key)){
            result[key] = obj1[key];
        }
    }
    for (key in obj2) {
        if(obj2.hasOwnProperty(key)){
            result[key] = obj2[key];
        }
    }
    return result;
}

app.use(express.static("public"));

const PORT = process.env.PORT || 5000;
app.listen(PORT);
