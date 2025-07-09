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
 deposit,
 sendTG,
} from "./skw/helper.js";

import {
 login,
 getProfil,
 daily,
 verifySendCoin,
} from "./src/zenith.js";

import {
 swap,
 addLiquidity,
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
      const { totalPoint } = await getProfil(token, headers, wallet);
      await daily(token, headers, wallet);
      await verifySendCoin(token, headers, wallet);
      return totalPoint;
    } else {
      logger.warn("Skip verifySendCoin karena token undefined");
    }
  } catch (err) {
    logger.fail(`Gagal dailySendCoin: ${err.reason || err.message || 'unknown error'}\n`);
  }

  return 0;
}

async function swapzenith(wallet) {
  const amountdeposit = randomAmount(0.01, 0.05, 2);
  const amountWPHRS = randomAmount(0.001, 0.007, 3);
  const amountUSDTUSDC = randomAmount(0.01, 0.4, 2);

  await deposit(wallet, WPHRS_ZENITH, amountdeposit);
  await delay(randomdelay());

  await swap(wallet, WPHRS_ZENITH, USDC_address, amountWPHRS);
  await delay(randomdelay());

  await swap(wallet, WPHRS_ZENITH, USDT_address, amountWPHRS);
  await delay(randomdelay());

  await swap(wallet, USDT_address, USDC_address, amountUSDTUSDC);
  await delay(randomdelay());

  await swap(wallet, USDC_address, USDT_address, amountUSDTUSDC);
  await delay(randomdelay());
}

async function LPzenith(wallet) {
  const fee = 3000;
  const amountWPHRS = randomAmount(0.001, 0.005, 3);

  await addLiquidity(wallet, WPHRS_ZENITH, USDC_address, amountWPHRS, fee);
  await delay(randomdelay());

  await addLiquidity(wallet, WPHRS_ZENITH, USDT_address, amountWPHRS, fee);
  await delay(randomdelay());

  await colectfee(wallet);
  await delay(randomdelay());

  await removeLiquidity(wallet);
  await delay(randomdelay());
}

async function swapLPfaro(wallet) {
  const amountdeposit = randomAmount(0.01, 0.05, 2);
  const amountWPHRS = randomAmount(0.001, 0.005, 3);

  await deposit(wallet, WPHRS_FAROSWAP, amountdeposit);
  await delay(randomdelay());

  await swapFaroswap(wallet, PHRS_address, USDT_address, amountWPHRS);
  await delay(randomdelay());

  await swapFaroswap(wallet, PHRS_address, USDC_address, amountWPHRS);
  await delay(randomdelay());

  await swapERC20Faroswap(wallet, WPHRS_FAROSWAP, USDT_address, amountWPHRS);
  await delay(randomdelay());

  await swapERC20Faroswap(wallet, WPHRS_FAROSWAP, USDC_address, amountWPHRS);
  await delay(randomdelay());

  await addLiquidityFaroswap(wallet, WPHRS_FAROSWAP, USDC_address, amountWPHRS);
  await delay(randomdelay());

  await addLiquidityFaroswap(wallet, WPHRS_FAROSWAP, USDT_address, amountWPHRS);
  await delay(randomdelay());
}

async function startBot() {
  console.clear();
  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    logger.account(`Wallet: ${wallet.address}`);

    try {
      const totalPoint = await dailySendCoin(wallet);      
      await swapzenith(wallet);
      await LPzenith(wallet);
      await swapLPfaro(wallet);

      const result = await deployToken(wallet);
      if (result) {
        await sendDeployToken(result.tokencontract, wallet, result.symbol);
      }
      await delay(randomdelay());

      const txCount = await provider.getTransactionCount(wallet.address);
      logAccount(`Totaltx ${wallet.address} ->>: ${txCount}`);
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
