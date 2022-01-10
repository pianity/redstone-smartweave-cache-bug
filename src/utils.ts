import { access } from "node:fs/promises";

import got from "got";
import { JWKInterface } from "arweave/node/lib/wallet";

import { ARLOCAL_URL, arweave } from "@/env";

export async function createWallet(initialAr = "0"): Promise<[JWKInterface, string]> {
    const wallet = await arweave.wallets.generate();
    const address = await arweave.wallets.getAddress(wallet);
    const winstonAmount = arweave.ar.arToWinston(initialAr);

    await got.get(`${ARLOCAL_URL}/mint/${address}/${winstonAmount}`);
    return [wallet, address];
}

export async function fileExists(path: string) {
    try {
        await access(path);

        return true;
    } catch {
        return false;
    }
}

export function log(message: string) {
    const now = new Date();

    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ml = String(now.getMilliseconds()).padStart(3, "0");

    console.log(`[${h}:${m}:${s}:${ml}] ${message}`);
}

export function sleep(seconds: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

export async function runEvery(
    callback: (...args: any[]) => Promise<unknown>,
    intervalSeconds: number,
    awaitCallback = true,
) {
    while (true) {
        if (awaitCallback) {
            try {
                await callback();
            } catch (error) {
                console.log(`Warning: something went wrong in "${callback.name}":`, error);
            }
        } else {
            callback().catch((error) =>
                console.log(`Warning: something went wrong in "${callback.name}":`, error),
            );
        }

        await sleep(intervalSeconds);
    }
}

export function formatSize(bytes: number, decimals = 2) {
    if (bytes === 0) return "0 B";

    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function exhaustive(_: never): never {
    throw new Error("Check wasn't exhaustive");
}
