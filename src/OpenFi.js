import { ethers } from "ethers";
import { logger } from "../skw/logger.js";
import { OpenFi_ABI } from "../skw/abis.js";
import {
 OpenFi_GOLD,
 OpenFi_TESLA,
 OpenFi_ADDRESS,
 explorer,
} from "../skw/contract.js";

import {
 approve,
 cekbalance,
} from "../skw/helper.js";

import {
 randomAmount,
 delay,
 randomdelay,
} from "../skw/config.js";

async function supply(wallet, tokenIn, amount) {
  try {
    const { balancewei, symbol, decimal } = await cekbalance(wallet, tokenIn);
    const amountIn = ethers.parseUnits(amount, decimal);

    if (balancewei > amountIn) {
      logger.start(`Supply ${amount} ${symbol} to OpenFi`);

      await approve(wallet, tokenIn, OpenFi_ADDRESS, amountIn);
      const contract = new ethers.Contract(OpenFi_ADDRESS, OpenFi_ABI, wallet);

      const tx = await contract.supply(
        tokenIn,
        amountIn,
        wallet.address,
        0
      );

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
      await tx.wait();

      logger.succes(`Supply Berhasil\n`);
    } else {
      logger.warn(`Saldo tidak cukup untuk Supply\n`);
    }
  } catch (err) {
    logger.fail(`Error during supply ${err.message || err}\n`);
  }
}

async function getHealthFactor(wallet) {
  try {
    const contract = new ethers.Contract(OpenFi_ADDRESS, OpenFi_ABI, wallet);

    const data = await contract.getUserAccountData(wallet.address);

    const hf = Number(data.healthFactor) / 1e18;

    logger.info(`Health Factor: ${hf.toFixed(2)}`);

    return hf;
  } catch (err) {
    logger.fail(`Error getHealthFactor ${err.message || err}\n`);
    return null;
  }
}

async function borrow(wallet, tokenIn, amount, rateMode = 2) {
  try {
    const { decimal, symbol } = await cekbalance(wallet, tokenIn);
    const amountIn = ethers.parseUnits(amount, decimal);

    const hf = await getHealthFactor(wallet);
    if (hf <= 1.5) {
      logger.warn(`Health Factor terlalu rendah (${hf.toFixed(2)}) untuk Borrow\n`);
      return;
    }

    const contract = new ethers.Contract(OpenFi_ADDRESS, OpenFi_ABI, wallet);

    logger.start(`Borrow ${amount} ${symbol} from OpenFi`);

    const tx = await contract.borrow(
      tokenIn,
      amountIn,
      rateMode,
      0,
      wallet.address
    );

    logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
    await tx.wait();

    logger.succes(`Borrow Berhasil\n`);
  } catch (err) {
    logger.fail(`Error during Borrow ${err.message || err}\n`);
  }
}

export async function OpenFi(wallet) {
  try {
    const repeat = randomAmount(2, 4, 0);
    for (let i = 0; i < repeat; i++) {
      const supplyusdc = randomAmount(0.5, 1.5, 1);
      await supply(wallet, tokenIn, supplyusdc);
      await delay(randomdelay());

      const supplyusdt = randomAmount(0.5, 1.5, 1);
      await supply(wallet, tokenIn, supplyusdt);
      await delay(randomdelay());

      const borrowgold = randomAmount(0.002, 0.01, 3);
      await borrow(wallet, gold, borrowgold);
      await delay(randomdelay());

      const borrowtesla = randomAmount(0.00001, 0.0001, 6);
      await borrow(wallet, gold, borrowtesla);
      await delay(randomdelay());
    }
  } catch (err) {
    logger.fail(`Error during OpenFi ${err.message || err}\n`);
  }
}
