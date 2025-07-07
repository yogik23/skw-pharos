import { ethers } from "ethers";
import cron from "node-cron"
import { logger } from "./skw/logger.js";
import { userAgents } from "./skw/userAgents.js";
import {
 provider,
 privateKeys,
 baseHeaders,
 delay,
 randomdelay,
 randomAmount,
} from "./skw/config.js";

import {
 PHRS_address,
 WPHRS_FAROSWAP,
 WPHRS_ZENITH,
 WETH_address,
 WBTC_address,
 USDC_address,
 USDT_address,
 oldUSDT_address,
 oldUSDC_address,
 ZENITH_ROUTER,
 ZENITH_ADDRESS,
 FAROSWAP_ADDRESS,
} from "./skw/contract.js";

import {
 sendcoin,
 approve,
 cekbalance,
 login,
 verifySendCoin,
 daily,
 deposit,
} from "./skw/helper.js";

import {
 swap,
 addLiquidity,
 increaseLiquidity,
 colectfee,
 removeLiquidity,
} from "./src/zenith.js";

import {
 swapFaroswap,
 swapERC20Faroswap,
 addLiquidityFaroswap,
} from "./src/faroswap.js";

import {
 deployToken,
 sendDeployToken,
} from "./src/deploy.js";

async function dailySendCoin(wallet) {
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const headers = {
    ...baseHeaders,
    "user-agent": userAgent,
  };

  try {
    const token = await login(wallet, headers);
    if (token) {
      await daily(token, headers, wallet);
      await verifySendCoin(token, headers, wallet);
    } else {
      logger.warn("Skip verifySendCoin karena token undefined");
    }
  } catch (err) {
    logger.fail("Gagal dailySendCoin: " + (err.message || err));
  }
}

async function swapzenith(wallet) {
  await deposit(wallet, WPHRS_ZENITH, "0.01");
  await delay(randomdelay());

  const amountWPHRStoUSDC = randomAmount(0.001, 0.007, 3);
  await swap(wallet, WPHRS_ZENITH, USDC_address, amountWPHRStoUSDC);
  await delay(randomdelay());

  const amountWPHRStoUSDT = randomAmount(0.001, 0.007, 3);
  await swap(wallet, WPHRS_ZENITH, USDT_address, amountWPHRStoUSDT);
  await delay(randomdelay());

  const amountUSDCtoUSDC = randomAmount(0.1, 0.4, 2);
  await swap(wallet, oldUSDC_address, USDC_address, amountUSDCtoUSDC);
  await delay(randomdelay());

  const amountUSDTtoUSDT = randomAmount(0.1, 0.4, 2);
  await swap(wallet, oldUSDT_address, USDT_address, amountUSDTtoUSDT);
  await delay(randomdelay());
}

async function LPzenith(wallet) {
  const fee = 3000;
  await addLiquidity(wallet, WPHRS_ZENITH, USDC_address, "0.001", fee);
  await delay(randomdelay());

  await increaseLiquidity(wallet, WPHRS_ZENITH, USDC_address, "0.001", fee);
  await delay(randomdelay());

  await colectfee(wallet);
  await delay(randomdelay());

  await removeLiquidity(wallet);
  await delay(randomdelay());
}

async function swapLPfaro(wallet) {
  await deposit(wallet, WPHRS_FAROSWAP, "0.1");
  await delay(randomdelay());

  await swapFaroswap(wallet, PHRS_address, USDT_address, "0.001");
  await delay(randomdelay());

  const amountWPHRStoUSDC = randomAmount(0.001, 0.007, 3);
  await swapERC20Faroswap(wallet, WPHRS_FAROSWAP, USDT_address, amountWPHRStoUSDC);
  await delay(randomdelay());

  const amountWPHRStoUSDT = randomAmount(0.001, 0.007, 3);
  await swapERC20Faroswap(wallet, WPHRS_FAROSWAP, USDC_address, amountWPHRStoUSDT);
  await delay(randomdelay());

  const amountUSDCtoUSDC = randomAmount(0.001, 0.001, 2);
  await addLiquidityFaroswap(wallet, WPHRS_FAROSWAP, USDC_address, amountUSDCtoUSDC);
  await delay(randomdelay());

  const amountUSDTtoUSDT = randomAmount(0.01, 0.1, 2);
  await addLiquidityFaroswap(wallet, USDT_address, WPHRS_FAROSWAP, amountUSDTtoUSDT);
  await delay(randomdelay());
}

async function startBot() {
  console.clear();
  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    logger.account(`Wallet: ${wallet.address}`);

    try {
      //await dailySendCoin(wallet);      
      //await swapzenith(wallet);
      //await LPzenith(wallet);
      await swapLPfaro(wallet);

      const result = await deployToken(wallet);
      if (result) {
        await sendDeployToken(result.tokencontract, wallet, result.symbol);
      }
      await delay(randomdelay());

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
