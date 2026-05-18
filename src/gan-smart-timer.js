/**
 * @import {
 *   GanTimerConnection,
 *   GanTimerEvent,
 *   GanTimerRecordedTimes,
 *   GanTimerState,
 *   GanTimerTime
 * } from "./types"
 */

// GAN Smart Timer bluetooth service and characteristic UUIDs
const GAN_TIMER_SERVICE = "0000fff0-0000-1000-8000-00805f9b34fb";
const GAN_TIMER_TIME_CHARACTERISTIC = "0000fff2-0000-1000-8000-00805f9b34fb";
const GAN_TIMER_STATE_CHARACTERISTIC = "0000fff5-0000-1000-8000-00805f9b34fb";

/**
 * GAN Smart Timer events/states
 * @enum {GanTimerState}
 */
const STATE = {
  /** Fired when timer is disconnected from bluetooth */
  DISCONNECT: 0,
  /** Grace delay is expired and timer is ready to start */
  GET_SET: 1,
  /** Hands removed from the timer before grace delay expired */
  HANDS_OFF: 2,
  /** Timer is running */
  RUNNING: 3,
  /** Timer is stopped, this event includes recorded time */
  STOPPED: 4,
  /** Timer is reset and idle */
  IDLE: 5,
  /** Hands are placed on the timer */
  HANDS_ON: 6,
  /** Timer moves to this state immediately after STOPPED */
  FINISHED: 7,
};

/**
 * Construct time object
 *
 * @param {number} min
 * @param {number} sec
 * @param {number} msec
 * @returns {GanTimerTime}
 */
function makeTime(min, sec, msec) {
  return {
    minutes: min,
    seconds: sec,
    milliseconds: msec,
    asTimestamp: 60000 * min + 1000 * sec + msec,
    toString: () =>
      `${min.toString(10)}:${sec.toString(10).padStart(2, "0")}.${msec.toString(10).padStart(3, "0")}`,
  };
}

/**
 * Construct time object from raw event data
 *
 * @param {DataView} data
 * @param {number} offset
 * @returns {GanTimerTime}
 */
function makeTimeFromRaw(data, offset) {
  const min = data.getUint8(offset);
  const sec = data.getUint8(offset + 1);
  const msec = data.getUint16(offset + 2, true);
  return makeTime(min, sec, msec);
}

/**
 * Construct time object from milliseconds timestamp
 *
 * @param {number} timestamp
 * @returns {GanTimerTime}
 */
function makeTimeFromTimestamp(timestamp) {
  const min = Math.trunc(timestamp / 60000);
  const sec = Math.trunc((timestamp % 60000) / 1000);
  const msec = Math.trunc(timestamp % 1000);
  return makeTime(min, sec, msec);
}

/**
 * Calculate ArrayBuffer checksum using CRC-16/CCIT-FALSE algorithm variation
 *
 * @param {ArrayBuffer | SharedArrayBuffer} buff
 * @returns {number}
 */
function crc16ccit(buff) {
  const dataView = new DataView(buff);
  let crc = 0xffff;
  for (let i = 0; i < dataView.byteLength; ++i) {
    crc ^= dataView.getUint8(i) << 8;
    for (let j = 0; j < 8; ++j) {
      crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return crc & 0xffff;
}

/**
 * Ensure received timer event has valid data: check data magic and CRC
 *
 * @param {DataView} data
 * @returns {boolean}
 */
function validateEventData(data) {
  try {
    if (data?.byteLength == 0 || data.getUint8(0) != 0xfe) {
      return false;
    }
    const eventCRC = data.getUint16(data.byteLength - 2, true);
    const calculatedCRC = crc16ccit(data.buffer.slice(2, data.byteLength - 2));
    return eventCRC == calculatedCRC;
  } catch (err) {
    return false;
  }
}

/**
 * Construct event object from raw data
 *
 * @param {DataView} data
 * @returns {GanTimerEvent}
 */
function buildTimerEvent(data) {
  /** @type {GanTimerEvent} */
  const evt = {
    state: data.getUint8(3),
  };
  if (evt.state == STATE.STOPPED) {
    evt.recordedTime = makeTimeFromRaw(data, 4);
  }
  return evt;
}

/**
 * Initiate new connection with the GAN Smart Timer device
 * @returns {Promise<GanTimerConnection>} Connection connection object representing connection API and state
 */
async function connectGanTimer() {
  // Request user for the bluetooth device (popup selection dialog)
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: "GAN" },
      { namePrefix: "gan" },
      { namePrefix: "Gan" },
    ],
    optionalServices: [GAN_TIMER_SERVICE],
  });

  if (!device.gatt) throw new Error("Gatt server is not defined");

  // Connect to GATT server
  const server = await device.gatt.connect();

  // Connect to main timer service and characteristics
  const service = await server.getPrimaryService(GAN_TIMER_SERVICE);
  const timeCharacteristic = await service.getCharacteristic(
    GAN_TIMER_TIME_CHARACTERISTIC,
  );
  const stateCharacteristic = await service.getCharacteristic(
    GAN_TIMER_STATE_CHARACTERISTIC,
  );

  /**
   * This action retrieves latest recorded times from timer
   * @returns {Promise<GanTimerRecordedTimes>}
   */
  const getRecordedTimesAction = async () => {
    const data = await timeCharacteristic.readValue();
    return data?.byteLength >= 16
      ? Promise.resolve({
          displayTime: makeTimeFromRaw(data, 0),
          previousTimes: [
            makeTimeFromRaw(data, 4),
            makeTimeFromRaw(data, 8),
            makeTimeFromRaw(data, 12),
          ],
        })
      : Promise.reject("Invalid time characteristic value received from Timer");
  };

  const events$ = stateCharacteristic
    .when("characteristicvaluechanged")
    .takeUntil(device.when("gattserverdisconnected"))
    .map(() => {
      const data = stateCharacteristic.value;
      if (!data) throw new Error("Data is not defined");
      if (!validateEventData(data))
        throw new Error("Invalid event data received from Timer");
      return buildTimerEvent(data);
    });

  stateCharacteristic.startNotifications();

  return {
    events$,
    getRecordedTimes: getRecordedTimesAction,
  };
}

export { connectGanTimer, makeTime, makeTimeFromTimestamp, STATE };
