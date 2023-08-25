import { processEmails } from "./ProcessEmails";
import cron from 'node-cron';


export const init = () => {
    // run every 2 minutes
    // cron.schedule('*/2 * * * *', () => {
    //     processEmails();
    // });
}
