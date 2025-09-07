import { ethers } from "ethers";
import { logger } from "./skw/logger.js";
import { Send_ABI } from "../skw/abis.js";
import {
 delay,
 randomdelay,
 randomAmount,
 receivers,
} from "./skw/config.js";

import {
 Send_ROUTER,
 explorer,
} from "../skw/contract.js";

async function sendcoin(wallet, receiver, amount) {
  try {
    const getBalance = await provider.getBalance(wallet.address);
    const balance = parseFloat(ethers.formatUnits(getBalance, 18)).toFixed(5);

    logger.balance(`Balance PHRS: ${balance}`);

    const contract = new ethers.Contract(Send_ROUTER, Send_ABI, wallet);
    const value = ethers.parseEther(amount);

    const token = [ 1n, '0x0000000000000000000000000000000000000000' ];
    const sentTo = [ 'x', receiver, value, [] ];

    if (getBalance > value) {

      logger.start(`Send ${amount} PHRS to ${receiver}`);
      const tx = await contract.tip(token, sentTo, {
        value: value
      });

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);

      await tx.wait();
      logger.succes(`Send via X Berhasil\n`);
    } else {
    logger.warn(`Saldo tidak cukup untuk send\n`);
    }

  } catch (err) {
    logger.fail(`Error during sendcoin ${err.message}\n`);
  }
}

export async function sendtoX(wallet) {
  try {
    for (const receiver of receivers) {
      const amount = randomAmount(0.00001, 0.00003, 5);
      await sendcoin(wallet, receiver, amount);
      await delay(randomdelay());
    }
  } catch (err) {
    logger.fail(`Error during sendtoX ${err.message}\n`);
  }
}
