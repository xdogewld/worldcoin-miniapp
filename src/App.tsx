import { useEffect, useState } from "react";
import { ethers, formatEther, parseEther } from "ethers";
import { IDKitWidget } from "@worldcoin/idkit";
import { motion, AnimatePresence } from "framer-motion";
import xDogeStakingABI from "./abi/xDogeStakingABI.json";
import ERC20ABI from "./abi/ERC20.json";
import "./index.css";

const STAKING_CONTRACT_ADDRESS = "0x9F3C7A0515072eACeeb1cBA192aeEBaDD900591F";
const TOKEN_ADDRESS = "0x37cFf256E4aeD256493060669a04b59d87d509d1";
const WORLDCOIN_APP_ID = "app_f6797f07204e9adf68c8537b4dcaebf6";

const durations = [
  { label: "7 Days (5%)", value: 604800, reward: 5 },
  { label: "14 Days (10%)", value: 1209600, reward: 10 },
  { label: "30 Days (25%)", value: 2592000, reward: 25 },
  { label: "90 Days (50%)", value: 7776000, reward: 50 },
  { label: "180 Days (100%)", value: 15552000, reward: 100 },
];

function App() {
  const [wallet, setWallet] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [amount, setAmount] = useState<number>(0);
  const [durationIndex, setDurationIndex] = useState<number>(0);
  const [stakingStart, setStakingStart] = useState<number | null>(null);
  const [estimatedReward, setEstimatedReward] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  const selectedDuration = durations[durationIndex];
  const texts = ["Stake Your Tokens", "Earn Rewards", "Unstake When Ready"];

  const [textIndex, setTextIndex] = useState<number>(0);

  const connectWallet = async () => {
    if (!window.Worldcoin) return alert("Please install Worldcoin App.");
    const provider = new ethers.BrowserProvider(window.Worldcoin);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setWallet(address);
  };

  const fetchBalance = async () => {
    if (!wallet) return;
    const provider = new ethers.JsonRpcProvider(); // Default RPC provider
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20ABI, provider);
    const balance = await token.balanceOf(wallet);
    setBalance(formatEther(balance));
  };

  const fetchStakingInfo = async () => {
    if (!wallet) return;
    const provider = new ethers.JsonRpcProvider(); // Default RPC provider
    const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, provider);
    const stake = await contract.stakes(wallet);
    if (stake.amount > 0n && !stake.unstaked) {
      setStakingStart(Number(stake.startTime));
      const reward = await contract.getPendingReward(wallet);
      setEstimatedReward(parseFloat(formatEther(reward)));
    }
  };

  const handleStake = async () => {
    if (!isVerified) return alert("Please verify with World ID first.");
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(); // Default RPC provider
      const signer = provider.getSigner();
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20ABI, signer);
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
      const parsedAmount = parseEther(amount.toString());
      const duration = BigInt(selectedDuration.value);

      const allowance = await token.allowance(wallet, STAKING_CONTRACT_ADDRESS);
      if (allowance < parsedAmount) {
        const approveTx = await token.approve(STAKING_CONTRACT_ADDRESS, parsedAmount);
        await approveTx.wait();
      }

      const stakeTx = await contract.stake(parsedAmount, duration);
      setTxHash(stakeTx.hash);
      await stakeTx.wait();

      await fetchBalance();
      await fetchStakingInfo();
    } catch (error) {
      alert("Error while staking.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(); // Default RPC provider
      const signer = provider.getSigner();
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
      const tx = await contract.unstake();
      setTxHash(tx.hash);
      await tx.wait();
      await fetchBalance();
      await fetchStakingInfo();
    } catch (error) {
      alert("Error while unstaking.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(); // Default RPC provider
      const signer = provider.getSigner();
      const contract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, xDogeStakingABI, signer);
      const tx = await contract.claimReward();
      setTxHash(tx.hash);
      await tx.wait();
      await fetchBalance();
      await fetchStakingInfo();
    } catch (error) {
      alert("Error while claiming reward.");
    } finally {
      setLoading(false);
    }
  };

  const handleProof = () => setIsVerified(true);
  const handleMax = () => setAmount(parseFloat(balance));
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const updateCountdown = () => {
    if (!stakingStart) return;
    const now = Math.floor(Date.now() / 1000);
    const end = stakingStart + selectedDuration.value;
    const diff = end - now;
    setTimeLeft(diff > 0 ? diff : 0);
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const increaseAmount = () => setAmount((prev) => Math.min(parseFloat(balance), prev + 1));
  const decreaseAmount = () => setAmount((prev) => Math.max(0, prev - 1));

  useEffect(() => {
    connectWallet();
  }, []);

  useEffect(() => {
    if (wallet) {
      fetchBalance();
      fetchStakingInfo();
    }
  }, [wallet]);

  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [stakingStart, durationIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"} min-h-screen transition-colors duration-500`}>
      <div className="absolute top-5 right-5">
        <button onClick={toggleDarkMode} className="bg-white/10 px-3 py-1 rounded-md text-sm hover:bg-white/20">
          {darkMode ? "🌞 Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <motion.div
          className={`w-full max-w-md p-8 rounded-2xl shadow-xl backdrop-blur-lg ${darkMode ? "bg-white/5 border-white/10" : "bg-white border-gray-300"}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.h1 className="text-3xl font-bold text-center mb-4" initial={{ y: -20 }} animate={{ y: 0 }}>
            🐶 xDoge Staking
          </motion.h1>

          {/* Breathing Text */}
          <motion.div
            className="text-center text-2xl font-semibold mb-6 animate-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {texts[textIndex]}
          </motion.div>

          <div className="text-center text-sm space-y-1 mb-4">
            <p>Wallet: {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "-"}</p>
            <p>Balance: <b>{parseFloat(balance).toFixed(4)} xDoge</b></p>
          </div>

          <IDKitWidget app_id={WORLDCOIN_APP_ID} action="stake-auth" signal={wallet} onSuccess={handleProof}>
            {({ open }) => (
              <button onClick={open} className="w-full bg-indigo-500 hover:bg-indigo-600 py-2 rounded-lg font-semibold">
                🌐 {isVerified ? "Verified ✅" : "Login with World ID"}
              </button>
            )}
          </IDKitWidget>

          <div className="space-y-4 mt-6">
            <div className="flex gap-2 items-center">
              <button onClick={decreaseAmount} className="px-3 py-2 bg-gray-600 rounded-lg">-</button>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-black/20 border border-gray-500 rounded-lg appearance-none"
              />
              <button onClick={increaseAmount} className="px-3 py-2 bg-gray-600 rounded-lg">+</button>
              <button onClick={handleMax} className="px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
                Max
              </button>
            </div>

            <input
              type="range"
              min="0"
              max={durations.length - 1}
              value={durationIndex}
              onChange={(e) => setDurationIndex(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center text-sm">{durations[durationIndex].label}</div>

            <AnimatePresence>
              {stakingStart && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm text-gray-300 space-y-1"
                >
                  <p>⏳ Unstake available in: {formatTime(timeLeft)}</p>
                  <p>💰 Estimated reward: <b>{estimatedReward.toFixed(2)} xDoge</b></p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center text-green-400 text-sm">
              📈 Est. total earnings: <b>{((amount * selectedDuration.reward) / 100).toFixed(2)} xDoge</b>
            </div>

            {txHash && (
              <div className="text-center text-blue-400 text-sm">
                📝 Tx Hash: 
                <a href={`https://worldscan.org/tx/${txHash}`} target="_blank" className="underline">
                  {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
                </a>
              </div>
            )}

            {timeLeft > 0 && (
              <p className="text-yellow-400 text-sm text-center">
                ⏳ You can unstake after the staking duration ends.
              </p>
            )}

            <div className="flex gap-3 justify-center">
              <motion.button
                onClick={handleStake}
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 py-3 px-8 rounded-xl font-semibold text-white shadow-lg hover:scale-105 transition-all duration-300"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
              >
                {loading ? "Staking..." : "Stake"}
              </motion.button>
              <motion.button
                onClick={handleUnstake}
                disabled={timeLeft > 0 || loading}
                className="bg-gradient-to-r from-red-600 to-red-800 py-3 px-8 rounded-xl font-semibold text-white shadow-lg hover:scale-105 transition-all duration-300"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
              >
                {loading ? "Unstaking..." : "Unstake"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;