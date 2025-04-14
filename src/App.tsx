import { useEffect, useState } from "react";
import { ethers, formatEther } from 'ethers';
import { motion } from "framer-motion";
import { IDKitWidget } from "@worldcoin/idkit";
import xDogeStakingABI from "./abi/xDogeStakingABI.json";
import ERC20ABI from "./abi/ERC20.json";
import "./index.css";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const STAKING_CONTRACT_ADDRESS = "0x9F3C7A0515072eACeeb1cBA192aeEBaDD900591F";
const TOKEN_ADDRESS = "0x37cFf256E4aeD256493060669a04b59d87d509d1";
const WORLDCOIN_APP_ID = "app_f6797f07204e9adf68c8537b4dcaebf6";

function App() {
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [amount, setAmount] = useState<string>("0");
  const [duration, setDuration] = useState<string>("604800");
  const [stakingStart, setStakingStart] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [estimatedReward, setEstimatedReward] = useState<number>(0);
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      await web3Provider.send("eth_requestAccounts", []);
      const signer = await web3Provider.getSigner();
      const address = await signer.getAddress();
      setSigner(signer);
      setWalletAddress(address);
    } else {
      alert("Install MetaMask dulu ya!");
    }
  };

  const fetchBalance = async () => {
    if (signer) {
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20ABI, signer);
      const address = await signer.getAddress();
      const rawBalance = await token.balanceOf(address);
      setBalance(formatEther(rawBalance));
    }
  };

  const fetchStakingInfo = async () => {
    if (!signer || !walletAddress) return;
    const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
    const stake = await contract.stakes(walletAddress);
    if (stake.amount > 0n && !stake.unstaked) {
      setStakingStart(Number(stake.startTime));
      const reward = await contract.getPendingReward(walletAddress);
      setEstimatedReward(parseFloat(formatEther(reward)));
    }
  };

  const handleStake = async () => {
    if (!isVerified) return alert("Verifikasi World ID diperlukan!");

    if (signer) {
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20ABI, signer);
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);

      const parsedAmount = ethers.parseEther(amount);
      const parsedDuration = BigInt(duration);

      const allowance = await token.allowance(walletAddress, STAKING_CONTRACT_ADDRESS);
      if (allowance < parsedAmount) {
        const txApprove = await token.approve(STAKING_CONTRACT_ADDRESS, parsedAmount);
        await txApprove.wait();
      }

      const tx = await contract.stake(parsedAmount, parsedDuration);
      await tx.wait();

      await fetchBalance();
      await fetchStakingInfo();
    }
  };

  const handleUnstake = async () => {
    if (signer) {
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
      const tx = await contract.unstake();
      await tx.wait();

      await fetchBalance();
      await fetchStakingInfo();
    }
  };

  const handleClaim = async () => {
    if (signer) {
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
      const tx = await contract.claimReward();
      await tx.wait();

      await fetchBalance();
      await fetchStakingInfo();
    }
  };

  const handleMax = () => {
    setAmount(balance);
  };

  const handleProof = (result: any) => {
    console.log("✅ World ID Verified:", result);
    setIsVerified(true);
  };

  useEffect(() => {
    connectWallet();
  }, []);

  useEffect(() => {
    if (signer) {
      fetchBalance();
      fetchStakingInfo();
    }
  }, [signer]);

  useEffect(() => {
    if (stakingStart) {
      const interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const end = stakingStart + parseInt(duration);
        const remaining = end - now;
        setTimeLeft(remaining > 0 ? remaining : 0);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stakingStart, duration]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex items-center justify-center px-4">
      <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6">
        <motion.h1
          className="text-3xl font-bold text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          🔒 xDoge Staking
        </motion.h1>

        <div className="text-sm text-center">
          Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}<br />
          Saldo: <span className="font-bold">{parseFloat(balance).toFixed(4)} xDoge</span>
        </div>

        <IDKitWidget
          app_id={WORLDCOIN_APP_ID}
          action="worldcoin-login"
          signal={walletAddress}
          onSuccess={handleProof}
        >
          {({ open }) => (
            <button
              onClick={open}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-2 rounded-lg font-semibold"
            >
              🌐 {isVerified ? "Terverifikasi ✅" : "Login dengan World ID"}
            </button>
          )}
        </IDKitWidget>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Jumlah stake"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 bg-black/40 border border-gray-500 rounded-lg text-white"
            />
            <button
              onClick={handleMax}
              className="px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Max
            </button>
          </div>

          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-4 py-2 bg-black/40 border border-gray-500 rounded-lg text-white"
          >
            <option value="604800">7 Hari (5%)</option>
            <option value="1209600">14 Hari (10%)</option>
            <option value="2592000">30 Hari (25%)</option>
            <option value="7776000">90 Hari (50%)</option>
            <option value="15552000">180 Hari (100%)</option>
          </select>

          {stakingStart && (
            <div className="text-sm text-gray-300 text-center space-y-1">
              <p>⏳ Unstake tersedia dalam:</p>
              <p className="font-mono">
                {Math.floor(timeLeft / 3600)}j : {Math.floor((timeLeft % 3600) / 60)}m : {timeLeft % 60}s
              </p>
              <p>💸 Estimasi reward: <span className="font-bold">{estimatedReward.toFixed(2)} xDoge</span></p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <motion.button
              onClick={handleStake}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className="bg-blue-600 hover:bg-blue-700 py-2 px-6 rounded-xl font-semibold shadow"
            >
              Stake
            </motion.button>
            <motion.button
              onClick={handleUnstake}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className="bg-red-500 hover:bg-red-600 py-2 px-6 rounded-xl font-semibold shadow"
            >
              Unstake
            </motion.button>
            <motion.button
              onClick={handleClaim}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className="bg-green-600 hover:bg-green-700 py-2 px-6 rounded-xl font-semibold shadow"
            >
              Claim
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;