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

import { Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
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
} from "../../Helpers";

// import custom helpers to mint compressed NFTs
import { createCollection, createTree, mintCompressedNFT } from "../../Compression";

// local import of the connection wrapper, to help with using the ReadApi
import { WrapperConnection } from "../../ReadAPI";

import dotenv from "dotenv";
import { getAdminAccount, getRPCEndpoint } from "../../../utils";
import { CollectionDetails } from "./types";
dotenv.config();

// define some reusable balance values for tracking
let initBalance: number, balance: number;

export const initializeTree = async (collectionDetails: CollectionDetails) => {

  const {
      name,
      symbol,
      whichCollection,
      uri,
      sellerFeeBasisPoints
  } = collectionDetails;

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // generate a new keypair for use in this demo (or load it locally from the filesystem when available)
  const payer = getAdminAccount();

  // console.log("Payer address:", payer.publicKey.toBase58());

  // locally save the addresses for the demo
  savePublicKeyToFile("userAddress", payer.publicKey);

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
  console.log(
    "Starting account balance:",
    numberFormatter(initBalance / LAMPORTS_PER_SOL),
    "SOL\n",
  );

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /*
    Define our tree size parameters
  */
  const maxDepthSizePair: ValidDepthSizePair = {
    // max=8 nodes
    // maxDepth: 3,
    // maxBufferSize: 8,

    // max=16,384 nodes
    maxDepth: 14,
    maxBufferSize: 64,

    // max=131,072 nodes
    // maxDepth: 17,
    // maxBufferSize: 64,

    // max=1,048,576 nodes
    // maxDepth: 20,
    // maxBufferSize: 256,

    // max=1,073,741,824 nodes
    // maxDepth: 30,
    // maxBufferSize: 2048,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;
  // const canopyDepth = 6;

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /*
    For demonstration purposes, we can compute how much space our tree will
    need to allocate to store all the records. As well as the cost to allocate
    this space (aka minimum balance to be rent exempt)
    ---
    NOTE: These are performed automatically when using the `createAllocTreeIx`
    function to ensure enough space is allocated, and rent paid.
  */

  // calculate the space available in the tree
  const requiredSpace = getConcurrentMerkleTreeAccountSize(
    maxDepthSizePair.maxDepth,
    maxDepthSizePair.maxBufferSize,
    canopyDepth,
  );

  const storageCost = await connection.getMinimumBalanceForRentExemption(requiredSpace);

  // demonstrate data points for compressed NFTs
  console.log("Space to allocate:", numberFormatter(requiredSpace), "bytes");
  console.log("Estimated cost to allocate space:", numberFormatter(storageCost / LAMPORTS_PER_SOL));
  console.log(
    "Max compressed NFTs for tree:",
    numberFormatter(Math.pow(2, maxDepthSizePair.maxDepth)),
    "\n",
  );

  // ensure the payer has enough balance to create the allocate the Merkle tree
  if (initBalance < storageCost) return console.error("Not enough SOL to allocate the merkle tree");
  printConsoleSeparator();

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /*
    Actually allocate the tree on chain
  */

  // define the address the tree will live at
  const treeKeypair = loadOrGenerateKeypair(whichCollection);

  // create and send the transaction to create the tree on chain
  const tree = await createTree(connection, payer, treeKeypair, maxDepthSizePair, canopyDepth);

  // locally save the addresses for the demo
  savePublicKeyToFile("treeAddress", tree.treeAddress);
  savePublicKeyToFile("treeAuthority", tree.treeAuthority);

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /*
    Create the actual NFT collection (using the normal Metaplex method)
    (nothing special about compression here)
  */

  // define the metadata to be used for creating the NFT collection
  const collectionMetadataV3: CreateMetadataAccountArgsV3 = {
    data: {
      name,
      symbol,
      // specific json metadata for the collection
      uri,
      sellerFeeBasisPoints,
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          share: 100,
        },
      ], // or set to `null`
      collection: null,
      uses: null,
    },
    isMutable: false,
    collectionDetails: null,
  };

  // create a full token mint and initialize the collection (with the `payer` as the authority)
  const collection = await createCollection(connection, payer, collectionMetadataV3);

  // locally save the addresses for the demo
  savePublicKeyToFile(`${whichCollection}Mint`, collection.mint);
  savePublicKeyToFile(`${whichCollection}MetadataAccount`, collection.metadataAccount);
  savePublicKeyToFile(`${whichCollection}MasterEditionAccount`, collection.masterEditionAccount);

  /**
   * INFO: NFT collection != tree
   * ---
   * NFTs collections can use multiple trees for their same collection.
   * When minting any compressed NFT, simply pass the collection's addresses
   * in the transaction using any valid tree the `payer` has authority over.
   *
   * These minted compressed NFTs should all still be apart of the same collection
   * on marketplaces and wallets.
   */

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  // fetch the payer's final balance
  balance = await connection.getBalance(payer.publicKey);

  console.log(`===============================`);
  console.log(
    "Total cost:",
    numberFormatter((initBalance - balance) / LAMPORTS_PER_SOL, true),
    "SOL\n",
  );
}