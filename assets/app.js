const API_BASE_URL = window.API_BASE_URL || "";

const BUSINESS_THRESHOLDS_F = {
  ambient: { min: 34, max: 90 },
  probe: { min: 34, max: 60 },
};

const state = {
  sensors: [],
  notifications: [],
  nameFilter: "medic",
};

function cToF(celsius, roundTo = 1) {
  if (celsius === null || celsius === undefined || Number.isNaN(Number(celsius))) {
    return null;
  }
  const fahrenheit = Number(celsius) * 1.8 + 32;
  const factor = 10 ** roundTo;
  return Math.round(fahrenheit * factor) / factor;
}

function fToC(fahrenheit, roundTo = 2) {
  if (fahrenheit === null || fahrenheit === undefined || Number.isNaN(Number(fahrenheit))) {
    return null;
  }
  const celsius = (Number(fahrenheit) - 32) / 1.8;
  const factor = 10 ** roundTo;
  return Math.round(celsius * factor) / factor;
}

const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function normalizeUtcString(value) {
  if (!value) return null;
  let normalized = String(value).trim().replace(" ", "T");
  normalized = normalized.replace("-00:00Z", "Z").replace("+00:00Z", "Z");
  if (/[zZ]$/.test(normalized)) {
    return normalized;
  }
  if (/[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  return `${normalized}Z`;
}

function formatDateEastern(value) {
  const normalized = normalizeUtcString(value);
  if (!normalized) return "—";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return easternFormatter.format(date);
}

function withApiBase(url) {
  if (!API_BASE_URL || url.startsWith("http")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

async function fetchJson(url, options) {
  const res = await fetch(withApiBase(url), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Non-JSON response from ${url}`);
  }
  if (!res.ok) {
    const message = data?.message || res.statusText;
    throw new Error(message);
  }
  return data;
}

function getAmbientThresholdF(sensor, key) {
  const raw = sensor[key];
  if (raw === "" || raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (Number.isNaN(num)) return null;
  if (num <= -90) return null;
  return cToF(num, 1);
}

function getProbeThresholdF(sensor, key) {
  const raw = sensor[key];
  if (raw === "" || raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (Number.isNaN(num)) return null;
  return cToF(num, 1);
}

function statusPill(sensor) {
  const offline = String(sensor.offline) === "1";
  const cls = offline ? "status-pill status-pill--offline" : "status-pill status-pill--online";
  const label = offline ? "Offline" : "Online";
  return `<span class="${cls}">${label}</span>`;
}

function sensorsFiltered() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const hideOffline = document.getElementById("hideOffline").checked;

  return state.sensors.filter((sensor) => {
    const ssid = String(sensor.ssid || "").toLowerCase();
    if (state.nameFilter === "medic" && !ssid.startsWith("medic")) {
      return false;
    }
    if (state.nameFilter === "backup" && !ssid.includes("backup")) {
      return false;
    }
    if (hideOffline && String(sensor.offline) === "1") {
      return false;
    }
    if (!search) {
      return true;
    }
    const haystack = `${sensor.ssid || ""} ${sensor.sensor_name || ""} ${
      sensor.sensor_id || ""
    } ${sensor.type || ""}`.toLowerCase();
    return haystack.includes(search);
  });
}

function renderSensorsMeta(filtered) {
  const meta = document.getElementById("sensorsMeta");
  const total = state.sensors.length;
  const online = state.sensors.filter((s) => String(s.offline) !== "1").length;
  meta.textContent = `Showing ${filtered.length} of ${total} sensors • ${online} online`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeThermometerPercents(tempF, minF, maxF, padF = 20) {
  const rangeMin = minF - padF;
  const rangeMax = maxF + padF;
  const rangeSpan = rangeMax - rangeMin;
  if (!Number.isFinite(tempF) || rangeSpan <= 0) {
    return { fillPct: 0, minPct: 30, maxPct: 70 };
  }
  const fillPct = clamp(((tempF - rangeMin) / rangeSpan) * 100, 0, 100);
  const minPct = clamp(((minF - rangeMin) / rangeSpan) * 100, 0, 100);
  const maxPct = clamp(((maxF - rangeMin) / rangeSpan) * 100, 0, 100);
  return { fillPct, minPct, maxPct };
}

function isOutOfRangeCelsius(tempC, minC, maxC) {
  if (!Number.isFinite(tempC)) return false;
  return tempC < minC || tempC > maxC;
}

function thermometerCardHtml({
  label,
  tempC,
  minF,
  maxF,
  isAlert,
  isEmpty,
  padF = 20,
}) {
  const numericTempC = Number(tempC);
  const hasTemp = Number.isFinite(numericTempC);
  const tempF = hasTemp ? cToF(numericTempC, 1) : null;

  const { fillPct, minPct, maxPct } = computeThermometerPercents(
    tempF,
    minF,
    maxF,
    padF
  );

  const tubeHeightPx = 90;
  const minPosPx = (minPct / 100) * tubeHeightPx;
  const maxPosPx = (maxPct / 100) * tubeHeightPx;

  const cardClasses = [
    "thermo-card",
    isAlert ? "thermo-card--alert" : "",
    isEmpty ? "thermo-card--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const thermometerClasses = ["thermometer", isAlert ? "thermometer--alert" : ""]
    .filter(Boolean)
    .join(" ");

  const safeMinF = Number(minF);
  const safeMaxF = Number(maxF);
  const rangeText =
    Number.isFinite(safeMinF) && Number.isFinite(safeMaxF)
      ? `${safeMinF.toFixed(0)}–${safeMaxF.toFixed(0)}°F`
      : `${minF}–${maxF}°F`;

  const valueText = hasTemp ? `${tempF.toFixed(1)}°F` : "—";
  const valueSub = hasTemp ? "" : "No data";

  return `
    <div class="${cardClasses}">
      <div
        class="${thermometerClasses}"
        style="--fill-pct:${fillPct.toFixed(1)}; --min-pos:${minPosPx.toFixed(
    1
  )}px; --max-pos:${maxPosPx.toFixed(1)}px;"
        aria-label="${label} thermometer"
      >
        <div class="thermometer__tube">
          <div class="thermometer__fill"></div>
        </div>
        <div class="thermometer__bulb">
          <div class="thermometer__bulb-fill"></div>
        </div>
        <div class="thermometer__marker thermometer__marker--min" title="Min"></div>
        <div class="thermometer__marker thermometer__marker--max" title="Max"></div>
      </div>
      <div>
        <div class="thermo-label">${label}</div>
        <div class="thermo-value">${valueText}</div>
        ${valueSub ? `<div class="thermo-value-sub">${valueSub}</div>` : ""}
        <div class="thermo-thresholds">
          Range: ${rangeText}
        </div>
      </div>
    </div>
  `;
}

function renderSensors() {
  const rows = document.getElementById("sensorsRows");

  const filtered = sensorsFiltered();

  const prepared = filtered.map((sensor) => {
    const offline = String(sensor.offline) === "1";
    const displayName = sensor.ssid || sensor.sensor_name || sensor.sensor_id;

    const ambientTempC = Number(sensor.last_temp);
    const probeTempC =
      sensor.last_tcTemp_c !== null && sensor.last_tcTemp_c !== undefined
        ? Number(sensor.last_tcTemp_c)
        : null;

    const ambientMinF =
      getAmbientThresholdF(sensor, "alert_temp_below") ?? BUSINESS_THRESHOLDS_F.ambient.min;
    const ambientMaxF =
      getAmbientThresholdF(sensor, "alert_temp_above") ?? BUSINESS_THRESHOLDS_F.ambient.max;
    const probeMinF =
      getProbeThresholdF(sensor, "minTcTemp") ?? BUSINESS_THRESHOLDS_F.probe.min;
    const probeMaxF =
      getProbeThresholdF(sensor, "maxTcTemp") ?? BUSINESS_THRESHOLDS_F.probe.max;

    const ambientMinC = fToC(ambientMinF, 2);
    const ambientMaxC = fToC(ambientMaxF, 2);
    const probeMinC = fToC(probeMinF, 2);
    const probeMaxC = fToC(probeMaxF, 2);

    const ambientAlert =
      !offline && isOutOfRangeCelsius(ambientTempC, ambientMinC, ambientMaxC);
    const hasProbe = sensor.type === "EX" && Number.isFinite(probeTempC);
    const probeAlert =
      hasProbe && !offline && isOutOfRangeCelsius(probeTempC, probeMinC, probeMaxC);
    const rowAlert = ambientAlert || probeAlert;

    return {
      sensor,
      offline,
      displayName,
      ambientTempC,
      probeTempC,
      ambientMinF,
      ambientMaxF,
      probeMinF,
      probeMaxF,
      ambientAlert,
      probeAlert,
      rowAlert,
      hasProbe,
    };
  });

  prepared.sort((a, b) => {
    if (a.rowAlert !== b.rowAlert) {
      return a.rowAlert ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });

  renderSensorsMeta(prepared.map((item) => item.sensor));

  if (!prepared.length) {
    rows.innerHTML = `<div class="muted">No sensors match your filters.</div>`;
    return;
  }

  rows.innerHTML = prepared
    .map((item) => {
      const {
        sensor,
        offline,
        displayName,
        ambientTempC,
        probeTempC,
        ambientMinF,
        ambientMaxF,
        probeMinF,
        probeMaxF,
        ambientAlert,
        probeAlert,
        rowAlert,
        hasProbe,
      } = item;

      const ambientThermo = thermometerCardHtml({
        label: "Drawer",
        tempC: ambientTempC,
        minF: ambientMinF,
        maxF: ambientMaxF,
        isAlert: ambientAlert,
        isEmpty: !Number.isFinite(ambientTempC),
        padF: 24,
      });

      const probeThermo = thermometerCardHtml({
        label: "Cooler",
        tempC: hasProbe ? probeTempC : null,
        minF: probeMinF,
        maxF: probeMaxF,
        isAlert: probeAlert,
        isEmpty: !hasProbe,
        padF: 18,
      });

      const rowClasses = [
        "sensor-row",
        offline ? "sensor-row--offline" : "",
        rowAlert ? "sensor-row--alert" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${rowClasses}" data-sensor-id="${sensor.sensor_id}">
          <div class="sensor-info">
            <div class="sensor-name" title="${displayName}">${displayName}</div>
            ${statusPill(sensor)}
          </div>
          <div class="thermo-group">
            ${ambientThermo}
            ${probeThermo}
          </div>
          <div class="checkins">
            <div class="checkins__item">
              <div class="checkins__label">Last</div>
              <div class="checkins__value">${formatDateEastern(sensor.last_checkin)}</div>
            </div>
            <div class="checkins__item">
              <div class="checkins__label">Next</div>
              <div class="checkins__value">${formatDateEastern(sensor.next_checkin)}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadSensors() {
  let items = [];

  if (!API_BASE_URL) {
    try {
      const snapshot = await fetchJson("assets/data.json");
      items = snapshot?.items || [];
    } catch (error) {
      // Fall back to API if available locally.
      const data = await fetchJson("/api/sensors");
      items = data?.data?.items || [];
    }
  } else {
    const data = await fetchJson("/api/sensors");
    items = data?.data?.items || [];
  }

  state.sensors = items;
  renderSensors();
}

async function refreshAll() {
  await loadSensors();
}

function wireEvents() {
  document.getElementById("refreshBtn").addEventListener("click", refreshAll);
  document.getElementById("searchInput").addEventListener("input", renderSensors);
  document.getElementById("hideOffline").addEventListener("change", renderSensors);

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-filter") || "all";
      state.nameFilter = value;

      document.querySelectorAll("[data-filter]").forEach((btn) => {
        btn.classList.toggle("filter-btn--active", btn === button);
      });

      renderSensors();
    });
  });

  // Notifications removed.
}

wireEvents();
refreshAll().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
