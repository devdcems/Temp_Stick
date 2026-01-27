const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const BASE_URL = "https://tempstickapi.com/api/v1";
const API_KEY = process.env.TEMP_STICK_API;

if (!API_KEY) {
  throw new Error(
    "Missing TEMP_STICK_API in environment. Add it to .env before running."
  );
}

function buildUrl(path, query) {
  const url = new URL(`${BASE_URL}${path}`);
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request(path, options = {}) {
  const { method = "GET", query, form } = options;
  const url = buildUrl(path, query);

  const headers = {
    "X-API-KEY": API_KEY,
    "User-Agent": "TempStickClient/1.0",
  };

  const fetchOptions = {
    method,
    headers,
  };

  if (form && typeof form === "object") {
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (value === undefined || value === null) {
        continue;
      }
      formData.append(key, String(value));
    }
    fetchOptions.body = formData;
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    data = { type: "error", message: "Non-JSON response", raw: text };
  }

  if (!response.ok) {
    const message = data?.message || response.statusText;
    const err = new Error(
      `TempStick API error ${response.status}: ${message}`.trim()
    );
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

function celsiusToFahrenheit(celsius, roundTo = 1) {
  const fahrenheit = celsius * 1.8 + 32;
  const factor = 10 ** roundTo;
  return Math.round(fahrenheit * factor) / factor;
}

function fahrenheitToCelsius(fahrenheit, roundTo = 2) {
  const celsius = (fahrenheit - 32) / 1.8;
  const factor = 10 ** roundTo;
  return Math.round(celsius * factor) / factor;
}

function getSensors(query) {
  return request("/sensors/all", { query });
}

function getSensor(sensorId) {
  return request(`/sensor/${sensorId}`);
}

function getSensorReadings(sensorId, query) {
  return request(`/sensor/${sensorId}/readings`, { query });
}

function updateSensorSettings(sensorId, settings) {
  return request(`/sensor/${sensorId}`, {
    method: "POST",
    form: settings,
  });
}

function getAlerts() {
  return request("/alerts/all");
}

function getAlert(alertId) {
  return request(`/alerts/${alertId}`);
}

function getSensorNotifications(sensorId, query) {
  return request(`/sensor/notifications/${sensorId}`, { query });
}

function getUserNotifications(query) {
  return request("/user/notifications", { query });
}

function getCurrentUser() {
  return request("/user");
}

function getEmailReports() {
  return request("/user/email-reports");
}

function getAllowedTimezones() {
  return request("/user/allowed-timezones");
}

function updateDisplayPreferences(preferences) {
  return request("/user/display-preferences", {
    method: "POST",
    form: preferences,
  });
}

module.exports = {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  getAlert,
  getAlerts,
  getAllowedTimezones,
  getCurrentUser,
  getEmailReports,
  getSensor,
  getSensorNotifications,
  getSensorReadings,
  getSensors,
  getUserNotifications,
  updateDisplayPreferences,
  updateSensorSettings,
};
