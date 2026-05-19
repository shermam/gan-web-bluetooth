// After spending quite some time trying to replace the AES lib
// with the native Web Crypto API (https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) I gave up.
// It looks like WebCrypto AES-CBC outputs 32 bytes even if the input is aligned to 16 bytes due to padding.
// https://github.com/w3c/webcrypto/issues/295
// https://stackoverflow.com/questions/53765207/webcrypto-aes-cbc-outputting-256bit-instead-of-128bits
// Encrypting is fine as I could just take the first 16 bytes of the result,
// but decrypt also expects the message to be padded

import { ModeOfOperation } from "./aes.js";

/**
 * Implementation for encryption scheme used in the GAN Gen2 Smart Cubes
 */
export class GanGen2CubeEncrypter {
  /** @type {Uint8Array<ArrayBuffer>} */
  #iv;

  /** @type {Uint8Array<ArrayBuffer>} */
  #key;

  /**
   *
   * @param {Uint8Array<ArrayBuffer>} key
   * @param {Uint8Array<ArrayBuffer>} iv
   * @param {Uint8Array<ArrayBuffer>} salt
   */
  constructor(key, iv, salt) {
    if (key.length != 16)
      throw new Error("Key must be 16 bytes (128-bit) long");
    if (iv.length != 16) throw new Error("Iv must be 16 bytes (128-bit) long");
    if (salt.length != 6) throw new Error("Salt must be 6 bytes (48-bit) long");
    // Apply salt to key and iv
    this.#key = new Uint8Array(key);
    this.#iv = new Uint8Array(iv);
    for (let i = 0; i < 6; i++) {
      this.#key[i] = (key[i] + salt[i]) % 0xff;
      this.#iv[i] = (iv[i] + salt[i]) % 0xff;
    }
  }

  /**
   * Encrypt 16-byte buffer chunk starting at offset using AES-128-CBC
   * @param {Uint8Array<ArrayBuffer>} buffer
   * @param {number} offset
   */
  #encryptChunk(buffer, offset) {
    const cipher = new ModeOfOperation.cbc(this.#key, this.#iv);
    const chunk = cipher.encrypt(buffer.subarray(offset, offset + 16));
    buffer.set(chunk, offset);
  }

  /**
   * Decrypt 16-byte buffer chunk starting at offset using AES-128-CBC
   * @param {Uint8Array<ArrayBuffer>} buffer
   * @param {number} offset
   */
  #decryptChunk(buffer, offset) {
    const cipher = new ModeOfOperation.cbc(this.#key, this.#iv);
    const chunk = cipher.decrypt(buffer.subarray(offset, offset + 16));
    buffer.set(chunk, offset);
  }

  /**
   *
   * @param {Uint8Array<ArrayBuffer>} data
   * @returns {Uint8Array<ArrayBuffer>}
   */
  encrypt(data) {
    if (data.length < 16) throw Error("Data must be at least 16 bytes long");
    const res = new Uint8Array(data);
    // encrypt 16-byte chunk aligned to message start
    this.#encryptChunk(res, 0);
    // encrypt 16-byte chunk aligned to message end
    if (res.length > 16) {
      this.#encryptChunk(res, res.length - 16);
    }
    return res;
  }

  /**
   *
   * @param {Uint8Array<ArrayBuffer>} data
   * @returns {Uint8Array<ArrayBuffer>}
   */
  decrypt(data) {
    if (data.length < 16) throw Error("Data must be at least 16 bytes long");
    const res = new Uint8Array(data);
    // decrypt 16-byte chunk aligned to message end
    if (res.length > 16) {
      this.#decryptChunk(res, res.length - 16);
    }
    // decrypt 16-byte chunk aligned to message start
    this.#decryptChunk(res, 0);
    return res;
  }
}

/**
 * Implementation for encryption scheme used in the GAN Gen3 cubes
 */
export class GanGen3CubeEncrypter extends GanGen2CubeEncrypter {
  /** 101 its just the same */
}

/**
 * Implementation for encryption scheme used in the GAN Gen3 cubes
 */
export class GanGen4CubeEncrypter extends GanGen2CubeEncrypter {
  /** amazing, it's still the same */
}
