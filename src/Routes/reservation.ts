import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userReservationController from '../Controllers/userReservationController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import _ from 'lodash';
import { RESERVATION_STATUS_AVAILABLE, RESERVATION_STATUS_CLAIMED, RESERVATION_STATUS_PAID, RESERVATION_STATUS_PENDING, VERIFY_MESSAGE } from '../Constants';
import { verifySignature } from '../../utils';
import moment from 'moment';
import { TipLink } from '@tiplink/api';
import { v4 as uuidv4 } from 'uuid';

export const routes = Router();

// get reservations
routes.get('/:username', async(req, res) => {
    let { username } = req.params;

    if(!username) {
        return res.status(400).send("No data");
    }

    let user = await userController.viewByUsername(username);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }


    let reservations = await userReservationController.findByUsername(user.id, true);
    let settings = await userReservationSettingController.find({ user_id: user.id });

    return res.send({
        success: true,
        message: "Success",
        data: {
            reservations,
            settings,
            display_name: user.display_name ?? "",
            calendar_advance_days: user.calendar_advance_days,
        },
    });
});

// update reservation
routes.post('/update', async(req, res) => {
    let data = req.body;
    let {address, signature, message, date, status} = data;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!address || !signature || !date || status === undefined ) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    // cant save address
    data = _.omit(data, ['address', 'signature']);

    if(Object.keys(data).length === 0){
        return res.status(400).send("No new updates");
    }

    let users = await userController.find({ address });
    if(!users || users.length === 0) {
        return res.status(404).send("Unable to find user");
    }

    let user_id = users[0].id;
    let reservations = await userReservationController.find({ date: moment(data.date).utc().format('YYYY-MM-DDTHH:mm:ssZ') });

    if(!reservations || reservations.length === 0) {
        await userReservationController.create({
            user_id,
            date: moment(data.date).utc().format('YYYY-MM-DDTHH:mm:ssZ'),
            reservation_price: data.reservation_price ?? 0,
            status
        });

        return res.send({
            success: true,
            message: "Success",
        });
    }

    // date is currently being booked / booked
    if(reservations[0].status > RESERVATION_STATUS_AVAILABLE) { 
        return res.status(400).send("Slot is uneditable");
    }

    await userReservationController.update(reservations[0].id, {
        date: moment(data.date).utc().format('YYYY-MM-DDTHH:mm:ssZ'),
        reservation_price: data.reservation_price ?? 0,
        status
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

// create reservation
routes.post('/new/:username', async(req, res) => {
    let { date, title, email } = req.body;
    let { username } = req.params;

    if(!username) {
        return res.status(400).send("No data");
    }

    if(!date) {
        return res.status(400).send("Invalid Params");
    }

    let user = await userController.viewByUsername(username);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    let utcDateStr = moment(date).utc().format('YYYY-MM-DDTHH:mm:ssZ');

    let reservations = await userReservationController.find({
        user_id: user.id,
        date: utcDateStr,
    });

    let day = moment(date).utc().day();
    let hour = moment(date).utc().hour();

    let settings = await userReservationSettingController.find({ user_id: user.id, day, hour });
    let presetPrice = settings?.[0]?.reservation_price ?? 0;
    let uuid = uuidv4();

    // if has custom reservation
    if(reservations && reservations.length > 0) {
        if(reservations[0].status !== RESERVATION_STATUS_AVAILABLE) {
            return res.status(400).send("Date is unavailable");
        }
        let value_usd = Number(reservations[0].reservation_price ?? presetPrice);
        let tiplinkUrl = "";
        let tiplinkKey = "";

        if(value_usd > 0) {
            let tiplink = await TipLink.create();
            tiplinkUrl = tiplink.url.toString();
            tiplinkKey = tiplink.keypair.publicKey.toBase58();
        }
        await userReservationController.update(reservations[0].id, { 
            value_usd,
            tiplink_url: tiplinkUrl,
            tiplink_public_key: tiplinkKey,
            reserved_at: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
            reserve_email: email ?? "",
            reserve_title: title ?? "",
            status: value_usd === 0? RESERVATION_STATUS_CLAIMED : RESERVATION_STATUS_PENDING,
            uuid,
        });

        return res.send({
            success: true,
            message: "Success",
            data: {
                public_key: tiplinkKey,
                value_usd,
                uuid,
            },
        });
    }

    // use preset
    if(!settings || settings.length === 0) {
        return res.status(404).send("Unable to find preset date");
    }

    let tiplinkUrl = "";
    let tiplinkKey = "";

    if(presetPrice > 0) {
        let tiplink = await TipLink.create();
        tiplinkUrl = tiplink.url.toString();
        tiplinkKey = tiplink.keypair.publicKey.toBase58();
    }
    await userReservationController.create({ 
        user_id: user.id, 
        date: utcDateStr, 
        value_usd: presetPrice,
        tiplink_url: tiplinkUrl,
        tiplink_public_key: tiplinkKey,
        reserved_at: moment().format('YYYY-MM-DDTHH:mm:ssZ'),
        reserve_email: email ?? "",
        reserve_title: title ?? "",
        status: presetPrice > 0? RESERVATION_STATUS_PENDING : RESERVATION_STATUS_CLAIMED,
        uuid,
    });
    return res.send({
        success: true,
        message: "Success",
        data: {
            public_key: tiplinkKey,
            value_usd: presetPrice,
            uuid,
        },
    });
});