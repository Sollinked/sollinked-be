import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as contentPassController from '../Controllers/contentPassController';
import * as contentPaymentController from '../Controllers/contentPaymentController';
import * as contentCNFTController from '../Controllers/contentCNFTController';
import { createContentPass, getAdminAccount, getContentFee, getDappDomain, getTokensTransferredToUser, sendTokensTo, sleep } from '../../utils';
import { USDC_ADDRESS, USDC_DECIMALS } from '../Constants';
import { UNLIMITED_PASS } from '../Models/contentPass';


const {
    contentCreatorFee,
    contentCreatorRatio,
} = getContentFee();

export const routes = Router();
routes.post('/', async(req, res) => {
    let data = req.body;
    let { address, name, description, amount, value_usd } = data;

    if(!data || !address || !name || !description) {
        return res.status(400).send("Invalid Params");
    }

    if(amount && amount < 0 && amount !== UNLIMITED_PASS) {
        return res.status(400).send("Invalid Params");
    }

    if(value_usd && value_usd < 0) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let contentPassRes = await contentPassController.create({
        user_id: user.id,
        name,
        description,
        amount,
        value_usd,
    });

    if(!contentPassRes) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
        data: contentPassRes.id,
    });
});

routes.post('/update/:id', async(req, res) => {
    let data = req.body;
    let { address, name, description, amount, value_usd } = data;
    let { id } = req.params;

    if(!data || !address || !name || !description || !id) {
        return res.status(400).send("Invalid Params");
    }

    if(amount && amount < 0 && amount !== UNLIMITED_PASS) {
        return res.status(400).send("Invalid Params");
    }

    if(value_usd && value_usd < 0) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let idNum = Number(id);
    let contentPass = await contentPassController.view(idNum);
    if(!contentPass) {
        return res.status(404).send("Unable to find content pass");
    }

    if(contentPass.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }

    await contentPassController.update(idNum, {
        user_id: user.id,
        name,
        description,
        amount,
        value_usd,
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/payment/:id', async(req, res) => {
    let data = req.body;
    let { txHash, address } = data;
    let { id } = req.params;

    if(!data || !id || !txHash || !address) {
        return res.status(400).send("Invalid Params");
    }
    // create payment history as record only
    let paymentRes = await contentPaymentController.find({
        tx_hash: txHash,
    });

    if(paymentRes && paymentRes.length > 0){
        return res.status(400).send("Tx has already been processed.");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }
    
    let adminAccount = getAdminAccount();
    let retries = 0;
    let amount = 0;
    let valueUsd = 0;

    while(retries < 10) {
        try {
            valueUsd = await getTokensTransferredToUser(txHash, adminAccount.publicKey.toBase58(), USDC_ADDRESS);
            amount = valueUsd * contentCreatorRatio; // 95%
            // break while loop
            break;
        }

        catch (e: any){
            if(e.message === "Old Tx") {
                return res.status(400).send("Old Tx");
            }
            retries++;
            await sleep(2000); //sleep 2s
            continue;
        }
    }

    if(retries >= 10) {
        //refund
        return res.status(500).send("Server Error");
    }

    const refund = async(id?: number) => {
        await sendTokensTo(user!.address, USDC_ADDRESS, USDC_DECIMALS, valueUsd);
        if(id) {
            await contentCNFTController.deleteById(id);
        }
    }

    let contentPass = await contentPassController.view(Number(id));
    if(!contentPass) {
        await refund();
        return res.status(404).send("Unable to find content pass.");
    }

    let mintedCount = await contentCNFTController.find({ content_pass_id: contentPass.id });
    if(mintedCount && mintedCount.length >= contentPass.amount && contentPass.amount > 0) {
        await refund();
        return res.status(400).send("Sold out");
    }

    let cNftRes = await contentCNFTController.create({
        content_pass_id: contentPass.id,
    });

    if(!cNftRes || !cNftRes.id) {
        await refund();
        return res.status(500).send("Unable to mint");
    }


    let contentCreator = await userController.view(contentPass.user_id);
    if(!contentCreator) {
        await refund(cNftRes.id);
        return res.status(404).send("Unable to find user.");
    }

    if(valueUsd < contentPass.value_usd) {
        await refund(cNftRes.id);
        return res.status(400).send("Paid wrong amount");
    }

    // create payment history as record only
    await contentPaymentController.create({
        user_id: user.id,
        content_id: id,
        value_usd: valueUsd,
        tx_hash: txHash,
        type: "pass",
    });

    // might need to change to background process
    if(amount > 0) {
        let passRes = await createContentPass({
            image: contentCreator.profile_picture ?? getDappDomain() + "/logo.png",
            receiverAddress: user.address,
            attributes: {
                "Content Creator": contentCreator.username,
                "Type": contentPass.name
            },
        });

        if(!passRes || !passRes.mintAddress) {
            console.log('Unable to mint pass, below is passRes');
            console.log('----');
            console.log(passRes);
            console.log('----');
            await refund(cNftRes.id);
            return res.status(500).send("Unable to mint pass!")
        }

        // send usdc to the content creator
        await sendTokensTo(contentCreator.address, USDC_ADDRESS, USDC_DECIMALS, amount);

        // create a log in db
        let { mintAddress, nftId } = passRes;
        await contentCNFTController.update(cNftRes.id, {
            mint_address: mintAddress,
            nft_id: nftId,
            content_pass_id: contentPass.id,
        });
    }

    return res.send({
        success: true,
        message: "Success",
    });
});