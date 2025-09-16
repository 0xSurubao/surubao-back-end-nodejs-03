// base
import { Express, Request, Response } from "express";

// third
import { WriteResult } from "firebase-admin/firestore";

// from project
import { _pushNotificationService } from "../../../features/push-notification-service/push-notification-service";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../../features/firebase-admin/firebase-admin';
import { _mailService } from "../../../features/mail-service/mail-service";
import { AnimalService } from "../../../features/animals-service/animals-service";
import { StoreService } from "../../../features/store-service/store-service";
import { PaymentService } from "../../../features/payment-service/payment-service";
import { WithdrawService } from "../../../features/withdraw-service/withdraw-service";
import { _incomesService } from "../../../features/incomes-service/incomes-service";
import { _usersService } from "../../../features/users-service/users-service";


export default class AdminToolsRoute
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        baseExpressApp.post('/admin/v1/tools/incomes', async (request: Request, response: Response) =>
        {
            // const authHeader = request.headers['authorization'];
            const requestBody = request.body as IncomesPostRequestBody;

            let responseStatus = 200;
            let responseObject: IncomesPostResponseBody = { Success: false, Errors: [], }

            try
            {
                let adminId = 'UNDEFINED-ID';
                let userId: string | undefined = undefined;

                if (requestBody.UserName)
                {
                    let usernameDoc = await _usersService.GetUsernameDoc(requestBody.UserName);

                    if (usernameDoc)
                        userId = usernameDoc.OwnerId;
                }

                if (userId)
                {
                    await _incomesService.AddAdminIncome(
                        userId,
                        requestBody.IncomeValue,
                        adminId);
                }
                else
                {
                    console.error(
                        '$$$ > ' +
                        'ERROR trying to POST on [API]/admin/v1/tools/incomes' + '\n' +
                        'USER NOT FOUN!' + '\n' +
                        'requestBody.UserName = ',
                        requestBody.UserName,
                    )

                    responseStatus = 404;
                    responseObject.Errors.push('user-not-found')
                }
            }
            catch (error)
            {
                console.error(
                    '$$$ > ' +
                    'ERROR trying to PATCH on [API]/admin/v1/withdraw-register' + '\n' +
                    'error = ', error,
                )

                responseStatus = 500;
            }

            response.status(responseStatus).send(responseObject);
        })

        baseExpressApp.post('/admin/v1/tools/animals', async (request: Request, response: Response) =>
        {
            // const authHeader = request.headers['authorization'];
            const requestBody = request.body as AddAnimalsPostRequestBody;

            let responseStatus = 500;
            let responseObject: AddAnimalsPostResponseBody = { Success: false, Errors: [], }

            try
            {
                let adminId = 'UNDEFINED-ID';
                let userId: string | undefined = undefined;

                if (requestBody.UserName)
                {
                    let usernameDoc = await _usersService.GetUsernameDoc(requestBody.UserName);

                    if (usernameDoc)
                        userId = usernameDoc.OwnerId;
                }

                if (userId)
                {
                    await AnimalService.AddAnimalByAdmin(
                        userId,
                        requestBody.AnimalType,
                        adminId,
                        requestBody.IgnoreSlotsLimitation,
                        requestBody.IgnoreComissions,
                    );

                    responseStatus = 200;
                }
                else
                {
                    console.error(
                        '$$$ > ' +
                        'ERROR trying to POST on [API]/admin/v1/tools/incomes' + '\n' +
                        'USER NOT FOUN!' + '\n' +
                        'requestBody.UserName = ',
                        requestBody.UserName,
                    )

                    responseStatus = 404;
                    responseObject.Errors.push('user-not-found')
                    responseObject.Errors.push(requestBody.UserName)
                }
            }
            catch (unknownError: unknown)
            {
                responseStatus = 500;

                if (unknownError instanceof Error)
                {
                    let error = unknownError as Error;

                    console.error(
                        '$$$ > ' +
                        'ERROR trying to PATCH on [API]/admin/v1/withdraw-register' + '\n' +
                        'error.message = ', error.message, '\n',
                        'error = ', error,
                    )

                    responseObject.Errors.push(error.message);

                    switch (error.message)
                    {

                    case 'User has no empty slot!':
                        responseStatus = 401;
                        break;

                    case 'Animal item was not found!':
                        responseStatus = 404;
                        responseObject.Errors.push(requestBody.AnimalType);
                        break;

                    default:
                        {
                            console.error(
                                '$$$ > ' +
                                'ERROR trying to PATCH on [API]/admin/v1/withdraw-register' + '\n' +
                                'error = ', error, '\n',
                                'unknownError = ', unknownError,
                            )
                            break;
                        }

                    }
                }
                else
                {
                    console.error(
                        '$$$ > ' +
                        'ERROR trying to PATCH on [API]/admin/v1/withdraw-register' + '\n' +
                        'unknownError = ', unknownError,
                    )
                }
            }

            response.status(responseStatus).send(responseObject);
        })
    }
}





export interface AddAnimalsPostRequestBody
{
    UserName: string,
    AnimalType: string,
    IgnoreSlotsLimitation: boolean,
    IgnoreComissions: boolean,
}

export interface AddAnimalsPostResponseBody
{
    Success: boolean,
    Errors: string[],
}

export interface IncomesPostRequestBody
{
    UserName: string,
    IncomeValue: number,
}

export interface IncomesPostResponseBody
{
    Success: boolean,
    Errors: string[],
}
