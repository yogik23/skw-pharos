import { ethers } from "ethers";
import chalk from "chalk";
import axios from "axios";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import userAgents from "./skw/userAgents.js";
import { delay } from './skw/config.js';
import { addWPHRSUSDC } from './skw/pool.js';
import { swapandsend } from './skw/swap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = "https://testnet.dplabs-internal.com";
const provider = new ethers.JsonRpcProvider(RPC);

const privateKeys = fs.readFileSync(path.join(__dirname, "privatekey.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

const baseHeaders = {
  "accept": "application/json, text/plain, */*",
  "origin": "https://testnet.pharosnetwork.xyz",
  "referer": "https://testnet.pharosnetwork.xyz/",
  "sec-gpc": "1"
};

async function login(wallet, headers) {
  try {
    const signature = await wallet.signMessage("pharos");
    const url = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=09IYaHsUJYpxmTSW`;
    const response = await axios.post(url, {}, { headers });
    return response.data?.data?.jwt;
  } catch (error) {
    console.error('❌ Error during login request:', error.response?.data || error.message);
    throw error;
  }
}

async function getProfil(token, wallet, headers) {
  try {
    const url = `https://api.pharosnetwork.xyz/user/profile?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
    const response = await axios.get(url, { headers: authHeaders });
    return response.data?.data;
  } catch (error) {
    console.error('❌ Error during profile request:', error.response?.data || error.message);
    throw error;
  }
}

async function daily(token, wallet, headers) {
  try {
    const url = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
    const response = await axios.post(url, {}, { headers: authHeaders });
    const msg = response.data?.msg;

    if (msg === "ok") {
      console.log(chalk.hex('#66CDAA')(`✅ Daily Login Berhasil`));
    } else if (msg === "already signed in today") {
      console.log(chalk.hex('#66CDAA')(`ℹ️ Sudah Login Hari Ini`));
    } else {
      console.log(chalk.hex('#66CDAA')(`❔ Respon tidak dikenali: ${msg}`));
    }

    return msg;
  } catch (error) {
    console.error('❌ Error saat daily sign-in:', error.response?.data || error.message);
    throw error;
  }
}

async function startBot() {
  console.clear();
  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const headers = {
      ...baseHeaders,
      'user-agent': userAgent
    };

    console.log(chalk.hex('#9370DB')(`\n🔑 Wallet: ${wallet.address}`));

    try {
      const token = await login(wallet, headers);
      await daily(token, wallet, headers);
      await delay(3000);

      const dataProfil = await getProfil(token, wallet, headers);
      const TotalPoints = dataProfil.user_info.TotalPoints;
      console.log(chalk.hex('#20B2AA')(`🏆 Total Points: ${TotalPoints}`));

      await swapandsend(wallet);
      await delay(50000);
      await addWPHRSUSDC(wallet);

    } catch (err) {
      console.log(chalk.red(`❌ Gagal proses wallet ${wallet.address}: ${err.message}`));
    }

    await delay(10000);
  }
}

startBot()
