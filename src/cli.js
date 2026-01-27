const {
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
} = require("./tempstickClient");

function parseValue(raw) {
  if (raw === "true") return 1;
  if (raw === "false") return 0;
  if (raw === "") return "";
  if (!Number.isNaN(Number(raw)) && raw.trim() !== "") {
    return Number(raw);
  }
  return raw;
}

function parseKeyValueArgs(args) {
  const result = {};
  for (const arg of args) {
    const [key, ...rest] = arg.split("=");
    if (!key || rest.length === 0) {
      continue;
    }
    const rawValue = rest.join("=");
    result[key] = parseValue(rawValue);
  }
  return result;
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printUsage() {
  console.log("TempStick CLI");
  console.log("");
  console.log("Commands:");
  console.log("  sensors");
  console.log("  sensor <sensorId>");
  console.log("  readings <sensorId> [key=value ...]");
  console.log("  alerts");
  console.log("  alert <alertId>");
  console.log("  sensor-notifications <sensorId> [key=value ...]");
  console.log("  user-notifications [key=value ...]");
  console.log("  user");
  console.log("  email-reports");
  console.log("  timezones");
  console.log("  update-sensor <sensorId> key=value [key=value ...]");
  console.log("  update-display key=value [key=value ...]");
  console.log("  apply-thresholds [--apply]");
  console.log("");
  console.log("Examples:");
  console.log("  node src/cli.js sensors");
  console.log("  node src/cli.js readings SENSOR_ID setting=24_hours offset=-18000");
  console.log(
    "  node src/cli.js update-sensor SENSOR_ID alert_temp_above=8 alert_temp_below=2 use_alert_interval=1 alert_interval=1800"
  );
  console.log("  node src/cli.js apply-thresholds --apply");
}

async function run() {
  const [, , command, ...rest] = process.argv;

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    switch (command) {
      case "sensors": {
        const data = await getSensors();
        printJson(data);
        return;
      }
      case "sensor": {
        const [sensorId] = rest;
        if (!sensorId) {
          throw new Error("sensor command requires <sensorId>");
        }
        const data = await getSensor(sensorId);
        printJson(data);
        return;
      }
      case "readings": {
        const [sensorId, ...queryArgs] = rest;
        if (!sensorId) {
          throw new Error("readings command requires <sensorId>");
        }
        const query = parseKeyValueArgs(queryArgs);
        const data = await getSensorReadings(sensorId, query);

        if (data?.type === "success" && Array.isArray(data?.data?.readings)) {
          const withFahrenheit = data.data.readings.map((reading) => {
            if (typeof reading.temperature !== "number") {
              return reading;
            }
            return {
              ...reading,
              temperature_f: celsiusToFahrenheit(reading.temperature, 1),
            };
          });
          printJson({ ...data, data: { ...data.data, readings: withFahrenheit } });
          return;
        }

        printJson(data);
        return;
      }
      case "alerts": {
        const data = await getAlerts();
        printJson(data);
        return;
      }
      case "alert": {
        const [alertId] = rest;
        if (!alertId) {
          throw new Error("alert command requires <alertId>");
        }
        const data = await getAlert(alertId);
        printJson(data);
        return;
      }
      case "sensor-notifications": {
        const [sensorId, ...queryArgs] = rest;
        if (!sensorId) {
          throw new Error("sensor-notifications command requires <sensorId>");
        }
        const query = parseKeyValueArgs(queryArgs);
        const data = await getSensorNotifications(sensorId, query);
        printJson(data);
        return;
      }
      case "user-notifications": {
        const query = parseKeyValueArgs(rest);
        const data = await getUserNotifications(query);
        printJson(data);
        return;
      }
      case "user": {
        const data = await getCurrentUser();
        printJson(data);
        return;
      }
      case "email-reports": {
        const data = await getEmailReports();
        printJson(data);
        return;
      }
      case "timezones": {
        const data = await getAllowedTimezones();
        printJson(data);
        return;
      }
      case "update-sensor": {
        const [sensorId, ...settingsArgs] = rest;
        if (!sensorId) {
          throw new Error("update-sensor command requires <sensorId>");
        }
        if (settingsArgs.length === 0) {
          throw new Error(
            "update-sensor requires settings as key=value pairs (for example alert_temp_above=8)"
          );
        }
        const settings = parseKeyValueArgs(settingsArgs);
        const data = await updateSensorSettings(sensorId, settings);
        printJson(data);
        return;
      }
      case "update-display": {
        if (rest.length === 0) {
          throw new Error(
            "update-display requires settings as key=value pairs (for example timezone=America/New_York temp_pref=F)"
          );
        }
        const preferences = parseKeyValueArgs(rest);
        const data = await updateDisplayPreferences(preferences);
        printJson(data);
        return;
      }
      case "apply-thresholds": {
        const apply = rest.includes("--apply");

        const ambientMinC = fahrenheitToCelsius(34, 2);
        const ambientMaxC = fahrenheitToCelsius(90, 2);
        const probeMinC = fahrenheitToCelsius(34, 2);
        const probeMaxC = fahrenheitToCelsius(60, 2);

        const sensorsResponse = await getSensors();
        const sensors = sensorsResponse?.data?.items || [];

        const plannedUpdates = sensors.map((sensor) => {
          const settings = {
            alert_temp_below: ambientMinC,
            alert_temp_above: ambientMaxC,
          };

          if (sensor.type === "EX") {
            settings.minTcTemp = probeMinC;
            settings.maxTcTemp = probeMaxC;
          }

          return {
            sensor_id: sensor.sensor_id,
            sensor_name: sensor.sensor_name,
            type: sensor.type,
            settings,
          };
        });

        if (!apply) {
          console.log(
            "Dry run only. Re-run with --apply to update all sensors:"
          );
          printJson({
            thresholds_fahrenheit: {
              ambient: { min: 34, max: 90 },
              probe: { min: 34, max: 60 },
            },
            thresholds_celsius: {
              ambient: { min: ambientMinC, max: ambientMaxC },
              probe: { min: probeMinC, max: probeMaxC },
            },
            planned_updates: plannedUpdates,
          });
          return;
        }

        const results = [];
        for (const update of plannedUpdates) {
          // Apply the minimal set of fields needed for each sensor type.
          const res = await updateSensorSettings(update.sensor_id, update.settings);
          results.push({
            sensor_id: update.sensor_id,
            sensor_name: update.sensor_name,
            type: update.type,
            result: res?.type || "unknown",
            message: res?.message || "",
          });
        }

        printJson({
          applied: true,
          thresholds_fahrenheit: {
            ambient: { min: 34, max: 90 },
            probe: { min: 34, max: 60 },
          },
          thresholds_celsius: {
            ambient: { min: ambientMinC, max: ambientMaxC },
            probe: { min: probeMinC, max: probeMaxC },
          },
          results,
        });
        return;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error.message);
    if (error.payload) {
      printJson(error.payload);
    }
    process.exitCode = 1;
  }
}

run();
