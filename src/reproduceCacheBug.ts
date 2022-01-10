import { Contract, LoggerFactory } from "redstone-smartweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import Transaction from "arweave/node/lib/transaction";
import { v4 as uuid } from "uuid";

import { log, sleep } from "@/utils";
import { arweave } from "@/env";

LoggerFactory.INST.setOptions({
    type: "json",
    displayFilePath: "hidden",
    displayInstanceName: false,
    minLevel: "error",
});

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
                // contract.connect(fromWallet);
                // await contract.writeInteraction(input);
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
