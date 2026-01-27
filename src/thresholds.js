const { fahrenheitToCelsius, getSensors, updateSensorSettings } = require("./tempstickClient");

const THRESHOLDS_F = {
  ambient: { min: 34, max: 90 },
  probe: { min: 34, max: 60 },
};

function getThresholdsCelsius() {
  return {
    ambient: {
      min: fahrenheitToCelsius(THRESHOLDS_F.ambient.min, 2),
      max: fahrenheitToCelsius(THRESHOLDS_F.ambient.max, 2),
    },
    probe: {
      min: fahrenheitToCelsius(THRESHOLDS_F.probe.min, 2),
      max: fahrenheitToCelsius(THRESHOLDS_F.probe.max, 2),
    },
  };
}

function planThresholdUpdates(sensors) {
  const thresholdsC = getThresholdsCelsius();
  return sensors.map((sensor) => {
    const settings = {
      alert_temp_below: thresholdsC.ambient.min,
      alert_temp_above: thresholdsC.ambient.max,
    };

    if (sensor.type === "EX") {
      settings.minTcTemp = thresholdsC.probe.min;
      settings.maxTcTemp = thresholdsC.probe.max;
    }

    return {
      sensor_id: sensor.sensor_id,
      sensor_name: sensor.sensor_name,
      type: sensor.type,
      settings,
    };
  });
}

async function applyPlannedUpdates(plannedUpdates) {
  const results = [];
  for (const update of plannedUpdates) {
    const res = await updateSensorSettings(update.sensor_id, update.settings);
    results.push({
      sensor_id: update.sensor_id,
      sensor_name: update.sensor_name,
      type: update.type,
      result: res?.type || "unknown",
      message: res?.message || "",
    });
  }
  return results;
}

async function planFromApi() {
  const sensorsResponse = await getSensors();
  const sensors = sensorsResponse?.data?.items || [];
  return {
    sensorsResponse,
    sensors,
    plannedUpdates: planThresholdUpdates(sensors),
  };
}

module.exports = {
  THRESHOLDS_F,
  applyPlannedUpdates,
  getThresholdsCelsius,
  planFromApi,
  planThresholdUpdates,
};

