import { ethers } from "ethers";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { delay } from './skw/config.js';
import { rundaily } from './daily.js';
import { swapandsend } from './swap.js';
import { addWPHRSUSDC } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = "https://testnet.dplabs-internal.com";
const provider = new ethers.JsonRpcProvider(RPC);

const privateKeys = fs.readFileSync(path.join(__dirname, "privatekey.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

async function startBot() {
  console.clear();
  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    console.log(chalk.hex('#9370DB')(`\n🔑 Wallet: ${wallet.address}`));

    try {
      await rundaily(wallet);
      await delay(3000);

      await swapandsend(wallet);
      await delay(3000);

      await addWPHRSUSDC(wallet);


    } catch (err) {
      console.log(chalk.red(`❌ Gagal proses wallet ${wallet.address}: ${err.message}`));
    }

    await delay(5000);
  }
}

startBot();
