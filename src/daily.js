import axios from "axios";
import { logger } from "../skw/logger.js";
import { sendcoin } from "../skw/helper.js";
import {
 provider,
 generateAddresses,
} from "../skw/config.js";

export async function login(wallet, headers) {
  try {
    const signature = await wallet.signMessage("pharos");
    const url = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=09IYaHsUJYpxmTSW`;
    const response = await axios.post(url, {}, { headers });
    return response.data?.data?.jwt;
  } catch (error) {
    logger.fail("Login error: " + (error.response?.data || error.message));
    throw error;
  }
}

export async function getProfil(token, headers, wallet) {
  try {
    const url = `https://api.pharosnetwork.xyz/user/profile?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    const response = await axios.get(url, { headers: authHeaders });
    const dataProfil = response.data?.data;
    const totalPoint = dataProfil.user_info.TotalPoints;
    return { totalPoint, dataProfil };
  } catch (error) {
    logger.fail(`Gagal getProfil: ${error.message || 'unknown error'}\n`);
    throw error;
  }
}

export async function daily(token, headers, wallet) {
  try {
    const url = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    const response = await axios.post(url, null, { headers: authHeaders });
    const msg = response.data?.msg;

    if (msg === "ok") {
      logger.succes(`Daily Login Berhasil\n`);
    } else if (msg === "already signed in today") {
      logger.info(`Sudah Login Hari Ini\n`);
    } else {
      logger.warn(`Respon tidak dikenali: ${msg}\n`);
    }

    return msg;
  } catch (error) {
    logger.fail('Error saat daily sign-in:', error.response?.data || error.message);
    throw error;
  }
}

export async function verifyTask(token, headers, wallet, txHash) {
  try {
    const url = `https://api.pharosnetwork.xyz/task/verify`;
    const authHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const body = {
      address: wallet.address,
      task_id: 103,
      tx_hash: txHash,
    };

    const response = await axios.post(url, body, { headers: authHeaders });
    return response.data?.msg;
  } catch (error) {
    logger.fail("Verify error: " + (error.response?.data || error.message));
    throw error;
  }
}

export async function verifySendCoin(token, headers, wallet) {
  try {
    const recipients = generateAddresses(15).map((w) => w.address);
    logger.start("Processing Send Coin to 15 random address");

    for (const recipient of recipients) {
      const txHash = await sendcoin(wallet, recipient);
      if (txHash) {
        const res = await verifyTask(token, headers, wallet, txHash);
        logger.info(`Sendcoin ${res}\n`);
      } else {
        logger.warn("Skip verify karena txHash undefined");
      }
    }
  } catch (err) {
    logger.fail("VerifySendCoin error: " + err.message);
  }
}
