/**
 * Implementation for encryption scheme used in the GAN Gen2 Smart Cubes
 */
export class GanGen2CubeEncrypter {
  /** @type {Promise<CryptoKey>} */
  #keyPromise;

  /** @type {AesCbcParams} */
  #params;

  /**
   *
   * @param {Uint8Array} key
   * @param {Uint8Array} iv
   * @param {Uint8Array} salt
   */
  constructor(key, iv, salt) {
    if (key.length != 16)
      throw new Error("Key must be 16 bytes (128-bit) long");
    if (iv.length != 16) throw new Error("Iv must be 16 bytes (128-bit) long");
    if (salt.length != 6) throw new Error("Salt must be 6 bytes (48-bit) long");
    // Apply salt to key and iv
    const _key = new Uint8Array(key);
    const _iv = new Uint8Array(iv);
    for (let i = 0; i < 6; i++) {
      _key[i] = (key[i] + salt[i]) % 0xff;
      _iv[i] = (iv[i] + salt[i]) % 0xff;
    }
    this.#params = {
      name: "AES-CBC",
      iv: _iv.buffer,
    };
    this.#keyPromise = crypto.subtle.importKey(
      "raw",
      _key.buffer,
      {
        name: "AES-CBC",
      },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt 16-byte buffer chunk starting at offset using AES-128-CBC
   * @param {Uint8Array<ArrayBuffer>} buffer
   * @param {number} offset
   * @returns {Promise<void>}
   * */
  async #encryptChunk(buffer, offset) {
    // const cipher = new ModeOfOperation.cbc(this.#key, this.#iv);
    const key = await this.#keyPromise;
    const chunk = await crypto.subtle.encrypt(
      this.#params,
      key,
      buffer.subarray(offset, offset + 16).buffer,
    );

    console.log({ buffer, chunk, offset });

    buffer.set(new Uint8Array(chunk), offset);
  }

  /**
   * Decrypt 16-byte buffer chunk starting at offset using AES-128-CBC
   * @param {Uint8Array<ArrayBuffer>} buffer
   * @param {number} offset
   * @returns {Promise<void>}
   */
  async #decryptChunk(buffer, offset) {
    const key = await this.#keyPromise;
    const chunk = await crypto.subtle.decrypt(
      this.#params,
      key,
      buffer.subarray(offset, offset + 16).buffer,
    );
    buffer.set(new Uint8Array(chunk), offset);
  }

  /**
   *
   * @param {Uint8Array} data
   * @returns {Promise<Uint8Array>}
   */
  async encrypt(data) {
    if (data.length < 16) throw Error("Data must be at least 16 bytes long");
    const res = new Uint8Array(data);
    // encrypt 16-byte chunk aligned to message start
    await this.#encryptChunk(res, 0);
    // encrypt 16-byte chunk aligned to message end
    if (res.length > 16) {
      await this.#encryptChunk(res, res.length - 16);
    }
    return res;
  }

  /**
   *
   * @param {Uint8Array} data
   * @returns {Promise<Uint8Array>}
   */
  async decrypt(data) {
    if (data.length < 16) throw Error("Data must be at least 16 bytes long");
    const res = new Uint8Array(data);
    // decrypt 16-byte chunk aligned to message end
    if (res.length > 16) {
      await this.#decryptChunk(res, res.length - 16);
    }
    // decrypt 16-byte chunk aligned to message start
    await this.#decryptChunk(res, 0);
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
