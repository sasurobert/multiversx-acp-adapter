import { RelayerService } from "../logic/relayer";
import { Mnemonic, UserSigner } from "@multiversx/sdk-wallet";
import { Transaction, Address, TransactionComputer } from "@multiversx/sdk-core";
import { config } from "../utils/config";

// --- LIVE DEMO Script ---
// Run with: TEST_MODE=false CHAIN_ID=D ts-node src/scripts/demo_relayer.ts

async function runLiveDemo() {
    console.log("🚀 Starting Live Relayer Demo...");

    // 1. Setup Relayer (Adapter)
    // In real life, RELAYER_SECRET_KEY is in env.
    if (!process.env.RELAYER_SECRET_KEY) {
        console.warn("⚠️  Missing RELAYER_SECRET_KEY. Generating ephemeral one (WILL FAIL ON BROADCAST if not funded)");
        const mne = Mnemonic.generate();
        process.env.RELAYER_SECRET_KEY = mne.deriveKey(0).hex();
    }

    // 2. Setup Agent (Sender) - Ephemeral
    const userMne = Mnemonic.generate();
    const userKey = userMne.deriveKey(0);
    const userAddress = userKey.generatePublicKey().toAddress();
    const userSigner = new UserSigner(userKey);

    console.log(`👤 Agent: ${userAddress.bech32()}`);
    console.log(`📡 Relayer: ${new Address(config.marketplace_address || "erd1...").toBech32()}`); // Config or derived

    // 3. Construct Transaction
    const coreUserAddress = new Address(userAddress.bech32());
    const innerTx = new Transaction({
        nonce: 1n,
        value: 0n, // 0 EGLD for safety
        receiver: coreUserAddress, // Send to self
        sender: coreUserAddress,
        gasLimit: 60000000n,
        chainID: config.chain_id,
        relayer: new Address(process.env.RELAYER_ADDRESS || config.marketplace_address || "erd1..."),
        data: Buffer.from("demo_relayed_tx")
    });

    // 4. Sign as Agent
    const computer = new TransactionComputer();
    innerTx.signature = await userSigner.sign(computer.computeBytesForSigning(innerTx));

    // 5. Pack Payload
    const payload = {
        sender: userAddress.bech32(),
        receiver: innerTx.receiver.toBech32(),
        nonce: Number(innerTx.nonce),
        value: innerTx.value.toString(),
        data: Buffer.from(innerTx.data).toString("base64"),
        signature: Buffer.from(innerTx.signature).toString("hex")
    };

    // 6. Broadcast via Relayer Service
    console.log("📦 Broadcasting via RelayerService...");
    try {
        const hash = await RelayerService.broadcastRelayed(payload);
        console.log(`✅ Success! Tx Hash: ${hash}`);
        console.log(`🔗 Explorer: https://devnet-explorer.multiversx.com/transactions/${hash}`);
    } catch (e) {
        console.error("❌ Broadcast failed (Example expected if Relayer not funded/synced):", e);
    }
}

runLiveDemo().catch(console.error);
