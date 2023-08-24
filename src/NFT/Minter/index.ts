/**
 * Compressed NFTs on Solana, using State Compression
  ---
  Overall flow of this script
  - load or create two keypairs (named `payer` and `testWallet`)
  - create a new tree with enough space to mint all the nft's you want for the "collection"
  - create a new NFT Collection on chain (using the usual Metaplex methods)
  - mint a single compressed nft into the tree to the `payer`
  - mint a single compressed nft into the tree to the `testWallet`
  - display the overall cost to perform all these actions

  ---
  NOTE: this script is identical to the `scripts/createAndMint.ts` file, except THIS file has
  additional explanation, comments, and console logging for demonstration purposes.
*/

/**
 * General process of minting a compressed NFT:
 * - create a tree
 * - create a collection
 * - mint compressed NFTs to the tree
 */

import { Keypair, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  ValidDepthSizePair,
  getConcurrentMerkleTreeAccountSize,
} from "@solana/spl-account-compression";
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";
import { CreateMetadataAccountArgsV3 } from "@metaplex-foundation/mpl-token-metadata";

// import custom helpers for demos
import {
  loadKeypairFromFile,
  loadOrGenerateKeypair,
  numberFormatter,
  printConsoleSeparator,
  savePublicKeyToFile,
  loadPublicKeysFromFile,
} from "../../Helpers";

// import custom helpers to mint compressed NFTs
import { mintCompressedNFT } from "../../Compression";

// local import of the connection wrapper, to help with using the ReadApi
import { WrapperConnection } from "../../ReadAPI";

import dotenv from "dotenv";
import { getAdminAccount, getCollectionMint, getRPCEndpoint } from "../../../utils";
import { NftMintDetails } from "./types";
dotenv.config();

// define some reusable balance values for tracking
let initBalance: number, balance: number;

export const mintNft = async (nftMintDetails: NftMintDetails) => {
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // generate a new Keypair for testing, named `wallet`

  // generate a new keypair for use in this demo (or load it locally from the filesystem when available)
  const payer = getAdminAccount();
  // console.log("Payer address:", payer.publicKey.toBase58());

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // load the env variables and store the cluster RPC url
  const CLUSTER_URL = getRPCEndpoint();

  // create a new rpc connection, using the ReadApi wrapper
  const connection = new WrapperConnection(CLUSTER_URL, "confirmed");

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // get the payer's starting balance
  initBalance = await connection.getBalance(payer.publicKey);
  /* console.log(
    "Starting account balance:",
    numberFormatter(initBalance / LAMPORTS_PER_SOL),
    "SOL\n",
  ); */

  const {
    mintTo,
    name,
    symbol,
    uri,
    whichCollection,
  } = nftMintDetails;

  const compressedNFTMetadata: MetadataArgs = {
    name,
    symbol,
    // specific json metadata for each NFT
    uri,
    creators: [
      {
        address: payer.publicKey,
        verified: false,
        share: 100,
      },
    ], // or set to null
    editionNonce: 0,
    uses: null,
    collection: null,
    primarySaleHappened: false,
    sellerFeeBasisPoints: 0,
    isMutable: false,
    // these values are taken from the Bubblegum package
    tokenProgramVersion: TokenProgramVersion.Original,
    tokenStandard: TokenStandard.NonFungible,
  };

  // fully mint a single compressed NFT
  // console.log(`Minting a single compressed NFT to ${mintTo.toBase58()}...`);

  let treeKeypair = loadOrGenerateKeypair(whichCollection);
  let { collectionMint, collectionMasterEditionAccount, collectionMetadataAccount } = getCollectionMint(whichCollection);
  
  await mintCompressedNFT(
    connection,
    payer,
    treeKeypair.publicKey,
    new PublicKey(collectionMint),
    new PublicKey(collectionMetadataAccount),
    new PublicKey(collectionMasterEditionAccount),
    compressedNFTMetadata,
    // mint to this specific wallet (in this case, airdrop to `testWallet`)
    mintTo,
  );

  // console.log('Minted: ' + name);

  // console.log(`Minted Compressed NFT to ${mintTo.toBase58()}`);
  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // fetch the payer's final balance
  // balance = await connection.getBalance(payer.publicKey);

  // console.log(`===============================`);
  // console.log(
  //   "Total cost:",
  //   numberFormatter((initBalance - balance) / LAMPORTS_PER_SOL, true),
  //   "SOL\n",
  // );
}