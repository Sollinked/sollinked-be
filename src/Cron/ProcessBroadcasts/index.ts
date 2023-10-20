import { getMailCredentials } from '../../../utils';
import * as mailingListBroadcastController from '../../Controllers/mailingListBroadcastController';
import * as mailingListBroadcastLogController from '../../Controllers/mailingListBroadcastLogController';
import * as userController from '../../Controllers/userController';
import moment from 'moment';
import { sendEmail } from '../../Mail';

export const processBroadcasts = async() => {
    let credentials = getMailCredentials();
    let broadcasts = await mailingListBroadcastLogController.getUniquePendingBroadcastIds();
    if(!broadcasts || broadcasts.length === 0) {
        return;
    }

    let now = moment();

    for(const [, broadcastObject] of broadcasts.entries()) {
        let broadcast_id = broadcastObject.mailing_list_broadcast_id;
        let broadcast = await mailingListBroadcastController.view(broadcast_id);
        if(!broadcast) {
            console.log("Missing broadcast object");
            return;
        }
    
        if(broadcast.is_executing) {
            // console.log("Broadcast is still ongoing");
            return;
        }
        
        await mailingListBroadcastController.update(broadcast_id, { is_executing: true });
    
        let logs = await mailingListBroadcastLogController.getDistinctEmailsForBroadcastId(broadcast_id);
        if(!logs || logs.length === 0) {
            console.log("Missing logs");
            return;
        }
    
        let user = await userController.view(broadcast.user_id);
        if(!user) {
            console.log("Missing user");
            return;
        }
        
        // dont use foreach to prevent spamming the server
        for(const [index, log] of logs.entries()) {
            let isSuccess = await sendEmail({
                to: log.to_email,
                from: `${user.username}@${credentials.domain}`,
                subject: broadcast.title,
                textAsHtml: broadcast.content,
            });
    
            if(!isSuccess) {
                await mailingListBroadcastLogController.update(log.id, { retry_count: log.retry_count + 1 })
                continue;
            }
            await mailingListBroadcastLogController.update(log.id, { is_success: true, success_at: moment().format('YYYY-MM-DDTHH:mm:ssZ') })
        }
    
        await mailingListBroadcastController.update(broadcast_id, { is_executing: false, execute_at: moment().format('YYYY-MM-DDTHH:mm:ssZ') });
    }
}