import { ethers } from "ethers";
import { logger } from "../skw/logger.js";
import {
 USDC_R2_PHAROS,
 R2USD_PHAROS,
 sR2USD_PHAROS,
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

async function swapUSDCtoR2USD(wallet, amount) {
  try {
    const { balancewei, symbol, decimal } = await cekbalance(wallet, USDC_R2_PHAROS);
    const amountIn = ethers.parseUnits(amount, decimal);

    const selector = "0x095e7a95"
    const paddedAddress = ethers.zeroPadValue(wallet.address, 32);
    const encodedZeroUint = ethers.zeroPadValue(ethers.toBeHex(0), 256);
    const paddedAmount = ethers.zeroPadValue(ethers.toBeHex(amountIn), 32);
    const callData = selector + paddedAddress.slice(2) + paddedAmount.slice(2) + encodedZeroUint.slice(2);

    if (balancewei > amountIn) {
      logger.start(`Swap ${amount} USDC to ${amount} R2USD`);
      await approve(wallet, USDC_R2_PHAROS, R2USD_PHAROS, ethers.MaxUint256);

      const tx = await wallet.sendTransaction({
        to: R2USD_PHAROS,
        data: callData
      });

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
      await tx.wait();
      logger.succes(`Swap Berhasil\n`);
    } else {
    logger.warn(`Saldo tidak cukup untuk swap\n`);
    }
  } catch (err) {
    logger.fail(`Error during swapUSDCtoR2USD ${err.message || err}\n`);
  }
}

async function swapR2USDtoUSDC(wallet, amount) {
  try {
    const { balancewei, symbol, decimal } = await cekbalance(wallet, R2USD_PHAROS);
    const amountIn = ethers.parseUnits(amount, decimal);

    if (balancewei > amountIn) {
      const BURN_ABI = ["function burn(address _from, uint256 _amount)"];
      const contract = new ethers.Contract(R2USD_PHAROS, BURN_ABI, wallet);

      logger.start(`Swap ${amount} ${symbol} to USDC`);

      const tx = await contract.burn(wallet.address, amountIn);

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
      await tx.wait();

      logger.succes(`Swap Berhasil\n`);
    } else {
      logger.warn(`Saldo tidak cukup untuk swap\n`);
    }
  } catch (err) {
    logger.fail(`Error during SwapR2USDtoUSDC ${err.message || err}\n`);
  }
}

async function earnR2pharos(wallet) {
  try {
    const { balancewei: balanceweiIn, symbol: symbolIn, decimal: decimalIn } = await cekbalance(wallet, R2USD_PHAROS);
    const { balancewei: balanceweiOut, symbol: symbolOut, decimal: decimalOut } = await cekbalance(wallet, sR2USD_PHAROS);

    const amountIn = ethers.formatUnits(balanceweiIn, decimalIn);

    const selector = "0x1a5f0f00"
    const encodedZeroUint = ethers.zeroPadValue(ethers.toBeHex(0), 160);
    const paddedAmount = ethers.zeroPadValue(ethers.toBeHex(balanceweiIn), 32);
    const callData = selector + paddedAmount.slice(2) + encodedZeroUint.slice(2);

    if (balanceweiIn > 0n) {
      logger.start(`Swap ${amountIn} R2USD to ${amountIn} sR2USD`);
      await approve(wallet, R2USD_PHAROS, sR2USD_PHAROS, ethers.MaxUint256);

      const tx = await wallet.sendTransaction({
        to: sR2USD_PHAROS,
        data: callData
      });

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
      await tx.wait();
      logger.succes(`Swap Berhasil\n`);
    } else {
    logger.warn(`Saldo tidak cukup untuk swap\n`);
    }
  } catch (err) {
    logger.fail(`Error during earnR2 ${err.message || err}\n`);
  }
}

export async function R2pharos(wallet) {
  try {
    const repeat = randomAmount(2, 4, 0);
    for (let i = 0; i < repeat; i++) {
      const USDCtoR2USD = randomAmount(100, 150, 0);
      await swapUSDCtoR2USD(wallet, USDCtoR2USD);
      await delay(randomdelay());

      const R2USDtoUSDC = randomAmount(10, 20, 0);
      await swapR2USDtoUSDC(wallet, R2USDtoUSDC);
      await delay(randomdelay());

      await earnR2pharos(wallet);
      await delay(randomdelay());
    }
  } catch (err) {
    logger.fail(`Error during R2pharos ${err.message || err}\n`);
  }
}
