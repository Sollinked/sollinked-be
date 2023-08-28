import { initializeTree } from "./src/NFT/Initializer";
import { initializeToken, mintTo } from "./src/Token";

// for testing purposes only
(async() => {
    await initializeToken("gold");
})();