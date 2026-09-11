import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION });
  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("hex"), derivedKey.toString("hex")].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, blockSize, parallelization, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"), {
    N: Number(cost), r: Number(blockSize), p: Number(parallelization),
  });
  return timingSafeEqual(actual, expected);
}
