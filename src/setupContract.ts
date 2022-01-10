import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import got from "got";
import Arlocal from "arlocal";
import { JWKInterface } from "arweave/node/lib/wallet";

import { ARLOCAL_URL, arweave, ARWEAVE_PORT } from "@/env";
import { createWallet, runEvery } from "@/utils";

async function uploadContract(wallet: JWKInterface, contractContent: string, initialState: string) {
    const contractSourceTx = await arweave.createTransaction({ data: contractContent }, wallet);
    contractSourceTx.addTag("App-Name", "SmartWeaveContractSource");
    contractSourceTx.addTag("App-Version", "0.3.0");
    contractSourceTx.addTag("Content-Type", "application/javascript");

    // Sign
    await arweave.transactions.sign(contractSourceTx, wallet);
    // Let's keep the ID, it will be used in the state transaction.
    const contractSourceTxId = contractSourceTx.id;
    // Deploy the contract source
    await arweave.transactions.post(contractSourceTx);

    // Now, let's create the Initial State transaction
    const contractTx = await arweave.createTransaction({ data: initialState }, wallet);
    contractTx.addTag("App-Name", "SmartWeaveContract");
    contractTx.addTag("App-Version", "0.3.0");
    contractTx.addTag("Contract-Src", contractSourceTxId);
    contractTx.addTag("Content-Type", "application/json");

    // Sign
    await arweave.transactions.sign(contractTx, wallet);
    const contractTxId = contractTx.id;
    // Deploy
    await arweave.transactions.post(contractTx);

    return contractTxId;
}

async function createErc1155(pianityApiWallet: JWKInterface, pianityApiAddress: string) {
    const [superOwnerWallet, superOwnerAddress] = await createWallet("9999");
    const [communityChestWallet, communityChestAddress] = await createWallet("9999");

    const erc1155InitState = JSON.stringify(
        {
            name: "Pianity",
            nonce: 1,
            settings: {
                contractOwners: [pianityApiAddress],
                contractSuperOwners: [superOwnerAddress],
                communityChest: communityChestAddress,
                foreignContracts: [],
                allowFreeTransfer: false,
                primaryRate: 0.15,
                secondaryRate: 0.1,
                royaltyRate: 0.1,
                paused: false,
            },
            tokens: {
                PTY: {
                    ticker: "PTY",
                    balances: {
                        [superOwnerAddress]: 900000000000000,
                        [pianityApiAddress]: 100000000000000,
                    },
                },
            },
            operatorApprovals: {},
            invocations: [],
        },
        null,
        2,
    );

    const erc1155Id = await uploadContract(
        pianityApiWallet,
        readFileSync("./contracts/erc1155.js", "utf-8"),
        erc1155InitState,
    );

    return erc1155Id;
}

export type ContractInfos = {
    apiWallet: JWKInterface;
    apiAddress: string;
    contractId: string;
};

export async function setupContract(): Promise<ContractInfos> {
    const [apiWallet, apiAddress] = await createWallet("9999");
    const contractId = await createErc1155(apiWallet, apiAddress);

    return { apiWallet, apiAddress, contractId };
}
