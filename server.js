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
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(multer().none());

const CLIENT_ERROR = 400;
const CLIENT_ERROR_JSON = {"error": "You have made an invalid request"};
const ACCESS_DENIED_ERROR = 401;
const ACCESS_DENIED_JSON = {"error": "Invalid login credentials"};
const TEMP_SENSOR_KEY = "2ldisDo23nth";
const TEMP_SENSOR_DELAY = 20000;
const TEMP_SENSOR_MESSAGE = "There has been no request made from the temperature sensor";
const IFTTT_URL = "http://maker.ifttt.com/trigger/";
const IFTTT_KEY = "/with/key/jtVyseeuuPpAePoO0VdfHahhA6xwZHvaeNGDzfsUsmt";

var tempSensorTimer;

/**
 * This endpoint requires a key post parameter. The key paramter acts as a password.
 * All responses are in JSON format. When this endpoint is called and the key is valid,
 * it resets a timeout that when elapses, notifies the user of not hearing from the 
 * temperature sensor gadget. If there is no key, a 400 status response is sent. If the 
 * key parameter is not valid, a 401 status response is sent.
 */
app.post("/temp_sensors", function(req, res) {
    res.type("json");
    let key = req.body.key;
    if (!key) {
        res.status(CLIENT_ERROR).send(CLIENT_ERROR_JSON);
    } else {
        if (TEMP_SENSOR_KEY !== key) {
            res.status(ACCESS_DENIED_ERROR).send(ACCESS_DENIED_JSON);
        } else {
            if (tempSensorTimer) {
                clearTimeout(tempSensorTimer);
            }
            tempSensorTimer = setTimeout(pingIFTTT, TEMP_SENSOR_DELAY);
            res.send({"res": "Recieved"});
        }
    }
});

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
function pingIFTTT() {
    let url = IFTTT_URL + "notify" + IFTTT_KEY;
    axios({
        method: 'post',
        url: url,
        data: {
            value1: TEMP_SENSOR_MESSAGE
        }
    })
    .then(function (response) {
        console.log(response);
        console.log("<-----STATUS-----> " + response.status);
    })
    .catch(function (error) {
        console.log(error);
    });
}

app.use(express.static("public"));

const PORT = process.env.PORT || 5000;
app.listen(PORT);
