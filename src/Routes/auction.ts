import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as mailController from '../Controllers/mailController';
import * as mailAuctionController from '../Controllers/mailAuctionController';
import * as mailBidController from '../Controllers/mailBidController';
import { TipLink } from '@tiplink/api';
import { isValidMail } from '../../utils';
import moment from 'moment';

export const routes = Router();
routes.get('/live', async(req, res) => {
    // only live auctions
    let mailAuctions = await mailAuctionController.live();

    return res.send({
        success: true,
        message: "Success",
        data: mailAuctions,
    });
});

routes.get('/:id', async(req, res) => {
    let { id } = req.params;
    if(!id) {
        return res.status(400).send("No id");
    }

    let mailAuction = await mailAuctionController.publicView(Number(id));

    return res.send({
        success: true,
        message: "Success",
        data: mailAuction,
    });
});

routes.post('/previousBid/:id', async(req, res) => {
    let { address } = req.body;
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let { id } = req.params;
    if(!id) {
        return res.status(400).send("No id");
    }

    let bid = await mailBidController.getUserMailBidByAuctionId(Number(user.id), Number(id));

    return res.send({
        success: true,
        message: "Success",
        data: bid,
    });
});

routes.post('/', async(req, res) => {
    let { start_date, end_date, min_bid, address } = req.body;
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let mailAuctionId = await mailAuctionController.create({
        start_date: moment(start_date * 1000).toISOString(),
        end_date: moment(end_date * 1000).toISOString(),
        min_bid: min_bid,
        user_id: user.id,
    });

    return res.send({
        success: true,
        message: "Success",
        data: mailAuctionId,
    });
});

routes.post('/update/:id', async(req, res) => {
    let { start_date, end_date, min_bid, address } = req.body;
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let { id } = req.params;
    if(!id) {
        return res.status(400).send("Invalid id");
    }

    let auction = await mailAuctionController.view(Number(id));
    if(!auction) {
        return res.status(404).send("Unable to find auction");
    }

    if(auction.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    if(moment(auction.end_date).isBefore(moment())) {
        return res.status(400).send("Auction ended");
    }

    await mailAuctionController.update(auction.id, {
        start_date: moment(start_date * 1000).toISOString(),
        end_date: moment(end_date * 1000).toISOString(),
        min_bid: min_bid,
    })

    return res.send({
        success: true,
        message: "Success",
        data: "",
    });
});

routes.post('/delete/:id', async(req, res) => {
    let { address } = req.body;
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let { id } = req.params;
    if(!id) {
        return res.status(400).send("Invalid id");
    }

    let auction = await mailAuctionController.view(Number(id));
    if(!auction) {
        return res.status(404).send("Unable to find auction");
    }

    if(auction.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }

    if(moment(auction.end_date).isBefore(moment())) {
        return res.status(400).send("Auction ended");
    }

    await mailAuctionController.softDelete(Number(id));

    return res.send({
        success: true,
        message: "Success",
        data: "",
    });
});

routes.post('/bid/:id', async(req, res) => {
    let data = req.body;
    let { address, subject, emailMessage, bidderEmail } = data;

    if(!data) {
        return res.status(400).send("Invalid Params");
    }

    let fromUser = await userController.findByAddress(address)
    if(!fromUser) {
        return res.status(401).send("Unauthorized");
    }

    let fromEmail = (bidderEmail as string) || fromUser.email_address;
    if(!fromEmail || !isValidMail(fromEmail)) {
        return res.status(400).send("Invalid email address");
    }

    let { id } = req.params;
    if(!id) {
        return res.status(400).send("No id");
    }

    let mailAuction = await mailAuctionController.view(Number(id));
    if(!mailAuction) {
        return res.status(404).send("Cant find auction");
    }

    if(moment(mailAuction.end_date).isBefore(moment())) {
        return res.status(400).send("Auction ended");
    }

    let mailBid = await mailBidController.findByUserIdAndAuctionId(fromUser.id, mailAuction.id);

    let depositTo = mailBid?.tiplink_public_key ?? "";
    if(!mailBid || !depositTo) {
        const tiplink = await TipLink.create();
        depositTo = tiplink.keypair.publicKey.toBase58();

        let result = await mailBidController.create({
            auction_id: mailAuction.id,
            user_id: fromUser.id,
            tiplink_url: tiplink.url.toString(),
            tiplink_public_key: depositTo,
            value_usd: 0,
            subject,
            message: emailMessage,
            email: fromEmail,
        });

        if(!result) {
            return res.status(500).send("Server Error");
        }
    }

    else {
        await mailBidController.update(mailBid.id, {
            subject,
            message: emailMessage,
            email: fromEmail,
        });
    }

    return res.send({
        success: true,
        message: "Success",
        data: depositTo,
    });
});