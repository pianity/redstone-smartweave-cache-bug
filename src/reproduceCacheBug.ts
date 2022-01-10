import { readFile, rm, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

import { readContract } from "smartweave";
import { Contract, LoggerFactory, SmartWeave, SmartWeaveNodeFactory } from "redstone-smartweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import Transaction from "arweave/node/lib/transaction";
import { v4 as uuid } from "uuid";

import { log, runEvery, sleep } from "@/utils";
import { arweave, SMARTWEAVE_CACHE_PATH } from "@/env";

LoggerFactory.INST.setOptions({
    type: "json",
    displayFilePath: "hidden",
    displayInstanceName: false,
    minLevel: "error",
});

// async function reInit() {
//     await rm(SMARTWEAVE_CACHE_PATH, { recursive: true, force: true });
//
//     smartweave = SmartWeaveNodeFactory.fileCached(arweave, SMARTWEAVE_CACHE_PATH, 5);
//     communityContract = smartweave.contract(PIANITY_COMMUNITY_CONTRACT);
//     pianityContract = smartweave.contract(PIANITY_CONTRACT);
//
//     await init();
// }

async function createInteractTx(
    contractId: string,
    input: { function: string },
    fromWallet: JWKInterface,
): Promise<Transaction> {
    const tx = await arweave.createTransaction(
        { data: Math.random().toString().slice(4) },
        fromWallet,
    );

    tx.addTag("Exchange", "Pianity");
    tx.addTag("Type", input.function);
    tx.addTag("App-Name", "SmartWeaveAction");
    tx.addTag("App-Version", "0.3.0");
    tx.addTag("Contract", contractId);
    tx.addTag("Input", JSON.stringify(input));
    tx.addTag("Unix-Time", `${Date.now()}`);

    await arweave.transactions.sign(tx, fromWallet);

    return tx;
}

async function sendPTY(
    contract: Contract,
    fromWallet: JWKInterface,
    fromAddress: string,
    qty: number,
    target: string,
) {
    const input = {
        function: "transfer",
        target,
        qty,
    };

    // eslint-disable-next-line
    while (true) {
        try {
            const result = await contract.dryWrite(input, fromAddress);

            const tx = await createInteractTx(contract.txId(), input, fromWallet);

            if (result.type !== "ok") {
                throw new Error("CONTRACT ERROR");
            } else {
                // pianityContract.connect(fromWallet);
                // await pianityContract.writeInteraction(input);
                await arweave.transactions.post(tx);
            }

            break;
        } catch (rawErr) {
            log("FAILED TRANSACTION, WAITING 3s");
            console.log(rawErr);
            await sleep(3);
        }
    }
}

// async function getBalance(contract: Contract, address: string) {
//     const state = (await contract.readState()).state as any;
//     return state.tokens.PTY.balances[address];
// }
//
// async function getBalanceCleanSmartweave(address: string) {
//     const cachePath = ".smartweave-cache-extra";
//     await rm(cachePath, { recursive: true, force: true });
//
//     const smartweave = SmartWeaveNodeFactory.fileCached(arweave, cachePath, 5);
//     const pianityContract = smartweave.contract(PIANITY_CONTRACT);
//
//     const state = (await pianityContract.readState()).state as any;
//     return state.tokens.PTY.balances[address];
// }

export async function feedUser(
    contract: Contract,
    apiWallet: JWKInterface,
    apiAddress: string,
    userAddress: string,
    amount: number,
) {
    const maxConcurrentTx = 10;
    const maxTx = amount;
    let executedTx = 0;

    type Task = { id: string; promise: Promise<void> };

    const queue: Task[] = [];
    while (executedTx < maxTx) {
        // eslint-disable-next-line
        const newTxCount = (() => {
            const count = maxConcurrentTx - queue.length;
            return count + Math.min(maxTx - (count + queue.length + executedTx), 0);
        })();

        for (let i = 0; i < newTxCount; i++) {
            const id = uuid();

            log(`${id}: running`);

            // eslint-disable-next-line
            const promise = sendPTY(contract, apiWallet, apiAddress, 1, userAddress).then(() => {
                log(`${id}: finished`);
                executedTx += 1;
                const index = queue.findIndex(({ id: taskId }) => taskId === id);
                queue.splice(index, 1);
            });

            queue.push({ id, promise });
        }

        await Promise.race(queue.map(({ promise }) => promise));

        log(`${executedTx} / ${maxTx}`);
    }
}

// (async () => {
//     await init();
//
//     // console.log("reading states!");
//     const state = await pianityContract.readState();
//     console.log(state.validity);
//     console.log("pianity!", (state.state as any).tokens.PTY.balances);
//     // await communityContract.readState();
//     // console.log("community!");
//
//     // const [user1Wallet, user1Address] = await getUserWallet("random-user1");
//     // const [user2Wallet, user2Address] = await getUserWallet("random-user2");
//     const [pianityWallet, pianityAddress] = await getUserWallet("pianity-api");
//
//     const user1Address = await arweave.wallets.jwkToAddress(await arweave.wallets.generate());
//
//     const oldBalance = await getBalance(user1Address);
//
//     // const pianityWallet = JSON.parse(
//     //     (await readFile("~/home/Wallets/pianity-dev.json")).toString(),
//     // ) as JWKInterface;
//     // const pianityAddress = await arweave.wallets.jwkToAddress(pianityWallet);
//
//     const maxConcurrentTx = 10;
//     const maxTx = 100;
//     let executedTx = 0;
//
//     type Task = { id: string; promise: Promise<void> };
//
//     const queue: Task[] = [];
//     while (executedTx < maxTx) {
//         // eslint-disable-next-line
//         const newTxCount = (() => {
//             const count = maxConcurrentTx - queue.length;
//             return count + Math.min(maxTx - (count + queue.length + executedTx), 0);
//         })();
//
//         // const test = ;
//
//         // if (newTxCount + queue.length +
//
//         // const newTxCount = Math.min(maxTx - (executedTx + queue.length), maxConcurrentTx);
//
//         for (let i = 0; i < newTxCount; i++) {
//             const id = uuid();
//
//             log(`${id}: running`);
//
//             // eslint-disable-next-line
//             const promise = sendPTY(pianityWallet, pianityAddress, 1, user1Address).then(() => {
//                 log(`${id}: finished`);
//                 executedTx += 1;
//                 const index = queue.findIndex(({ id: taskId }) => taskId === id);
//                 queue.splice(index, 1);
//             });
//
//             queue.push({ id, promise });
//         }
//
//         await Promise.race(queue.map(({ promise }) => promise));
//
//         log(`${executedTx} / ${maxTx}`);
//     }
//
//     const state2 = await readContract(arweave, PIANITY_CONTRACT);
//     console.log("OLD SMARTWEAVE", state2.tokens.PTY.balances);
//
//     log(`target address ${user1Address}`);
//
//     log("Waiting 60s for confirmations");
//
//     await sleep(60);
//
//     getBalanceCleanSmartweave(user1Address).then((balance) => {
//         log(`clean balance: ${balance}`);
//     });
//
//     log(`old balance: ${oldBalance}`);
//     log(`new cached balance: ${await getBalance(user1Address)}`);
//     log(`expected balance: ${maxTx}`);
//
//     // log("clearing cache and reinitializing smartweave");
//     // await reInit();
//     // console.log(((await pianityContract.readState()).state as any).tokens.PTY.balances);
// })();
