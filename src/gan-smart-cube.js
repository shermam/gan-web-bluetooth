/**
 * @import {
 *   BluetoothDeviceWithMAC,
 *   GanCubeConnection,
 *   GanCubeCommand,
 *   GanCubeEvent,
 *   GanCubeMove,
 *   MacAddressProvider,
 * } from "./types"
 */

import * as def from "./gan-cube-definitions.js";
import {
  GanGen2CubeEncrypter,
  GanGen3CubeEncrypter,
  GanGen4CubeEncrypter,
} from "./gan-cube-encrypter.js";
import {
  GanCubeClassicConnection,
  GanGen2ProtocolDriver,
  GanGen3ProtocolDriver,
  GanGen4ProtocolDriver,
} from "./gan-cube-protocol.js";

/**
 * Iterate over all known GAN cube CICs to find Manufacturer Specific Data
 *
 * @param {BluetoothManufacturerData | DataView} manufacturerData
 * @returns {DataView | undefined}
 */
function getManufacturerDataBytes(manufacturerData) {
  // Workaround for Bluefy browser which may return raw DataView directly instead of Map
  if (manufacturerData instanceof DataView) {
    return new DataView(manufacturerData.buffer.slice(2, 11));
  }
  for (const id of def.GAN_CIC_LIST) {
    const data = manufacturerData.get(id);
    if (data) {
      return new DataView(data.buffer.slice(0, 9));
    }
  }
  return;
}

/**
 * Extract MAC from last 6 bytes of Manufacturer Specific Data
 * @param {BluetoothManufacturerData} manufacturerData
 * */
function extractMAC(manufacturerData) {
  /** @type {Array<string>} */
  const mac = [];
  const dataView = getManufacturerDataBytes(manufacturerData);
  if (dataView && dataView.byteLength >= 6) {
    for (let i = 1; i <= 6; i++) {
      mac.push(
        dataView
          .getUint8(dataView.byteLength - i)
          .toString(16)
          .toUpperCase()
          .padStart(2, "0"),
      );
    }
  }
  return mac.join(":");
}

/**
 * If browser supports Web Bluetooth watchAdvertisements() API, try to retrieve MAC address automatically
 * @param {BluetoothDevice} device
 * @returns {Promise<string | null>}
 */
async function autoRetrieveMacAddress(device) {
  return new Promise((resolve) => {
    if (typeof device.watchAdvertisements != "function") {
      resolve(null);
    }
    const abortController = new AbortController();
    const onAbort = () => {
      abortController.abort();
      resolve(null);
    };

    device
      .when("advertisementreceived")
      .take(1)
      .subscribe(
        (e) => {
          const evt = /** @type {BluetoothAdvertisingEvent} */ (e);
          const mac = extractMAC(evt.manufacturerData);
          resolve(mac || null);
        },
        { signal: abortController.signal },
      );

    device
      .watchAdvertisements({ signal: abortController.signal })
      .catch(onAbort);
    setTimeout(onAbort, 10000);
  });
}

/**
 * Initiate new connection with the GAN Smart Cube device
 * @param {MacAddressProvider} [customMacAddressProvider] Optional custom provider for cube MAC address
 * @returns {Promise<GanCubeConnection>} Object representing connection API and state
 */
async function connectGanCube(customMacAddressProvider) {
  // Request user for the bluetooth device (popup selection dialog)
  /** @type {BluetoothDeviceWithMAC} */
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: "GAN" },
      { namePrefix: "MG" },
      { namePrefix: "AiCube" },
    ],
    optionalServices: [
      def.GAN_GEN2_SERVICE,
      def.GAN_GEN3_SERVICE,
      def.GAN_GEN4_SERVICE,
    ],
    optionalManufacturerData: def.GAN_CIC_LIST,
  });

  // Retrieve cube MAC address needed for key salting
  const mac =
    (customMacAddressProvider &&
      (await customMacAddressProvider(device, false))) ||
    (await autoRetrieveMacAddress(device)) ||
    (customMacAddressProvider &&
      (await customMacAddressProvider(device, true)));

  if (!mac)
    throw new Error(
      "Unable to determine cube MAC address, connection is not possible!",
    );
  device.mac = mac;

  // Create encryption salt from MAC address bytes placed in reverse order
  const salt = new Uint8Array(
    device.mac
      .split(/[:-\s]+/)
      .map((c) => parseInt(c, 16))
      .reverse(),
  );

  // Connect to GATT and get device primary services
  const gatt = await device.gatt?.connect();
  const services = await gatt?.getPrimaryServices();

  /** @type {GanCubeConnection | null} */
  let conn = null;

  // Resolve type of connected cube device and setup appropriate encryption / protocol driver
  for (let service of services ?? []) {
    let serviceUUID = service.uuid.toLowerCase();
    if (serviceUUID == def.GAN_GEN2_SERVICE) {
      let commandCharacteristic = await service.getCharacteristic(
        def.GAN_GEN2_COMMAND_CHARACTERISTIC,
      );
      let stateCharacteristic = await service.getCharacteristic(
        def.GAN_GEN2_STATE_CHARACTERISTIC,
      );
      let key = device.name?.startsWith("AiCube")
        ? def.GAN_ENCRYPTION_KEYS[1]
        : def.GAN_ENCRYPTION_KEYS[0];
      let encrypter = new GanGen2CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      let driver = new GanGen2ProtocolDriver();
      conn = await GanCubeClassicConnection.create(
        device,
        commandCharacteristic,
        stateCharacteristic,
        encrypter,
        driver,
      );
      break;
    } else if (serviceUUID == def.GAN_GEN3_SERVICE) {
      let commandCharacteristic = await service.getCharacteristic(
        def.GAN_GEN3_COMMAND_CHARACTERISTIC,
      );
      let stateCharacteristic = await service.getCharacteristic(
        def.GAN_GEN3_STATE_CHARACTERISTIC,
      );
      let key = def.GAN_ENCRYPTION_KEYS[0];
      let encrypter = new GanGen3CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      let driver = new GanGen3ProtocolDriver();
      conn = await GanCubeClassicConnection.create(
        device,
        commandCharacteristic,
        stateCharacteristic,
        encrypter,
        driver,
      );
      break;
    } else if (serviceUUID == def.GAN_GEN4_SERVICE) {
      let commandCharacteristic = await service.getCharacteristic(
        def.GAN_GEN4_COMMAND_CHARACTERISTIC,
      );
      let stateCharacteristic = await service.getCharacteristic(
        def.GAN_GEN4_STATE_CHARACTERISTIC,
      );
      let key = def.GAN_ENCRYPTION_KEYS[0];
      let encrypter = new GanGen4CubeEncrypter(
        new Uint8Array(key.key),
        new Uint8Array(key.iv),
        salt,
      );
      let driver = new GanGen4ProtocolDriver();
      conn = await GanCubeClassicConnection.create(
        device,
        commandCharacteristic,
        stateCharacteristic,
        encrypter,
        driver,
      );
      break;
    }
  }

  if (!conn)
    throw new Error(
      "Can't find target BLE services - wrong or unsupported cube device model",
    );

  return conn;
}

export { connectGanCube };
