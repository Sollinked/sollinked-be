import * as userController from '../../Controllers/userController';
import * as userReservationController from '../../Controllers/userReservationController';
import * as webhookController from '../../Controllers/webhookController';
import * as clientio from 'socket.io-client';
import moment from 'moment';
import { getAddressUSDCBalance } from '../../Token';
import { RESERVATION_STATUS_AVAILABLE, RESERVATION_STATUS_CANCELLED, RESERVATION_STATUS_CLAIMED, RESERVATION_STATUS_PAID, RESERVATION_STATUS_PENDING } from '../../Constants';
import { getServerPort } from '../../../utils';

const port = getServerPort();
let socket = clientio.connect(`ws://localhost:${port}`);
const notifyPayer = (status: number, uuid?: string) => {
    // notify payer
    if(!uuid) {
        console.log('no uuid');
    }

    if(!socket.connected) {
        console.log('socket not connected');
    }

    if(uuid && socket.connected) {
        // socket connected
        console.log('process', `emitting to ${uuid}, status = ${status}`);
        socket.emit('update_reservation_payment_status', { uuid, status });
    }
}

export 
const processReservationPayments = async() => {
    let reservedAfter = moment().add(-18, 'm').format('YYYY-MM-DDTHH:mm:ssZ')
    let reservations = await userReservationController.findAfter({
        status: RESERVATION_STATUS_PENDING,
    }, reservedAfter);

    // no mails
    if(!reservations) {
        console.log('process reservation payment', 'no unprocessed reservations');
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);
        if(tokenBalance === 0) {
            console.log('no balance yet');
            continue;
        }

        if(tokenBalance < reservation.value_usd!) {
            console.log('need more deposits');
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_PAID,
        });

        let reserve_date = moment(reservation.date).utc().format('YYYY-MM-DD HH:mm');

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
        console.log('process expired reservation payment', 'no unprocessed expired reservations');
        socket.disconnect();
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // paid
        if(tokenBalance >= reservation.value_usd!) {
            await userReservationController.update(reservation.id, {
                status: RESERVATION_STATUS_PAID,
            });
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
                date: moment(reservation.date).format('YYYY-MM-DDTHH:mm:ssZ'),
            });
        }
        
        notifyPayer(RESERVATION_STATUS_CANCELLED, reservation.uuid);
    }
}


export const processReservationClaims= async() => {
    let reservations = await userReservationController.find({
        status: RESERVATION_STATUS_CLAIMED,
    });

    // no mails
    if(!reservations) {
        console.log('process reservation claim', 'no unprocessed paid reservations');
        return;
    }

    for(const [index, reservation] of reservations.entries()) {
        let tokenBalance = await getAddressUSDCBalance(reservation.tiplink_public_key!);

        // not claimed
        if(tokenBalance > 0) {
            continue;
        }

        await userReservationController.update(reservation.id, {
            status: RESERVATION_STATUS_CLAIMED,
        });
    } 
}