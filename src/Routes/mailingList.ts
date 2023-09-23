import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailingListController from '../Controllers/mailingListController';
import * as mailingListPriceTierController from '../Controllers/mailingListPriceTierController';
import * as mailingListSubscriberController from '../Controllers/mailingListSubscriberController';
import axios from 'axios';

export const routes = Router();
routes.post('/', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    let users = await userController.find({ address: data.address });
    if(!users || users.length === 0) {
        return res.status(404).send("Missing user");
    }

    let user = users[0];
    // create product in sphere
    let product = null;

    try {
        let productRes = await axios.post('https://api.spaherepay.co/v1/product', {
            name: `${user.display_name ?? user.username}'s Mail Subscription`,
            description: `Receive emails from ${user.display_name ?? user.username} as long as you're subscribed to this product.`,
        });
    
        if(!productRes.data.ok || !productRes.data.data || !productRes.data.data.product) {
            return res.status(500).send("Unable to create product");
        }

        product = productRes.data.data.product;
    }

    catch {
        return res.status(500).send("Unable to create product");
    }
    
    let result = await mailingListController.create({
        user_id: user.id,
        product_id: product.id,
    });

    if(!result) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
    });
});

// update pricelist
routes.post('/priceList', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    if(!data.prices) {
        return res.status(400).send("Invalid params");
    }

    let users = await userController.find({ address: data.address });
    if(!users || users.length === 0) {
        return res.status(404).send("Missing user");
    }

    let user = users[0];
    // create product in sphere

    let lists = await mailingListController.find({ user_id: user.id });
    if(!lists || lists.length === 0) {
        return res.status(404).send("Missing mailing list");
    }

    let product = null;
    let list = lists[0];
    const USDC_ADDRESS = process.env.USDC_ADDRESS! as string;
    // const USDC_DECIMALS = 1000000;

    await Promise.all(
        data.prices.map(async(price: any) => {
            // dont need to update
            if(price.id) {
                await mailingListPriceTierController.update(price.id, { 
                    name: price.name, 
                    description: price.description, 
                    is_active: price.is_active 
                });
                return;
            }

            let priceRet = null;
    
            try {
                let priceRes = await axios.post('https://api.spaherepay.co/v1/price', {
                    name: `${user.display_name ?? user.username}'s Mail Subscription`,
                    description: `Receive emails from ${user.display_name ?? user.username} as long as you're subscribed to this product.`,
                    product: list.product_id,
                    type: "recurring",
                    currency: USDC_ADDRESS,
                    network: "sol",
                    taxBehavior: "exclusive",
                    billingSchema: "perUnit",
                    //unitAmount: (price.amount * USDC_DECIMALS).toString(), // 500000000
                    unitAmountDecimal: price.amount.toString(), // 5
                    //tierType: null,
                    //tiers: null,
                    recurring: {
                        type: "delegate",
                        interval: "month",
                        intervalCount: price.charge_every, // per month
                        usageAggregation: "sum",
                        usageType: "licensed",
                        defaultLength: price.prepay_month,
                        // usageDefaultQuantity: "",
                    }
                });
            
                if(!priceRes.data.ok || !priceRes.data.data || !priceRes.data.data.price) {
                    console.log('unable to create price');
                    return;
                }
        
                priceRet = priceRes.data.data.price;
            }
        
            catch {
                console.log('unable to create price');
                return;
            }
            
            await mailingListPriceTierController.create({ 
                mailing_list_id: list.id,
                price_id: priceRet.id, // id from sphere
                name: price.name, 
                description: price.description, 
                amount: price.amount,
                currency: USDC_ADDRESS,
                charge_every: price.charge_every,
                prepay_month: price.prepay_month,
             });
        })
    )

    return res.send({
        success: true,
        message: "Success",
    });
});

// for webhook
routes.post('/subscribe', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.data) {
        return res.status(400).send("Invalid params");
    }

    let users = await userController.find({ address: data.address });
    if(!users || users.length === 0) {
        return res.status(404).send("Missing user");
    }

});