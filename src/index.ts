/**
 *
 * ## Penumbra
 * A file decryption library for the browser
 *
 * @module penumbra
 */

// exports
import penumbra from './API';

export * from './types';
export { default as decryptStream } from './decryptStream';
export { default as downloadEncryptedFile } from './downloadEncryptedFile';
export { default as fetchAndDecrypt } from './fetchAndDecrypt';
export { default as fetchMany, preconnect, preload } from './fetchMany';
export { default as getDecryptedContent } from './getDecryptedContent';
export { default as setWorkerLocation } from './workers';

export default penumbra;
