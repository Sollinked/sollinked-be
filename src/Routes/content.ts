import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as contentController from '../Controllers/contentController';
import * as contentPaymentController from '../Controllers/contentPaymentController';
import * as contentCNFTController from '../Controllers/contentCNFTController';
import * as contentProductIdController from '../Controllers/contentProductIdController';
import { createSpherePaymentLink, createSpherePrice, createSphereProduct, getAddressNftDetails, getAdminAccount, getContentFee, getContentPassCollectionAddress, getSphereWalletId, getTokensTransferredToUser, sendTokensTo, sleep } from '../../utils';
import moment from 'moment';
import { USDC_ADDRESS, USDC_DECIMALS } from '../Constants';
import { v4 as uuidv4 } from 'uuid';

const {
    contentCreatorFee,
    contentCreatorRatio,
} = getContentFee()
export const routes = Router();
routes.post('/', async(req, res) => {
    let data = req.body;
    let { address, title, description, content, value_usd, status, content_pass_ids } = data;

    if(!data || !address || !title || !description || !content_pass_ids || !status) {
        return res.status(400).send("Invalid Params");
    }

    if(status !== "draft" && status !== "published") {
        return res.status(400).send("Invalid status");
    }

    if(!Array.isArray(content_pass_ids)) {
        return res.status(400).send("Invalid Params");
    }

    if(value_usd && value_usd < 0) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let uuid = uuidv4().split("-")[0];
    let slug = title.replace(/\s/g, "-").replace(/[^a-zA-Z0-9 ]/g, "") + "-" + uuid;

    // from sphere
    let sphereProductId = user.contentProductId;
    if(!sphereProductId) {
        let name = `${user.display_name ?? user.username}'s Blog Access`;
        let description = `Gives access to ${user.display_name ?? user.username} blogs`;
        let productRes = await createSphereProduct(
            name,
            description,
        );

        if(!productRes) {
            return res.status(500).send("Unable to create product");
        }

        sphereProductId = productRes.product.id;
        await contentProductIdController.create({ user_id: user.id, content_product_id: sphereProductId });
    }

    let is_free = value_usd === 0;
    let paymentLinkId = null;
    if(!is_free) {
        let name = `${user.display_name ?? user.username}'s Blog Access`;
        let description = `Gives access to ${user.display_name ?? user.username} blogs`;
        let { contentCreatorFee } = getContentFee();
        let priceRet = await createSpherePrice(
            name,
            description,
            sphereProductId!.content_product_id,
            "oneTime",
            USDC_ADDRESS,
            (value_usd * contentCreatorFee).toFixed(5)
        );

        if(!priceRet) {
            return res.status(500).send("Unable to create price");
        }

        let priceId = priceRet.id;
        let wallets: {
            id: string,
            shareBps: number,
        }[] = [
            {
                id: getSphereWalletId(),
                shareBps: 10000, // we will process it ourselves
            }
        ];

        let paymentLinkRet = await createSpherePaymentLink(
            priceId,
            wallets,
        )

        if(!paymentLinkRet) {
            return res.status(500).send("Unable to create payment link");
        }

        paymentLinkId = paymentLinkRet.id;
    }

    let contentRes = await contentController.create({
        user_id: user.id,
        title,
        slug,
        description,
        content_pass_ids,
        content: content ?? "",
        is_free,
        value_usd,
        status,
        paymentlink_id: paymentLinkId,
    });

    if(!contentRes) {
        return res.status(500).send("Unable to save draft");
    }

    return res.send({
        success: true,
        message: "Success",
        data: contentRes.id,
    });
});

// cannot update status
// use publish / unpublish instead
routes.post('/update/:id', async(req, res) => {
    let data = req.body;
    let { address, title, description, content: userContent, value_usd, content_pass_ids } = data;
    let { id } = req.params;

    if(!data || !address || !title || !content_pass_ids || !id) {
        return res.status(400).send("Invalid Params");
    }

    if(!Array.isArray(content_pass_ids)) {
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
    let content = await contentController.view(idNum);
    if(!content) {
        return res.status(404).send("Unable to find content pass");
    }

    if(content.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }

    let slug = content.slug;

    // only change slug if the title changed
    if(title !== content.title) {
        let uuid = uuidv4().split("-")[0];
        slug = title.replace(/\s/g, "-").replace(/[^a-zA-Z0-9 ]/g, "") + "-" + uuid;
    }

    let sphereProductId = user.contentProductId;
    if(!sphereProductId) {
        let name = `${user.display_name ?? user.username}'s Blog Access`;
        let description = `Gives access to ${user.display_name ?? user.username} blogs`;
        let productRes = await createSphereProduct(
            name,
            description,
        );

        if(!productRes) {
            return res.status(500).send("Unable to create product");
        }

        sphereProductId = productRes.product.id;
        await contentProductIdController.create({ user_id: user.id, content_product_id: sphereProductId });
    }

    let is_free = value_usd === 0;
    let paymentLinkId = null;
    if(!is_free && content.value_usd !== value_usd && value_usd) {
        let name = `${user.display_name ?? user.username}'s Blog Access`;
        let description = `Gives access to ${user.display_name ?? user.username} blogs`;
        let { contentCreatorFee } = getContentFee();
        let priceRet = await createSpherePrice(
            name,
            description,
            sphereProductId!.content_product_id,
            "oneTime",
            USDC_ADDRESS,
            (value_usd * contentCreatorFee).toFixed(5)
        );

        if(!priceRet) {
            return res.status(500).send("Unable to create price");
        }

        let priceId = priceRet.id;
        let wallets: {
            id: string,
            shareBps: number,
        }[] = [
            {
                id: getSphereWalletId(),
                shareBps: 10000, // we will process it ourselves
            }
        ];

        let paymentLinkRet = await createSpherePaymentLink(
            priceId,
            wallets,
        )

        if(!paymentLinkRet) {
            return res.status(500).send("Unable to create payment link");
        }

        paymentLinkId = paymentLinkRet.id;
    }

    await contentController.update(idNum, {
        user_id: user.id,
        title,
        slug,
        description,
        content_pass_ids,
        content: userContent ?? "",
        is_free,
        value_usd,
        paymentlink_id: paymentLinkId,
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/publish/:id', async(req, res) => {
    let data = req.body;
    let { address } = data;
    let { id } = req.params;

    if(!data || !address || !id) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let idNum = Number(id);
    let content = await contentController.view(idNum);
    if(!content) {
        return res.status(404).send("Unable to find content pass");
    }

    if(content.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }

    await contentController.update(idNum, {
        status: "published",
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/unpublish/:id', async(req, res) => {
    let data = req.body;
    let { address } = data;
    let { id } = req.params;

    if(!data || !address || !id) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let idNum = Number(id);
    let content = await contentController.view(idNum);
    if(!content) {
        return res.status(404).send("Unable to find content pass");
    }

    if(content.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }
    
    await contentController.update(idNum, {
        status: "draft",
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/draft/:id', async(req, res) => {
    let data = req.body;
    let { id } = req.params;

    if(!data || !id) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let idNum = Number(id);
    let content = await contentController.view(idNum);
    if(!content) {
        return res.status(404).send("Unable to find content pass");
    }

    if(content.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }

    return res.send({
        success: true,
        message: "Success",
        data: content,
    });
});

routes.post('/payment/:id', async(req, res) => {
    let data = req.body;
    let { txHash, address } = data;
    let { id } = req.params;

    if(!data || !id || !txHash || !address) {
        return res.status(400).send("Invalid Params");
    }

    let content = await contentController.view(Number(id));
    if(!content) {
        return res.status(404).send("Unable to find content.");
    }

    if(content.is_free) {
        return res.status(400).send("This content is free.");
    }

    let contentCreator = await userController.view(content.user_id);
    if(!contentCreator) {
        return res.status(404).send("Unable to find user.");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let adminAccount = getAdminAccount();
    let retries = 0;
    let amount = 0;

    while(retries < 10) {
        try {
            let valueUsd = await getTokensTransferredToUser(txHash, adminAccount.publicKey.toBase58(), USDC_ADDRESS);

            if(valueUsd < (Math.round(content.value_usd * contentCreatorFee * 1e6) / 1e6)) {
                return res.status(400).send("Paid wrong amount");
            }

            // create payment history
            await contentPaymentController.create({
                user_id: user.id,
                content_id: Number(id),
                value_usd: valueUsd,
                tx_hash: txHash,
                type: "single"
            });

            // make sure we only send the % of the value instead of using content's value_usd to prevent sending values exceeding the tx's value
            amount = Math.round(valueUsd * contentCreatorRatio * 1e6) / 1e6; // 95%
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
        return res.status(500).send("Server Error");
    }

    if(amount > 0) {
        // send usdc to the content creator
        await sendTokensTo(contentCreator.address, USDC_ADDRESS, USDC_DECIMALS, amount);
    }

    return res.send({
        success: true,
        message: "Success",
    });
});

// public routes
// get all published by user
routes.get('/:username', async(req, res) => {
});

// need the address and signature to get the user to see if they have access to the content
routes.post('/public/:username/:slug', async(req, res) => {
    let data = req.body;
    let { address } = data;
    let { username, slug } = req.params;

    if(!data || !username || !slug) {
        return res.status(400).send("Invalid Params");
    }

    let contentCreator = await userController.viewByUsername(username);
    if(!contentCreator) {
        return res.status(404).send("Unable to find user");
    }

    let contents = await contentController.find({ slug, status: 'published' });
    if(!contents || contents.length === 0) {
        return res.status(404).send("Unable to find content");
    }

    let user = await userController.findByAddress(address);

    let content = contents[0];
    let canRead = content.is_free || content.user_id === user?.id;

    // not free to read
    if(!canRead && address) {
        let user = await userController.findByAddress(address);
        if(!user) {
            return res.status(404).send("Unable to find user");
        }
        let payment = await contentPaymentController.find({ user_id: user.id, content_id: content.id, type: "single" });
        canRead = !!payment && payment.length > 0;
    }

    // didn't pay for content, check if they have pass
    if(!canRead && address) {
        let allowedPasses = await contentCNFTController.find({ content_pass_id: content.content_pass_ids });

        if(!allowedPasses || allowedPasses.length === 0) {
            canRead = false;
        }

        if(allowedPasses) {
            let addressCNFTs = await getAddressNftDetails(true, address);
            if(addressCNFTs.items.length > 0) {
                let collectionMintAddress = getContentPassCollectionAddress();
                let addressContentPasses = addressCNFTs.items.filter(x => x.grouping.length > 0 && x.grouping[0].group_value === collectionMintAddress);
                let contentPassMintAddresses = addressContentPasses.map(x => x.id);
                let allowedPassMintAddresses = allowedPasses.filter(x => x.mint_address).map(x => x.mint_address);
                for(const [index, value] of contentPassMintAddresses.entries()) {
                    canRead = allowedPassMintAddresses.includes(value);
                    if(canRead) break;
                }
            }
        }
    }

    // truncate content
    if(!canRead) {
        content.content = "";
    }

    return res.send({
        success: true,
        message: "Success",
        data: content,
    });
});