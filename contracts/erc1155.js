const PST = "PTY";
const UNITY = 1e6;
const ERR_404TOKENID = "No token found: Invalid tokenId";
const ERR_NOTOKENID = "No tokenId specified";
const ERR_NOQTY = "No qty specified";
const ERR_NOTARGET = "No target specified";
const ERR_NOROYALTIES = "No royalties specified";
const ERR_NOFROM = "No sender specified";
const ERR_INVALID = "Invalid token transfer";
const ERR_INTEGER = "Invalid value. Must be an integer";
function tickerOf(state, tokenId) {
    const token = state.tokens[tokenId];
    ContractAssert(token, ERR_404TOKENID);
    const { ticker } = token;
    return ticker;
}
function balanceOf(state, tokenId, target) {
    const token = state.tokens[tokenId];
    ContractAssert(token, ERR_404TOKENID);
    return token.balances[target] ?? 0;
}
function royaltiesOf(state, tokenId, target) {
    const token = state.tokens[tokenId];
    ContractAssert(token, ERR_404TOKENID);
    return token.royalties?.[target] ?? 0;
}
function checkRoyalties(royalties) {
    const sum = Object.values(royalties).reduce((acc, val) => {
        ContractAssert(Number.isInteger(val), `${ERR_INTEGER} {royalties}`);
        ContractAssert(val > 0, "Royalties must be strictly positive");
        return acc + val;
    }, 0);
    ContractAssert(sum === UNITY, `Sum of royalties shares must be ${UNITY}`);
}
function mintToken(state, tokenId, royalties, qty, no) {
    ContractAssert(!(tokenId in state.tokens), `tokenId already exists: "${tokenId}".`);
    if (royalties)
        checkRoyalties(royalties);
    const token = {
        ticker: `${PST}${state.nonce}`,
        royalties,
        owners: undefined,
        balances: {},
    };
    state.nonce++;
    state.tokens[tokenId] = token;
    if (no) {
        ContractAssert(Number.isInteger(no), ERR_INTEGER);
        token.owners = Array(no).fill("");
        addTokenTo(state, "", tokenId, no);
    }
    else if (qty) {
        addTokenTo(state, "", tokenId, qty);
    }
}
function transfer(state, caller, from, target, tokenId, qty, no, price) {
    ContractAssert(from !== target, ERR_INVALID);
    const token = state.tokens[tokenId];
    ContractAssert(token, ERR_404TOKENID);
    ContractAssert(!token.owners || (no && !qty), "no. must be set and qty unset for NFTs");
    ContractAssert(token.owners || (!no && qty), "qty must be set and no unset for tokens");
    ContractAssert(isApprovedOrOwner(state, caller, from), "Sender is not approved nor the owner of the token");
    if (token.royalties) {
        const { contractOwners } = state.settings;
        ContractAssert(state.settings.allowFreeTransfer || contractOwners.includes(caller), "Free transfers not allowed");
        ContractAssert(!price || isApprovedForAll(state, caller, target), "Receiver is not approved");
        removeTokenFrom(state, target, PST, price || 0);
        pay(state, token, from, price || 0);
    }
    removeTokenFrom(state, from, tokenId, qty || 1, no);
    addTokenTo(state, target, tokenId, qty || 1, no);
}
function addRoyaltiesTo(token, target, qty) {
    ContractAssert(token.royalties, ERR_NOROYALTIES);
    if (!(target in token.royalties)) {
        token.royalties[target] = 0;
    }
    token.royalties[target] += qty;
}
function removeRoyaltiesFrom(token, from, qty) {
    ContractAssert(token.royalties, ERR_NOROYALTIES);
    ContractAssert(Number.isInteger(qty), `${ERR_INTEGER} {royalties}`);
    const fromRoyalties = token.royalties[from] || 0;
    ContractAssert(fromRoyalties > 0, "Sender does not own royalties on the token");
    ContractAssert(fromRoyalties >= qty, "Insufficient royalties' balance");
    const newBalance = token.royalties[from] - qty;
    if (newBalance === 0) {
        delete token.royalties[from];
    }
    else {
        token.royalties[from] = newBalance;
    }
}
function pay(state, token, from, price) {
    ContractAssert(token.royalties, ERR_NOROYALTIES);
    ContractAssert(Number.isInteger(price), ERR_INTEGER);
    ContractAssert(price >= 0, "Invalid value for price. Must be positive");
    if (price === 0) {
        return;
    }
    if (from.length === 0) {
        addTokenTo(state, state.settings.communityChest, PST, price * state.settings.primaryRate);
        for (const [target, split] of Object.entries(token.royalties)) {
            addTokenTo(state, target, PST, price * (1 - state.settings.primaryRate) * split / UNITY);
        }
    }
    else {
        const netValue = price * (1 - state.settings.secondaryRate - state.settings.royaltyRate);
        addTokenTo(state, from, PST, netValue);
        addTokenTo(state, state.settings.communityChest, PST, price * state.settings.secondaryRate);
        for (const [target, split] of Object.entries(token.royalties)) {
            addTokenTo(state, target, PST, price * state.settings.royaltyRate * split / UNITY);
        }
    }
}
function addTokenTo(state, target, tokenId, qty, no) {
    ContractAssert(Number.isInteger(qty), ERR_INTEGER);
    ContractAssert(qty >= 0, "Invalid value for qty. Must be positive");
    if (qty === 0)
        return;
    const token = state.tokens[tokenId];
    ContractAssert(token, "tokenId does not exist");
    if (!(target in token.balances)) {
        token.balances[target] = 0;
    }
    token.balances[target] += qty;
    if (token.owners && no) {
        ContractAssert(Number.isInteger(no), ERR_INTEGER);
        ContractAssert(no > 0, "Invalid value for no. Must be strictly positive");
        ContractAssert(qty === 1, "Amount must be 1 for NFTs");
        ContractAssert(token.owners[no - 1] === "", "Token no. is already attributed");
        token.owners[no - 1] = target;
    }
}
function removeTokenFrom(state, from, tokenId, qty, no) {
    const fromBalance = balanceOf(state, tokenId, from);
    ContractAssert(fromBalance > 0, "Sender does not own the token");
    ContractAssert(qty >= 0, "Invalid value for qty. Must be positive");
    ContractAssert(fromBalance >= qty, "Insufficient balance");
    if (qty === 0)
        return;
    const token = state.tokens[tokenId];
    const newBalance = token.balances[from] - qty;
    if (token.owners) {
        ContractAssert(no, "No no. specified");
        ContractAssert(Number.isInteger(no), ERR_INTEGER);
        ContractAssert(no > 0, "Invalid value for no. M(ust be strictly positive");
        ContractAssert(qty === 1, "Amount must be 1 for NFTs");
        ContractAssert(token.owners[no - 1] === from, "Token no. is not owned by caller");
        token.owners[no - 1] = "";
    }
    if (newBalance === 0) {
        delete token.balances[from];
    }
    else {
        token.balances[from] = newBalance;
    }
}
function ownersOf(state, tokenId) {
    const token = state.tokens[tokenId];
    ContractAssert(token, ERR_404TOKENID);
    return Object.keys(token.balances);
}
function isApprovedForAll(state, caller, target) {
    if (target.length === 0 && state.settings.contractOwners.includes(caller)) {
        return true;
    }
    if (!(target in state.operatorApprovals))
        return false;
    if (!(caller in state.operatorApprovals[target]))
        return false;
    return state.operatorApprovals[target][caller];
}
function isApprovedOrOwner(state, caller, target) {
    if (caller === target) {
        return true;
    }
    return isApprovedForAll(state, caller, target);
}
export async function handle(state, action) {
    const { input } = action;
    const { caller } = action;
    const { paused } = state.settings;
    const { contractOwners } = state.settings;
    const { contractSuperOwners } = state.settings;
    if (input.function === "name") {
        return { result: { name: "Pianity" } };
    }
    if (input.function === "ticker") {
        const tokenId = input.tokenId || PST;
        const ticker = tickerOf(state, tokenId);
        return { result: { ticker } };
    }
    if (input.function === "balance") {
        const target = input.target || caller;
        const tokenId = input.tokenId || PST;
        const balance = balanceOf(state, tokenId, target);
        return { result: { target, balance } };
    }
    if (input.function === "royalties") {
        const { target } = input;
        const { tokenId } = input;
        ContractAssert(tokenId, ERR_NOTOKENID);
        ContractAssert(target, ERR_NOTARGET);
        const royalties = royaltiesOf(state, tokenId, target);
        return { result: { royalties } };
    }
    if (input.function === "owner" || input.function === "owners") {
        const { tokenId } = input;
        ContractAssert(tokenId, ERR_NOTOKENID);
        const owners = ownersOf(state, tokenId);
        return { result: { owners } };
    }
    if (input.function === "isApprovedForAll") {
        const { target } = input;
        const { owner } = input;
        ContractAssert(owner, "No owner specified");
        ContractAssert(target, ERR_NOTARGET);
        const approved = isApprovedForAll(state, owner, target);
        return { result: { approved } };
    }
    ContractAssert(!paused || contractSuperOwners.includes(caller), "The contract must not be paused");
    if (input.function === "setApprovalForAll") {
        const { approved } = input;
        const { target } = input;
        ContractAssert(target, ERR_NOTARGET);
        ContractAssert(typeof approved !== "undefined", "No approved parameter specified");
        ContractAssert(target !== caller, "Target must be different from the caller");
        if (!(caller in state.operatorApprovals)) {
            state.operatorApprovals[caller] = {};
        }
        state.operatorApprovals[caller][target] = approved;
        return { state };
    }
    if (input.function === "transfer") {
        const { target } = input;
        const from = typeof input.from === "undefined" ? caller : input.from;
        const tokenId = input.tokenId || PST;
        const { qty } = input;
        const { price } = input;
        const { no } = input;
        ContractAssert(target, ERR_NOTARGET);
        transfer(state, caller, from, target, tokenId, qty, no, price);
        return { state };
    }
    if (input.function === "transferBatch") {
        const { targets } = input;
        const { froms } = input;
        const { tokenIds } = input;
        const { qtys } = input;
        const { prices } = input;
        const { nos } = input;
        ContractAssert(froms, ERR_NOFROM);
        ContractAssert(tokenIds, ERR_NOTOKENID);
        ContractAssert(targets, ERR_NOTARGET);
        ContractAssert(tokenIds.length === froms.length, "tokenIds and froms length mismatch");
        ContractAssert(tokenIds.length === targets.length, "tokenIds and targets length mismatch");
        ContractAssert(qtys || nos, "At least one of qtys or nos must be set");
        ContractAssert(!qtys || tokenIds.length === qtys.length, "tokenIds and qtys length mismatch");
        ContractAssert(!nos || tokenIds.length === nos.length, "tokenIds and qtys length mismatch");
        for (const i in tokenIds) {
            const from = typeof froms[i] === "undefined" ? caller : froms[i];
            const no = nos ? nos[i] : undefined;
            const qty = qtys ? qtys[i] : undefined;
            const price = prices ? prices[i] : undefined;
            ContractAssert(targets[i], ERR_NOTARGET);
            transfer(state, caller, from, targets[i], tokenIds[i], qty, no, price);
        }
        return { state };
    }
    if (input.function === "transferRoyalties") {
        const { target } = input;
        const { tokenId } = input;
        const { qty } = input;
        ContractAssert(target, ERR_NOTARGET);
        ContractAssert(qty, ERR_NOQTY);
        ContractAssert(target !== caller, "Target must be different from the caller");
        ContractAssert(tokenId, ERR_NOTOKENID);
        ContractAssert(qty > 0, "Invalid value for qty. Must be positive");
        const token = state.tokens[tokenId];
        ContractAssert(token, "tokenId does not exist");
        ContractAssert(token.royalties, "Royalties are not set for this token");
        removeRoyaltiesFrom(token, caller, qty);
        addRoyaltiesTo(token, target, qty);
        checkRoyalties(token.royalties);
        return { state };
    }
    if (input.function === "foreignInvoke") {
        const { target } = input;
        const { invocationId } = input;
        ContractAssert(contractOwners.includes(caller), "Caller is not authorized to foreignInvoke");
        ContractAssert(target, ERR_NOTARGET);
        ContractAssert(typeof invocationId !== "undefined", "No invocationId specified");
        ContractAssert(state.settings.foreignContracts, "No foreignContracts specified");
        ContractAssert(state.settings.foreignContracts.includes(target), "Invalid auction contract");
        const foreignState = await SmartWeave.contracts.readContractState(target);
        ContractAssert(foreignState.foreignCalls, "Contract is missing support for foreign calls");
        const invocation = foreignState.foreignCalls[invocationId];
        ContractAssert(invocation, `Incorrect invocationId: invocation not found (${invocationId})`);
        ContractAssert(!state.invocations.includes(target + invocationId), `Invocation already exists (${invocation})`);
        state.invocations.push(target + invocationId);
        const foreignAction = action;
        foreignAction.input = invocation;
        return handle(state, foreignAction);
    }
    if (input.function === "mint") {
        const tokenId = SmartWeave.transaction.id;
        const { royalties } = input;
        const { qty } = input;
        const { no } = input;
        ContractAssert(contractOwners.includes(caller), "Caller is not authorized to mint");
        ContractAssert(tokenId, ERR_NOTOKENID);
        ContractAssert((qty && !no) || (!qty && no), "qty and no can't be set simultaneously");
        mintToken(state, tokenId, royalties, qty, no);
        return { state };
    }
    if (input.function === "settings") {
        const { settings } = input;
        const { contractSuperOwners } = state.settings;
        ContractAssert(settings, "No settings specified");
        const keys = Object.keys(settings);
        if (!contractSuperOwners.includes(caller)) {
            ContractAssert(contractOwners.includes(caller), "Caller is not authorized to edit contract settings");
            ContractAssert(!keys.includes("contractOwners"), "Caller is not Super Owner");
            ContractAssert(!keys.includes("contractSuperOwners"), "Caller is not Super Owner");
        }
        for (const key in settings) {
            if (state.settings.hasOwnProperty(key)) {
                state.settings[key] = settings[key];
            }
        }
        ContractAssert(state.settings.contractSuperOwners.length > 0, "Can't delete all the Super Owners");
        return { state };
    }
    throw new ContractError(`No function supplied or function not recognised: "${input.function}".`);
}
