import { join } from "node:path";

import Arweave from "arweave";

export const ARWEAVE_HOST = "localhost";
export const ARWEAVE_PORT = 1984;
export const ARWEAVE_PROTOCOL = "http";

export const ARLOCAL_URL = `${ARWEAVE_PROTOCOL}://${ARWEAVE_HOST}:${ARWEAVE_PORT}`;
export const ARLOCALDB_PATH = "./arlocaldb";
export const CONTRACT_INFOS_PATH = join(ARLOCALDB_PATH, "contractInfos.json");

export const arweave = Arweave.init({
    host: ARWEAVE_HOST,
    port: ARWEAVE_PORT,
    protocol: ARWEAVE_PROTOCOL,
    timeout: 20000,
    logging: false,
});
