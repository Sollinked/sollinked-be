
import { base58 } from "ethers/lib/utils";
import { initializeTree } from "./src/NFT/Initializer";
import { initializeToken, mintTo } from "./src/Token";
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env')});

// for testing purposes only
(async() => {
    // await initializeToken("gold");
    console.log(process.env)
    console.log(process.env.BE_DOMAIN!)
    console.log(base58.decode(process.env.SECRET_KEY!));
})();