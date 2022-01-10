import { join } from "node:path";
import { readFileSync } from "node:fs";

import Arweave from "arweave";

function env(envVar: string, fallback?: string): string | null {
    return process.env[envVar] || fallback || null;
}

function envRequired(envVar: string, fallback?: string): string {
    if (!process.env[envVar]) {
        if (fallback === undefined) {
            throw new Error(`Missing ${envVar} in env`);
        }
        return fallback;
    }
    return process.env[envVar] as string;
}

export const ARWEAVE_HOST = "localhost";
export const ARWEAVE_PORT = 1984;
export const ARWEAVE_PROTOCOL = "http";

export const ARLOCAL_URL = `${ARWEAVE_PROTOCOL}://${ARWEAVE_HOST}:${ARWEAVE_PORT}`;
export const ARLOCALDB_PATH = "./arlocaldb";
export const CONTRACT_INFOS_PATH = join(ARLOCALDB_PATH, "contractInfos.json");

export const SMARTWEAVE_CACHE_PATH = "./smartweave-cache";

export const arweave = Arweave.init({
    host: ARWEAVE_HOST,
    port: ARWEAVE_PORT,
    protocol: ARWEAVE_PROTOCOL,
    timeout: 20000,
    logging: false,
});
