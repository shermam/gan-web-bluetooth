import { Observable } from "./observable";

/**
 * GAN Smart Timer events/states
 */
export enum GanTimerState {
  /** Fired when timer is disconnected from bluetooth */
  DISCONNECT = 0,
  /** Grace delay is expired and timer is ready to start */
  GET_SET = 1,
  /** Hands removed from the timer before grace delay expired */
  HANDS_OFF = 2,
  /** Timer is running */
  RUNNING = 3,
  /** Timer is stopped, this event includes recorded time */
  STOPPED = 4,
  /** Timer is reset and idle */
  IDLE = 5,
  /** Hands are placed on the timer */
  HANDS_ON = 6,
  /** Timer moves to this state immediately after STOPPED */
  FINISHED = 7,
}

/**
 * Representation of time value
 */
export interface GanTimerTime {
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;
  readonly asTimestamp: number;
  toString(): string;
}

/**
 * Timer state event
 */
export interface GanTimerEvent {
  /** Current timer state */
  state: GanTimerState;
  /** Recorder time value in case of STOPPED event */
  recordedTime?: GanTimerTime;
}

/**
 * Representation of recorded in timer memory time values
 */
export interface GanTimerRecordedTimes {
  displayTime: GanTimerTime;
  previousTimes: [GanTimerTime, GanTimerTime, GanTimerTime];
}

/**
 * GAN Timer connection object representing connection API and state
 */
export interface GanTimerConnection {
  /** RxJS Subject to subscribe for cube event messages */
  events$: Observable<GanTimerEvent>;
  /** Retrieve last time values recored by timer */
  getRecordedTimes(): Promise<GanTimerRecordedTimes>;
}

/**
 * Common cube encrypter interface
 */
export interface GanCubeEncrypter {
  /** Encrypt binary message buffer represented as Uint8Array */
  encrypt(data: Uint8Array): Promise<Uint8Array>;
  /** Decrypt binary message buffer represented as Uint8Array */
  decrypt(data: Uint8Array): Promise<Uint8Array>;
}

/** Command for requesting information about GAN Smart Cube hardware  */
export type GanCubeReqHardwareCommand = {
  type: "REQUEST_HARDWARE";
};

/** Command for requesting information about current facelets state  */
export type GanCubeReqFaceletsCommand = {
  type: "REQUEST_FACELETS";
};

/** Command for requesting information about current battery level  */
export type GanCubeReqBatteryCommand = {
  type: "REQUEST_BATTERY";
};

/** Command for resetting GAN Smart Cube internal facelets state to solved state */
export type GanCubeReqResetCommand = {
  type: "REQUEST_RESET";
};

/** Command message */
export type GanCubeCommand =
  | GanCubeReqHardwareCommand
  | GanCubeReqFaceletsCommand
  | GanCubeReqBatteryCommand
  | GanCubeReqResetCommand;

/**
 * Representation of GAN Smart Cube move
 */
export type GanCubeMove = {
  /** Face: 0 - U, 1 - R, 2 - F, 3 - D, 4 - L, 5 - B */
  face: number;
  /** Face direction: 0 - CW, 1 - CCW */
  direction: number;
  /** Cube move in common string notation, like R' or U */
  move: string;
  /** Timestamp according to host device clock, null in case if bluetooth event was missed and recovered */
  localTimestamp: number | null;
  /** Timestamp according to cube internal clock, for some cube models may be null in case if bluetooth event was missed and recovered */
  cubeTimestamp: number | null;
};

/**
 * Move event
 */
export type GanCubeMoveEvent = {
  type: "MOVE";
  /** Serial number, value range 0-255, increased in a circle on each facelets state change */
  serial: number;
} & GanCubeMove;

/**
 * Representation of GAN Smart Cube facelets state
 */
export type GanCubeState = {
  /** Corner Permutation: 8 elements, values from 0 to 7 */
  CP: Array<number>;
  /** Corner Orientation: 8 elements, values from 0 to 2 */
  CO: Array<number>;
  /** Edge Permutation: 12 elements, values from 0 to 11 */
  EP: Array<number>;
  /** Edge Orientation: 12 elements, values from 0 to 1 */
  EO: Array<number>;
};

/**
 * Facelets event
 */
export type GanCubeFaceletsEvent = {
  type: "FACELETS";
  /** Serial number, value range 0-255, increased in a circle on each facelets state change */
  serial: number;
  /** Cube facelets state in the Kociemba notation like "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB" */
  facelets: string;
  /** Cube state representing corners and edges orientation and permutation */
  state: GanCubeState;
};

/**
 * Quaternion to represent orientation
 */
export type GanCubeOrientationQuaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

/**
 * Representation of angular velocity by axes
 */
export type GanCubeAngularVelocity = {
  x: number;
  y: number;
  z: number;
};

/**
 * Gyroscope event
 */
export type GanCubeGyroEvent = {
  type: "GYRO";
  /** Cube orientation quaternion, uses Right-Handed coordinate system, +X - Red, +Y - Blue, +Z - White */
  quaternion: GanCubeOrientationQuaternion;
  /** Cube angular velocity over current ODR time frame */
  velocity?: GanCubeAngularVelocity;
};

/**
 * Battery event
 */
export type GanCubeBatteryEvent = {
  type: "BATTERY";
  /** Current battery level in percent */
  batteryLevel: number;
};

/**
 * Hardware event
 */
export type GanCubeHardwareEvent = {
  type: "HARDWARE";
  /** Internal cube hardware device model name */
  hardwareName?: string;
  /** Software/Firmware version of the cube */
  softwareVersion?: string;
  /** Hardware version of the cube */
  hardwareVersion?: string;
  /** Production Date of the cube */
  productDate?: string;
  /** Is gyroscope supported by this cube model */
  gyroSupported?: boolean;
};

/**
 * Disconnect event
 */
export type GanCubeDisconnectEvent = {
  type: "DISCONNECT";
};

/** All possible event message types */
export type GanCubeEventMessage =
  | GanCubeMoveEvent
  | GanCubeFaceletsEvent
  | GanCubeGyroEvent
  | GanCubeBatteryEvent
  | GanCubeHardwareEvent
  | GanCubeDisconnectEvent;
/** Cube event / response to command */
export type GanCubeEvent = { timestamp: number } & GanCubeEventMessage;

/** Extention to the BluetoothDevice for storing and accessing device MAC address */
export interface BluetoothDeviceWithMAC extends BluetoothDevice {
  mac?: string;
}

/**
 * Connection object representing connection API and state
 */
export interface GanCubeConnection {
  /** Connected Bluetooth cube device name */
  readonly deviceName: string;
  /** Connected Bluetoooth cube device MAC address */
  readonly deviceMAC: string;
  /** Observable to subscribe for cube event messages */
  events$?: Observable<GanCubeEvent>;
  /** Method to send command to the cube */
  sendCubeCommand(command: GanCubeCommand): Promise<void>;
}

/** Raw connection interface for internal use */
export interface GanCubeRawConnection {
  sendCommandMessage(message: Uint8Array): Promise<void>;
}

/** Protocol Driver interface */
export interface GanProtocolDriver {
  /** Create binary command message for cube device */
  createCommandMessage(command: GanCubeCommand): Uint8Array | undefined;
  /** Handle binary event messages from cube device */
  handleStateEvent(
    conn: GanCubeRawConnection,
    eventMessage: Uint8Array,
  ): Promise<GanCubeEvent[]>;
}

/**
 * Type representing function interface to implement custom MAC address provider
 * @param device Current BluetoothDevice selected by user.
 * @param isFallbackCall Flag indicating this is final and last resort call for MAC address.
 *                       If this flag is not set, custom provider can return null instead of MAC,
 *                       in such case library will try to read MAC automatically.
 */
export type MacAddressProvider = (
  device: BluetoothDevice,
  isFallbackCall?: boolean,
) => Promise<string | null>;
