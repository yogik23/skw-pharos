import { ethers } from "ethers";
import cron from "node-cron"
import { logger } from "./skw/logger.js";
import { displayskw } from "./skw/displayskw.js";
import { R2pharos } from "./src/r2.js";
import { OpenFi } from "./src/OpenFi.js";
import { sendtoX } from "./src/sendtoX.js";
import {
 provider,
 privateKeys,
 baseHeaders,
 delay,
 randomdelay,
 randomAmount,
} from "./skw/config.js";

import {
 login,
 getProfil,
 daily,
} from "./src/daily.js";

async function dailylogin(wallet) {
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const headers = {
    ...baseHeaders,
    "user-agent": userAgent,
  };

  try {
    const token = await login(wallet, headers);
    if (token) {
      const { totalPoint } = await getProfil(token, headers, wallet);
      await daily(token, headers, wallet);
    } else {
      logger.warn("Skip dailylogin karena token undefined");
    }
  } catch (err) {
    logger.fail(`Gagal dailylogin: ${err.reason || err.message || 'unknown error'}\n`);
  }
}

async function startBot() {
  displayskw();
  await delay(6000);
  console.clear();
  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    logger.account(`Wallet: ${wallet.address}`);

    try {
      const totalPoint = await dailySendCoin(wallet);
      await sendtoX(wallet);
      await R2pharos(wallet);
      await OpenFi(wallet);
      await delay(randomdelay());

      const txCount = await provider.getTransactionCount(wallet.address);
      logger.account(`Totaltx ${wallet.address} ->>: ${txCount}`);
      await sendTG(wallet.address, txCount, totalPoint);

    } catch (err) {
      logger.fail(`Gagal proses wallet ${wallet.address}: ${err.message}\n`);
    }
  }
}

async function main() {
  cron.schedule('0 1 * * *', async () => {
    const date = new Date().toISOString().split('T')[0];
    await startBot();
    console.log();
    logger.info(`${date} Cron AKTIF`);
    logger.info('Besok Jam 08:00 WIB Autobot Akan Run');
  });

  const today = new Date().toISOString().split('T')[0];
  await startBot();
  console.log();
  logger.info(`${today} Cron AKTIF`);
  logger.info('Besok Jam 08:00 WIB Autobot Akan Run');
}

main();
