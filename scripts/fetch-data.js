const fs = require("fs");
const path = require("path");

const { getSensors, celsiusToFahrenheit } = require("../src/tempstickClient");

function normalizeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}

async function main() {
  const response = await getSensors();
  const items = response?.data?.items || [];

  const augmented = items.map((sensor) => {
    const lastTempC = normalizeNumber(sensor.last_temp);
    const lastTempF =
      typeof lastTempC === "number" ? celsiusToFahrenheit(lastTempC, 1) : null;

    const probeTempC = normalizeNumber(sensor.last_tcTemp);
    const probeTempF =
      typeof probeTempC === "number" ? celsiusToFahrenheit(probeTempC, 1) : null;

    return {
      ...sensor,
      last_temp_f: lastTempF,
      last_tcTemp_c: probeTempC,
      last_tcTemp_f: probeTempF,
    };
  });

  const output = {
    generated_at: new Date().toISOString(),
    sensor_count: augmented.length,
    items: augmented,
  };

  const outPath = path.join(__dirname, "..", "assets", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${augmented.length} sensors to ${outPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

