/**
 */
"use strict";
(function() {

  let tempCheckIntervalTimer;
  let warmUpperBound;
  let warmLowerBound;
  let coolUpperBound;
  let coolLowerBound;
  let tempCheckInterval;
  let errorInterval;

  window.addEventListener("load", init);

  function init() {
    getBoundsAndSettings();
    getTemperatures();
    id("save-btn").addEventListener("click", sendSettings);
    let bounds = qsa(".temperature-panel > input");
    console.log(bounds);
    for (let index = 0; index < bounds.length; index++) {
      bounds[index].addEventListener("blur", sendBounds)
    }
  }

  /**
   * Retrieves the bounds and settings values from the server and updates the
   * inputs with their corresponding values.
   */
  function getBoundsAndSettings() {
    fetch("/get_bounds_and_settings")
      .then(checkStatus)
      .then(response => response.json())
      .then(saveBoundsAndSettings)
      .then(displayBoundsAndSettings)
      .then(startTempCheckInterval)
      .catch(handleError);
  }

  /**
   * Starts the interval that updates the temperature values on the page.
   */
  function startTempCheckInterval() {
    tempCheckIntervalTimer = setInterval(getTemperatures, tempCheckInterval);
  }

  /**
   * Saves the bounds and settings data locally on the web page.
   * @param {Object} data - The values to be assigned to all settings and bounds.
   */
  function saveBoundsAndSettings(data) {
    warmUpperBound = data.warmUpper;
    warmLowerBound = data.warmLower;
    coolUpperBound = data.coolUpper;
    coolLowerBound = data.coolLower;
    tempCheckInterval = data.tempCheckInterval * 1000;
    errorInterval = data.errorInterval * 1000;
  }

  /**
   * Updates the page so that the value of all inputs for settings and bounds
   * match what is saved locally. Also converts the settings values to seconds.
   */
  function displayBoundsAndSettings() {
    id("warm-upper").value = warmUpperBound;
    id("warm-lower").value = warmLowerBound;
    id("cool-upper").value = coolUpperBound;
    id("cool-lower").value = coolLowerBound;
    id("error-interval").value = errorInterval / 1000;
    id("temp-check-interval").value = tempCheckInterval / 1000;
  }

  /**
   * Recieves the temperature values from the server and displays them.
   */
  function getTemperatures() {
    fetch("/get_temperatures")
      .then(checkStatus)
      .then(response => response.json())
      .then(displayTemperatures)
      .catch(handleError);
  }

  /**
   * Updates the page to display the new temperature values.
   * @param {Object} data - The temperature values.
   */
  function displayTemperatures(data) {
    let warmTempText = id("warm-temp");
    let coolTempText = id("cool-temp");
    warmTempText.textContent = data.warmTemp;
    coolTempText.textContent = data.coolTemp;
  }

  /**
   * Checks if any settings have been changed and if so, sends the new settings values
   * to the server and saves them locally.
   */
  function sendSettings() {
    let errorIntervalValueNew = id("error-interval").value * 1000;
    let tempCheckIntervalValueNew = id("temp-check-interval").value * 1000;
    closeSettingsModal();
    if (errorIntervalValueNew !== errorInterval || tempCheckIntervalValueNew !== tempCheckInterval) {
      let params = new FormData();
      params.append("errorInterval", errorIntervalValueNew);
      params.append("tempCheckInterval", tempCheckIntervalValueNew);
      fetch("/save_settings", {method: "POST", body: params})
        .then(checkStatus)
        .then(() => {updateSettings(errorIntervalValueNew, tempCheckIntervalValueNew);})
        .catch(handleError);
    }
  }

  /**
   * Closes the settings modal.
   */
  function closeSettingsModal() {
    let settingsModal = id("staticBackdrop");
    settingsModal = bootstrap.Modal.getInstance(settingsModal);
    settingsModal.toggle();
  }

  /**
   * Updates the local settings values with the values specified by the user
   * and updates the temperature checking interval with the new time.
   * @param {int} errorIntervalValueNew - The new value for the time period between
   *                                      notifying the client of errors.
   * @param {int} tempCheckIntervalValueNew - The new value for the amount of time 
   *                                          between checking the temperatures.
   */
  function updateSettings(errorIntervalValueNew, tempCheckIntervalValueNew) {
    errorInterval = errorIntervalValueNew;
    tempCheckInterval = tempCheckIntervalValueNew;
    clearInterval(tempCheckIntervalTimer);
    startTempCheckInterval();
  }

  /**
   * Checks to see if any of the bounds have been changed by the user. If so,
   * the new bounds values will be saved locally and sent to the server.
   */
  function sendBounds() {
    let warmUpperBoundNew = id("warm-upper").value;
    let warmLowerBoundNew = id("warm-lower").value;
    let coolUpperBoundNew = id("cool-upper").value;
    let coolLowerBoundNew = id("cool-lower").value;
    if (warmUpperBound !== warmUpperBoundNew || warmLowerBound !== warmLowerBoundNew ||
        coolUpperBound !== coolUpperBoundNew || coolLowerBound !== coolLowerBoundNew) {
      let params = new FormData();
      params.append("warmUpper", warmUpperBoundNew);
      params.append("warmLower", warmLowerBoundNew);
      params.append("coolUpper", coolUpperBoundNew);
      params.append("coolLower", coolLowerBoundNew);
      fetch("/save_bounds", {method: "POST", body: params})
        .then(checkStatus)
        .then(() => {
          warmUpperBound = warmUpperBoundNew;
          warmLowerBound = warmLowerBoundNew;
          coolUpperBound = coolUpperBoundNew;
          coolLowerBound = coolLowerBoundNew;
        })
        .catch(handleError);
    }
  }

  /**
   * Explains the error caused by making a web request.
   * @param {object} error - The error thrown while trying to contact the server.
   */
  function handleError(error) {
    console.error("An error has occured: " + error);
  }

  /**
   * Returns the element that has the ID attribute with the specified value.
   * @param {string} name - element ID.
   * @returns {object} - DOM object associated with id.
   */
  function id(name) {
    return document.getElementById(name);
  }

  /**
   * Returns the first element that matches the given CSS selector.
   * @param {string} query - CSS query selector.
   * @returns {object[]} array of DOM objects matching the query.
   */
  function qs(query) {
    return document.querySelector(query);
  }

  /**
   * Returns the array of elements that match the given CSS selector.
   * @param {string} query - CSS query selector
   * @returns {object[]} array of DOM objects matching the query.
   */
  function qsa(query) {
    return document.querySelectorAll(query);
  }

  function gen(tagName) {
    return document.createElement(tagName);
  }

  /**
   * Helper function to return the response's result text if successful, otherwise
   * returns the rejected Promise result with an error status and corresponding text
   * @param {object} response - response to check for success/error
   * @return {object} - valid response if response was successful, otherwise rejected
   *                    Promise result
   */
  function checkStatus(response) {
    if (!response.ok) {
      throw Error("Error in request: " + response.statusText);
    }
    return response; // a Response object
  }
})();
