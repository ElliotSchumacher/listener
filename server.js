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
const fs = require("fs").promises;
const axios = require('axios');
const { json } = require("express");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(multer().none());

const TEMP_SENSOR_MESSAGE = "There has been no request made from the temperature sensor"; 
const CLIENT_ERROR = 400;
const CLIENT_ERROR_JSON = {"error": "You have made an invalid request"};
const SERVER_ERROR = 500;
const SERVER_ERROR_JSON = {"error": "There has been an error on the server"};
const CONNECTED_MSG = "Arduino device connected";
const IFTTT_URL = "http://maker.ifttt.com/trigger/";
const IFTTT_KEY = "/with/key/jtVyseeuuPpAePoO0VdfHahhA6xwZHvaeNGDzfsUsmt";
const TEMP_NOTIFICATION_INTERVAL = 60000; // 1800000 30 mins
const TEMP_LOG_INTERVAL = 30000;
const ARDUINO_TIMEOUT = 50000;
const SETTINGS_FILE = "settings.json";

let lastTemperature = {
    "time": Date.now(),
    "warmTemp": 0,
    "coolTemp": 0
};

let arduinoConstants;
let bounds;
let timeoutTimer;
let previousValidate = Date.now();
let previousLog = Date.now();

initialize();

/**
 * Reads in the settings data previously set by the user.
 */
async function initialize() {
    console.log("initializing");
    try {
        let settings = await fs.readFile(SETTINGS_FILE, "utf8");
        settings = JSON.parse(settings);
        arduinoConstants = settings.arduinoConstants;
        bounds = settings.bounds;
        console.log(arduinoConstants);
        console.log(bounds);
    } catch (error) {
        console.error(error);
    }
}

/**
 * Sends a notification to IFTTT notifying the user that a temperature sensor
 * has connected to the server. Also restarts the arduino timeout.
 * Type: Get
 * Response type: JSON
 */
app.get("/connect", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("---CONNECT---");
    callIFTTT("notify", CONNECTED_MSG);
    console.log("---END_CONNECT---\n");
    res.send(arduinoConstants);
});

/*
 * Sends a notification to IFTTT notifying the user that an error has
 * occured and what the error was. Also restarts the arduino timeout.
 * Type: Post
 * Body: errorType
 * Response type: JSON
 */
app.post("/error", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("---ERROR---");
    let errorType = req.body.errorType;
    if (!errorType) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        callIFTTT("notify", "A " + errorType + " error has occured");
        res.send(arduinoConstants);
    }
});

/*
 * Updates the saved temperatures with the temperatures sent by the temperature sensor.
 * Also restarts the arduino timeout.
 * Type: Post
 * Body: warmTemp, coolTemp
 * Response type: JSON
 */
app.post("/temperature", function(req, res) {
    res.type("json");
    resetTimeout();
    console.log("---TEMPERATURE---");
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
        console.log("---END_TEMPERATURE---\n");
        res.send(arduinoConstants);
    }
});

/**
 * Sends the client the settings and temperature bounds.
 * Type: Get
 * Response type: JSON
 */
app.get("/get_bounds_and_settings", function(req, res) {
    res.type("json");
    console.log("---GET_BOUNDS_AND_SETTINGS---");
    let data = Object.assign({}, bounds);
    data.errorInterval = arduinoConstants.errorInterval / 1000;
    data.tempCheckInterval = arduinoConstants.tempCheckInterval / 1000;
    res.send(data);
});

/**
 * Sends the client the latest temperature data.
 * Type: Get
 * Response Type: JSON
 */
app.get("/get_temperatures", function(req, res) {
    res.type("json");
    console.log("---GET_TEMPERATURES---");
    res.send(lastTemperature);
});

/**
 * Saves the newly specified settings so that the settings remain across server restarts.
 * Type: POST
 * Body: tempCheckInterval, errorInterval
 * Response Type: JSON
 */
app.post("/save_settings", async function(req, res) {
    res.type("json");
    console.log("---SAVE_SETTINGS---");
    let tempCheckInterval = req.body.tempCheckInterval;
    let errorInterval = req.body.errorInterval;
    if (!tempCheckInterval || !errorInterval) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        arduinoConstants.errorInterval = errorInterval;
        arduinoConstants.tempCheckInterval = tempCheckInterval;
        try {
            await saveSettingsToFile();
        } catch (error) {
            console.log(error);
            res.type(SERVER_ERROR).send(SERVER_ERROR_JSON);
        }
        res.send({"status": "Success"});
    }
});

/**
 * Saves the newly specified temperature boundries so that they aren't returned
 * to the server defaults upon server restart.
 * Type: POST
 * Body: warmUpper, warmLower, coolUpper, coolLower
 * Response Type: JSON
 */
app.post("/save_bounds", async function(req, res) {
    res.type("json");
    console.log("---SAVE_BOUNDS---");
    console.log(req.body);
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
        try {
            await saveSettingsToFile();
        } catch (error) {
            console.log(error);
            res.status(SERVER_ERROR).send(SERVER_ERROR_JSON);
        }
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
        // console.log(response);
        // console.log("<-----STATUS-----> " + response.status);
    })
    .catch(function (error) {
        console.log(error);
    });
}

/**
 * Accepts the current temperatures as parameters and then decideds if a message
 * should be sent or not and returns the message.
 * @param {double} warmTemp - The temperature on the warm side.
 * @param {double} coolTemp - The temperature on the cool side.
 * @return {String} - The message telling the user if a temperature is outside of
 *                    its set boundry. If no temperature is outside of its boundry,
 *                    an empty string is returned.
 */
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

/**
 * Constructs and returns a message that tells the user which temperature sensor is
 * reporting temperatures outside its bounds and whether the temperature is too
 * high or too low.
 * @param {int} temp - The temperature to write the message about.
 * @param {String} position - The name of temperature sensor that the temperature is from.
 * @return {String} - A message that says which sensor is outside its bounds and the 
 *                    direction in which it is outside the boundry.
 */
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
    // console.log(message);
    return message;
}

/**
 * Saves the settings for the arduino and the temperature bounds to a file.
 */
async function saveSettingsToFile() {
    let settings = {};
    settings.arduinoConstants = arduinoConstants;
    settings.bounds = bounds;
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings), "utf8");
}

/**
 * Restarts the timeout that pings IFTTT with the no response alert.
 */
function resetTimeout() {
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
    }
    timeoutTimer = setTimeout(() => {
        callIFTTT("notify", TEMP_SENSOR_MESSAGE);
    }, ARDUINO_TIMEOUT);
}

/**
 * Creates a new object containing the contents of both obj1 and obj2 and returns it.
 * @param {object} obj1 - The first object to be combined.
 * @param {object} obj2 - The second object to be combined
 * @return {object} A new object that is a combination of obj1 and obj2.
 */
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
