import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userReservationController from '../Controllers/userReservationController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import _ from 'lodash';

export const routes = Router();