import { ethers } from "ethers";
import chalk from "chalk";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { delay, provider } from './skw/config.js';
import { rundaily } from './daily.js';
import { swapandsend } from './swap.js';
import { addWPHRSUSDC } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      await swapandsend(wallet);
      await delay(3000);

      await addWPHRSUSDC(wallet);
      await delay(3000);

      await rundaily(wallet);
      await delay(3000);

    } catch (err) {
      console.log(chalk.red(`❌ Gagal proses wallet ${wallet.address}: ${err.message}`));
    }
  }
}

async function main() {
  const date = new Date().toISOString().split('T')[0];
  cron.schedule('0 1 * * *', async () => { 
    await startBot();
    console.log();
    console.log(chalk.hex('#FF00FF')(`${date} Cron AKTIF`));
    console.log(chalk.hex('#FF1493')('Besok Jam 08:00 WIB Autobot Akan Run'));
  });

  await startBot();
  console.log();
  console.log(chalk.hex('#FF00FF')(`${date} Cron AKTIF`));
  console.log(chalk.hex('#FF1493')('Besok Jam 08:00 WIB Autobot Akan Run'));
}

main();
