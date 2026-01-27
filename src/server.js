const express = require("express");
const path = require("path");

const {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  getAlerts,
  getCurrentUser,
  getSensorNotifications,
  getSensors,
  getUserNotifications,
  updateSensorSettings,
} = require("./tempstickClient");
const {
  THRESHOLDS_F,
  applyPlannedUpdates,
  getThresholdsCelsius,
  planFromApi,
} = require("./thresholds");

const app = express();
const PORT = process.env.PORT || 8787;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

const imagesDir = path.join(__dirname, "..", "images");
app.use("/images", express.static(imagesDir));

function augmentSensor(sensor) {
  const lastTempC = sensor.last_temp;
  const lastTempF =
    typeof lastTempC === "number" ? celsiusToFahrenheit(lastTempC, 1) : null;

  const probeTempC =
    sensor.last_tcTemp !== undefined && sensor.last_tcTemp !== null
      ? Number(sensor.last_tcTemp)
      : null;
  const probeTempF =
    typeof probeTempC === "number" && !Number.isNaN(probeTempC)
      ? celsiusToFahrenheit(probeTempC, 1)
      : null;

  return {
    ...sensor,
    last_temp_f: lastTempF,
    last_tcTemp_c: probeTempC,
    last_tcTemp_f: probeTempF,
  };
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  return false;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.get("/api/user", async (_req, res) => {
  try {
    const data = await getCurrentUser();
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get("/api/sensors", async (_req, res) => {
  try {
    const data = await getSensors();
    const items = data?.data?.items || [];
    const augmented = items.map(augmentSensor);
    res.json({ ...data, data: { ...data.data, items: augmented } });
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get("/api/alerts", async (_req, res) => {
  try {
    const data = await getAlerts();
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const { items_per_page, page } = req.query;
    const data = await getUserNotifications({ items_per_page, page });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get("/api/sensor/:sensorId/notifications", async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { items_per_page, page } = req.query;
    const data = await getSensorNotifications(sensorId, { items_per_page, page });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get("/api/thresholds/plan", async (_req, res) => {
  try {
    const { plannedUpdates, sensors } = await planFromApi();
    res.json({
      type: "success",
      message: "threshold plan",
      thresholds_fahrenheit: THRESHOLDS_F,
      thresholds_celsius: getThresholdsCelsius(),
      sensor_count: sensors.length,
      planned_updates: plannedUpdates,
    });
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.post("/api/thresholds/apply", async (req, res) => {
  try {
    const apply = toBoolean(req.body.apply);
    const { plannedUpdates, sensors } = await planFromApi();

    if (!apply) {
      res.json({
        type: "success",
        message: "dry run only",
        applied: false,
        thresholds_fahrenheit: THRESHOLDS_F,
        thresholds_celsius: getThresholdsCelsius(),
        sensor_count: sensors.length,
        planned_updates: plannedUpdates,
      });
      return;
    }

    const results = await applyPlannedUpdates(plannedUpdates);
    res.json({
      type: "success",
      message: "thresholds applied",
      applied: true,
      thresholds_fahrenheit: THRESHOLDS_F,
      thresholds_celsius: getThresholdsCelsius(),
      sensor_count: sensors.length,
      results,
    });
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.post("/api/sensor/:sensorId", async (req, res) => {
  try {
    const { sensorId } = req.params;
    const body = req.body || {};

    const settings = { ...body };

    if (settings.alert_temp_below_f !== undefined) {
      settings.alert_temp_below = fahrenheitToCelsius(
        Number(settings.alert_temp_below_f),
        2
      );
      delete settings.alert_temp_below_f;
    }

    if (settings.alert_temp_above_f !== undefined) {
      settings.alert_temp_above = fahrenheitToCelsius(
        Number(settings.alert_temp_above_f),
        2
      );
      delete settings.alert_temp_above_f;
    }

    if (settings.minTcTemp_f !== undefined) {
      settings.minTcTemp = fahrenheitToCelsius(Number(settings.minTcTemp_f), 2);
      delete settings.minTcTemp_f;
    }

    if (settings.maxTcTemp_f !== undefined) {
      settings.maxTcTemp = fahrenheitToCelsius(Number(settings.maxTcTemp_f), 2);
      delete settings.maxTcTemp_f;
    }

    const data = await updateSensorSettings(sensorId, settings);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.payload || { message: error.message });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TempStick dashboard running on http://localhost:${PORT}`);
});
