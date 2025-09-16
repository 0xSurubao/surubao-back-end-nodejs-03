// base
import { Express, Request, Response } from "express";

// third
import { WriteResult } from "firebase-admin/firestore";

// from project
import { _pushNotificationService } from "../../features/push-notification-service/push-notification-service";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
import { _mailService } from "../../features/mail-service/mail-service";
import { AnimalService } from "../../features/animals-service/animals-service";
import { StoreService } from "../../features/store-service/store-service";
import { PaymentService } from "../../features/payment-service/payment-service";
import { WithdrawService } from "../../features/withdraw-service/withdraw-service";


export default class AdminRoute
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        baseExpressApp.get('/admin/v1/purchase-register', async (request: Request, response: Response) =>
        {
            let document = await PaymentService.GetPurchaseRegisterDocument();
            response.status(200).send(document);
        })

        baseExpressApp.get('/admin/v1/withdraw-register', async (request: Request, response: Response) =>
        {
            let document = await WithdrawService.GetWithdrawRegisterDocument();
            response.status(200).send(document);
        })

        baseExpressApp.patch('/admin/v1/withdraw-register', async (request: Request, response: Response) =>
        {
            // const authHeader = request.headers['authorization'];
            const requestBody = request.body as WithdrawPatchRequestBody;

            let responseStatus = 200;
            let responseObject: WithdrawPatchResponseBody = { Success: false, Errors: [], }

            try
            {
                let approverId = 'UNDEFINED-ID';

                switch (requestBody.Action)
                {
                case 'approve':
                    {
                        await WithdrawService.ApproveWithdrawRequest(
                            requestBody.WithdrawRequestId,
                            requestBody.CreatedAtDate,
                            approverId,
                        )

                        responseObject.Success = true;
                        break;
                    }

                case 'deny':
                    {
                        await WithdrawService.DenyWithdrawRequest(
                            requestBody.WithdrawRequestId,
                            requestBody.CreatedAtDate,
                            approverId,
                        )

                        responseObject.Success = true;
                        break;
                    }

                default:
                    responseStatus = 400;
                    break;
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
    }
}







export interface WithdrawPatchRequestBody
{
    Action: string,
    WithdrawRequestId: string,
    CreatedAtDate: string,
}

export interface WithdrawPatchResponseBody
{
    Success: boolean,
    Errors: string[],
}
