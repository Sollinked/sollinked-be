import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as contentController from '../Controllers/contentController';
import * as contentPaymentController from '../Controllers/contentPaymentController';
import { getAdminAccount, getTokensTransferredToUser, sendTokensTo, sleep } from '../../utils';
import moment from 'moment';
import { USDC_ADDRESS, USDC_DECIMALS } from '../Constants';
import { v4 as uuidv4 } from 'uuid';

const CONTENT_FEE = (Number(process.env.PAYMENT_CONTENT_FEE ?? '0') / 100) + 1; // eg 1.05
const contentCreatorRatio = 1 / CONTENT_FEE;
export const routes = Router();
routes.post('/', async(req, res) => {
    let data = req.body;
    let { address, title, description, content, value_usd, is_free, status, content_pass_ids } = data;

    if(!data || !address || !title || !description || !content_pass_ids || !is_free || !status) {
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
    let slug = title.replace(/\s/g, "-") + "-" + uuid;

    await contentController.create({
        user_id: user.id,
        title,
        slug,
        description,
        content_pass_ids,
        content: content ?? "",
        is_free,
        value_usd,
        status,
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/update/:id', async(req, res) => {
    let data = req.body;
    let { address, title, description, content, value_usd, is_free, status, content_pass_ids } = data;
    let { id } = req.params;

    if(!data || !address || !title || !description || !content_pass_ids || !is_free || !status || !id) {
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

    let idNum = Number(id);
    let contentPass = await contentController.view(idNum);
    if(!contentPass) {
        return res.status(404).send("Unable to find content pass");
    }

    if(contentPass.user_id != user.id) {
        return res.status(401).send("Unauthorized");
    }

    let uuid = uuidv4().split("-")[0];
    let slug = title.replace(/\s/g, "-") + "-" + uuid;

    await contentController.update(idNum, {
        user_id: user.id,
        title,
        slug,
        description,
        content_pass_ids,
        content: content ?? "",
        is_free,
        value_usd,
        status,
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
            if(valueUsd < content.value_usd) {
                return res.status(400).send("Paid wrong amount");
            }

            // create payment history
            await contentPaymentController.create({
                user_id: user.id,
                content_id: content.id,
                value_usd: valueUsd,
                tx_hash: txHash,
                type: "single"
            });

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

routes.get('/:username/:slug', async(req, res) => {
});