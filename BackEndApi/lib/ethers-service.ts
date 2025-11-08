// app/lib/ethers-service.ts
import { ethers, Contract, Provider } from "ethers";
import JobManagerABI from "./JobManager.json";

// 1. Environment Variables
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const WSS_RPC_URL = process.env.SCROLL_SEPOLIA_WSS_RPC_URL;

// 2. Singleton instances
let provider: Provider | null = null;
let readonlyContract: Contract | null = null;

/**
 * Initializes and returns a singleton instance of the Ethers provider for read-only access.
 * Throws an error if the RPC_URL is not configured.
 */
function getProvider(): Provider {
  if (!provider) {
    if (!WSS_RPC_URL) {
      throw new Error("SCROLL_SEPOLIA_WSS_RPC_URL is not defined in .env");
    }
    provider = new ethers.WebSocketProvider(WSS_RPC_URL);
  }
  return provider;
}

/**
 * Returns a singleton instance of the JobManager contract for read-only operations.
 * Throws an error if the contract address is not configured.
 */
export function getReadonlyContract(): Contract {
  if (!readonlyContract) {
    if (!CONTRACT_ADDRESS) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not defined in .env");
    }
    readonlyContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      JobManagerABI.abi,
      getProvider()
    );
  }
  return readonlyContract;
}