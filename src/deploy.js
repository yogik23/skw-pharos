import { ethers } from "ethers";
import solc from "solc";
import { logger } from "../skw/logger.js";
import { explorer } from "../skw/contract.js";
import {
 delay,
 generateAddresses,
 randomTokenName,
 randomSymbol,
 randomSupply,
 randomdelay,
} from "../skw/config.js";

function generateContract(name, symbol, supply) {
  const source = `// SPDX-License-Identifier: UNLICENSED
  pragma solidity ^0.8.17;
  
  contract ERC20 {
      mapping(address => uint) public balanceOf;
      mapping(address => mapping(address => uint)) public allowance;
      string public name;
      string public symbol;
      uint8 public decimals = 18;
      uint public totalSupply;

      event Transfer(address indexed from, address indexed to, uint value);
      event Approval(address indexed owner, address indexed spender, uint value);

      constructor(string memory _name, string memory _symbol, uint _supply) {
          name = _name;
          symbol = _symbol;
          totalSupply = _supply;
          balanceOf[msg.sender] = _supply;
          emit Transfer(address(0), msg.sender, _supply);
      }

      function transfer(address to, uint value) public returns (bool) {
          require(balanceOf[msg.sender] >= value);
          balanceOf[msg.sender] -= value;
          balanceOf[to] += value;
          emit Transfer(msg.sender, to, value);
          return true;
      }
  }

  contract ${name} is ERC20 {
      constructor() ERC20("${name}", "${symbol}", ${supply}) {}
  }`;

  const input = {
    language: "Solidity",
    sources: {
      "Contract.sol": { content: source },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const compiled = output.contracts["Contract.sol"][name];
  return {
    abi: compiled.abi,
    bytecode: compiled.evm.bytecode.object,
  };
}

export async function deployToken(wallet) {
  try {
    const name = randomTokenName();
    const symbol = randomSymbol(name);
    const supply = randomSupply();
    const totalSupply = ethers.parseUnits(supply, 18);

    logger.start(`Deploying token: ${name} (${symbol}) with supply ${supply}`);
    const { abi, bytecode } = generateContract(name, symbol, totalSupply);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const txHash = contract.deploymentTransaction().hash;
    const contractAddr = await contract.getAddress();

    logger.send(`Tx dikirim ->> ${explorer}${txHash}`);
    logger.succes(`Contract Deploy Token ${contractAddr}\n\n`);

    const tokencontract = new ethers.Contract(contractAddr, abi, wallet);
    const balance = await tokencontract.balanceOf(wallet.address);

    return { tokencontract, symbol };
  } catch (err) {
    logger.fail(`Deploy error: ${err.message}`);
    return null;
  }
}

export async function sendDeployToken(tokencontract, wallet, symbol) {
  const recipients = generateAddresses(15).map((w) => w.address);
  logger.start(`Processing Send token ${symbol} to 15 random address`);
  for (const recipient of recipients) {
    try {
      const balancenow = await tokencontract.balanceOf(wallet.address);
      const amountSend = ethers.parseUnits("10", 18);
      logger.balance(`Balance ${symbol}: ${ethers.formatUnits(balancenow, 18)}`);

      if (balancenow < amountSend) {
        logger.warn(`Saldo ${symbol} tidak cukup untuk dikirim < 10`);
        return;
      }

      logger.start(`Send 10 ${symbol} ke ${recipient}`);
      const tx = await tokencontract.transfer(recipient, amountSend);
      logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
      await tx.wait();
      logger.succes(`Send success\n`);
    } catch (err) {
      logger.fail(`Send to ${recipient} failed: ${err.message}\n`);
    }
    await delay(randomdelay());
  }
}
