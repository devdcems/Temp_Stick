# TempStick API Notes And Starter CLI

I reviewed the Temp Stick API documentation at `https://tempstickapi.com/docs/#api-_header` and set up a small Node.js CLI that uses your existing `.env` key (`TEMP_STICK_API`).

This gives you a safe place to:
- Inspect sensors, alerts, and notifications
- Pull readings
- Configure sensor alert thresholds and intervals
- Update user display preferences (time zone / F vs C)
- Run a dashboard web app

## What the API can do (documented endpoints)

### Alerts and notifications
- Get all alerts: `GET /alerts/all`
- Get a single alert: `GET /alerts/:alert_id`
- Get sensor notifications (last 7 days): `GET /sensor/notifications/:sensorId`
- Get user notifications (last 7 days): `GET /user/notifications`

### Sensors
- Get all sensors: `GET /sensors/all`
- Get a single sensor: `GET /sensor/:sensor_id`
- Get readings for a sensor: `GET /sensor/:sensor_id/readings`
- Update sensor settings: `POST /sensor/:sensor_id`

### User
- Get current user: `GET /user`
- Get email reports: `GET /user/email-reports`
- Get allowed time zones: `GET /user/allowed-timezones`
- Update display preferences: `POST /user/display-preferences`

## Important implementation details from the docs

- Every request must include the `X-API-KEY` header.
- Temperatures and temperature settings are always in Celsius.
- Timestamps are returned in UTC.
- POST requests should be `multipart/form-data`.

The CLI handles all of these for you.

## What I added

- API client: `src/tempstickClient.js`
- CLI runner: `src/cli.js`
- NPM scripts: `package.json`

## Setup

From the repo root:

```bash
npm install
```

You already have:

```bash
TEMP_STICK_API=your_api_key_here
```

in `.env`.

## Dashboard App

I added a simple custom dashboard:

```bash
npm run dashboard
```

Then open:

- `http://localhost:8787`

What you can do:
- View all sensors, current temps, humidity, and online/offline status
- Search sensors and hide offline units
- Edit per-sensor ambient thresholds (and probe thresholds for EX sensors)
- Apply the fleet thresholds (34–90 ambient, 34–60 probe)

## How to use it

You can run commands directly:

```bash
node src/cli.js sensors
node src/cli.js alerts
node src/cli.js user-notifications
```

Or via npm scripts:

```bash
npm run sensors
npm run alerts
npm run user-notifications
```

## Configure notifications (sensor alert thresholds)

The most direct way to configure notifications via the API is the sensor settings endpoint:

- `POST /sensor/:sensor_id`

Common alert-related fields include:
- `alert_temp_above`
- `alert_temp_below`
- `alert_humidity_above`
- `alert_humidity_below`
- `alert_interval`
- `use_alert_interval`
- `send_interval`
- `connection_sensitivity`

Example:

```bash
node src/cli.js update-sensor SENSOR_ID \
  alert_temp_above=8 \
  alert_temp_below=2 \
  use_alert_interval=1 \
  alert_interval=1800 \
  send_interval=900
```

Notes:
- The temperature values above are Celsius.
- You can discover your `SENSOR_ID` with `node src/cli.js sensors`.

## Apply your fleet thresholds (34–60 probe, 34–90 ambient)

I added a command that applies these thresholds across all sensors:
- Probe sensors (EX): min 34 F, max 60 F
- Ambient sensors: min 34 F, max 90 F

First run a dry run:

```bash
node src/cli.js apply-thresholds
```

Then apply:

```bash
node src/cli.js apply-thresholds --apply
```

The command converts Fahrenheit to Celsius for you:
- 34 F → 1.11 C
- 60 F → 15.56 C
- 90 F → 32.22 C

## Pull readings

Basic:

```bash
node src/cli.js readings SENSOR_ID setting=24_hours
```

Custom window:

```bash
node src/cli.js readings SENSOR_ID \
  setting=custom \
  start=2026-01-20 \
  end=2026-01-27 \
  start_time=00:00 \
  end_time=23:59
```

You can also pass `offset` as a UTC offset in seconds (for example `offset=-18000`).

## Update display preferences

First list supported time zones:

```bash
node src/cli.js timezones
```

Then update:

```bash
node src/cli.js update-display timezone=America/New_York temp_pref=F
```

## Recommended next steps

Good next moves:
- Run `node src/cli.js sensors` and identify the specific sensors you want to configure.
- Tell me the alert thresholds and intervals you want, and I can add a dedicated “apply-alerts” script that updates all sensors consistently.
