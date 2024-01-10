import * as userController from '../../Controllers/userController';
import * as userReservationController from '../../Controllers/userReservationController';
import * as webhookController from '../../Controllers/webhookController';
import * as clientio from 'socket.io-client';
import moment from 'moment';
import { BALANCE_ERROR_NUMBER, getAddressUSDCBalance } from '../../Token';
import { RESERVATION_STATUS_AVAILABLE, RESERVATION_STATUS_CANCELLED, RESERVATION_STATUS_CLAIMED, RESERVATION_STATUS_PAID, RESERVATION_STATUS_PENDING } from '../../Constants';
import { getServerPort, sendSOLTo } from '../../../utils';
import DB from '../../DB';

const port = getServerPort();
let socket = clientio.connect(`ws://localhost:${port}`);
const notifyPayer = (status: number, uuid?: string) => {
    // notify payer
    if(!uuid) {
        return;
    }

    if(!socket.connected) {
        return;
    }

    if(uuid && socket.connected) {
        // socket connected
        socket.emit('update_reservation_payment_status', { uuid, status });
    }
}

export const processReservationPayments = async() => {
    let reservedAfter = moment().add(-18, 'm').format('YYYY-MM-DDTHH:mm:ssZ')
    let reservations = await userReservationController.findAfter({
        status: RESERVATION_STATUS_PENDING,
    }, reservedAfter);

    // no mails
    if(!reservations) {
        let db = new DB();
        await db.log('ProcessReservationPayments', 'processReservationPayments', `No unprocessed reservations`);
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);
        
        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(tokenBalance === 0) {
            continue;
        }

        if(tokenBalance < reservation.value_usd!) {
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_PAID,
        });

        let reserve_date = moment(reservation.date).utc().format('YYYY-MM-DD HH:mm');

        await sendSOLTo(true, reservation.tiplink_public_key!, 0.003);
        
        // send notification to frontend
        notifyPayer(RESERVATION_STATUS_PAID, reservation.uuid);

        // notify recipient
        await webhookController.executeByUserId(reservation.user_id, {
            payer: reservation.reserve_email!,
            amount: tokenBalance,
            reserve_date: reserve_date + " UTC",
            reserve_title: reservation.reserve_title,
        });
    } 
}

export const processExpiredReservationPayments = async() => {
    let reservedBefore = moment().add(-20, 'm').format('YYYY-MM-DDTHH:mm:ssZ')
    let reservations = await userReservationController.findBefore({
        status: RESERVATION_STATUS_PENDING,
    }, reservedBefore);

    // no mails
    if(!reservations) {
        let db = new DB();
        await db.log('ProcessReservationPayments', 'processExpiredReservationPayments', `No unprocessed expired reservations`);
        socket.disconnect();
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        // paid
        if(tokenBalance >= reservation.value_usd!) {
            await userReservationController.update(reservation.id, {
                status: RESERVATION_STATUS_PAID,
            });

            await sendSOLTo(true, reservation.tiplink_public_key!, 0.003);
            notifyPayer(RESERVATION_STATUS_PAID, reservation.uuid);
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_CANCELLED,
        });

        // has custom price
        // create another one to replace the blocked one
        if(reservation.reservation_price) {
            await userReservationController.create({
                user_id: reservation.user_id,
                status: RESERVATION_STATUS_AVAILABLE,
                reservation_price: reservation.reservation_price,
                date: moment(reservation.date).utc().format('YYYY-MM-DDTHH:mm:ssZ'),
            });
        }
        
        notifyPayer(RESERVATION_STATUS_CANCELLED, reservation.uuid);
    }
}


export const processReservationClaims = async() => {
    let reservations = await userReservationController.find({
        status: RESERVATION_STATUS_PAID,
    });

    // no mails
    if(!reservations) {
        let db = new DB();
        await db.log('ProcessReservationPayments', 'processReservationClaims', `No unprocessed paid reservations`);
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // not claimed or errored
        if(tokenBalance === null  || tokenBalance === BALANCE_ERROR_NUMBER || tokenBalance > 0) {
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_CLAIMED,
        });
    } 
}