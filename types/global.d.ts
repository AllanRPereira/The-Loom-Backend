// app/types/global.d.ts
import { ethers } from "ethers";

declare global {
  interface Window {
    // Define que window.ethereum PODE existir e 
    // é do tipo Eip1193Provider (o que o Ethers espera)
    ethereum?: ethers.Eip1193Provider;
  }
}