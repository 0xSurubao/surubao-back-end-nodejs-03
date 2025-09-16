// base
// import fetch from 'node-fetch';
// import { RequestInit } from 'node-fetch';
import axios, { AxiosRequestConfig } from 'axios';
// import http from "node:http";
import { v4 as uuidv4 } from 'uuid';

// from project
import { UserRegisterRequest } from "../../auth-service/auth-service";
import { GetDocData, SetDocData } from '../../firebase-admin/firebase-admin';
import { _pushNotificationService, PushNotificationToken, PushNotificationEntry, PushNotificationServce as PushNotificationService } from '../../push-notification-service/push-notification-service';
import { _timeService, TimeService } from "../../time-service/time-service";
import { _usersService, PublicUserProfileDocument } from "../../users-service/users-service";
import { PaymentService } from '../../payment-service/payment-service';


export class PagstarPaymentIntegrationService
{
    static _accessToken: AccessToken | undefined = undefined;


    static HandleApiAuth = async () =>
    {
        let success: boolean = false;

        // ! NEEDS to be REAL date instead of the fake one!! 
        let utcNow = new Date();

        if (PagstarPaymentIntegrationService._accessToken)
        {
            let expirationDate = new Date(PagstarPaymentIntegrationService._accessToken.expires_in);
            success = expirationDate.getTime() > utcNow.getTime();
        }

        if (!success)
        {
            let url = process.env.PARTNER_PAGSTAR_API_BASE_URL! + '/identity/partner/login';

            let requestHeaders =
            {
                'Content-Type': 'application/json',
                'User-Agent': process.env.PARTNER_PAGSTAR_AUTH_AGENT!,
            };

            let requestBody =
            {
                email: process.env.PARTNER_PAGSTAR_AUTH_EMAIL!,
                access_key: process.env.PARTNER_PAGSTAR_AUTH_PASSWORD!,
            };

            // let initOptions: RequestInit =
            // {
            //     method: 'POST',
            //     headers: requestHeaders,
            //     body: JSON.stringify(requestBody),
            // }

            // const response = await fetch(url, initOptions);
            // const responseBody: any = await response.json();

            let responseBody: any = undefined;

            let method = 'POST';

            let config: AxiosRequestConfig =
            {
                url: url,
                method: method,
                headers: requestHeaders,
                data: requestBody,
            }

            await axios.request(config)
                .then(
                    (response) =>
                    {
                        if (!response)
                        {
                            console.error(
                                'ERROR trying to ' + method + '!' + '\n' +
                                'url = ' + url + '\n' +
                                'response = ' + '\n',
                                response,
                            )
                        }

                        responseBody = response;
                    })
                .catch(
                    (error) =>
                    {
                        console.error(error);
                    })

            if (responseBody)
            {
                // console.log(
                //     '_accessToken updated!' + '\n' +
                //     '\n' +
                //     'responseBody.data = ' + '\n',
                //     responseBody.data,
                // );

                console.log('_accessToken updated!');

                PagstarPaymentIntegrationService._accessToken = responseBody.data;

                success = true;
            }
            else
            {
                console.error(
                    'ERROR trying to HandleApiAuth! | ' +
                    'responseBody = ' + '\n',
                    responseBody,
                    '\n' +
                    'requestBody = ' + '\n',
                    requestBody,
                );
            }
        }

        return success;
    }

    static Fetch = async (method: string, endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        let success = await PagstarPaymentIntegrationService.HandleApiAuth();

        if (success)
        {
            let url = process.env.PARTNER_PAGSTAR_API_BASE_URL! + '/' + endPoint;

            let requestHeaders =
            {
                'Authorization': 'Bearer ' + PagstarPaymentIntegrationService._accessToken!.access_token,
                'Content-Type': 'application/json',
                'User-Agent': process.env.PARTNER_PAGSTAR_AUTH_AGENT!,
            };

            let initOptions: RequestInit =
            {
                method: method,
                headers: requestHeaders,
                body: JSON.stringify(requestBody),
            }

            let config: AxiosRequestConfig =
            {
                url: url,
                method: method,
                headers: requestHeaders,
                data: requestBody,
            }

            await axios.request(config)
                .then(
                    (response) =>
                    {
                        if (!response)
                        {
                            console.error(
                                'ERROR trying to ' + method + '!' + '\n' +
                                'url = ' + url + '\n' +
                                'response = ' + '\n',
                                response,
                            )
                        }

                        responseBody = response;
                    })
                .catch(
                    (error) =>
                    {
                        console.error(error);
                    })

            // const response = await fetch(url, initOptions);
            // responseBody = await response.json();

            // if (!responseBody)
            // {
            //     console.error(
            //         'ERROR trying to ' + method + '!' + '\n' +
            //         'url = ' + url + '\n' +
            //         'response = ' + '\n',
            //         response,
            //     )
            // }
        }

        return responseBody;
    }

    static Post = async (endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        responseBody = await PagstarPaymentIntegrationService.Fetch('POST', endPoint, requestBody);

        return responseBody;
    }

    static Patch = async (endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        responseBody = await PagstarPaymentIntegrationService.Fetch('PATCH', endPoint, requestBody);

        return responseBody;
    }

    static SetupWebHookUrl = async () =>
    {
        let notificationUrl = process.env.WEBHOOK_ENDPOINT! + '/api/v1/webhook/pagstar';
        let requestBody =
        {
            notification_url: notificationUrl,
            notify_type: 2,
        };

        console.log('#> SetupWebHookUrl | notificationUrl = ', notificationUrl);

        let responseBody =
            await PagstarPaymentIntegrationService.Patch(
                'identity/partner/notification-url',
                requestBody);

        if (responseBody)
        {
            if (responseBody.message == 'Conta atualizada com sucesso')
            {
                // console.log('# webhook setting has been succeed!');
            }
            else
            {
                console.error(
                    '$$$ > webhook setting failed!' + '\n' +
                    'responseBody = ' + '\n',
                    responseBody,
                );
            }
        }

        // console.log(
        //     'SetupWebHookUrl | ' +
        //     'responseBody = ' + '\n',
        //     responseBody,
        // )
    }

    static CreatePixPayment = async (
        value: number,
        userFullname: string,
        userIdDocument: string,
        userEmail: string,
        purchaseInternalId: string,
    ): Promise<PagstarCreatePixPaymentResponseBody> =>
    {
        await PagstarPaymentIntegrationService.SetupWebHookUrl();

        let expirationInMinutes = 5;
        let expirationInSeconds = expirationInMinutes * 60;

        let requestBody =
        {
            // payment info
            value: value,
            expiration: expirationInSeconds,

            // user info
            name: userFullname,
            document: userIdDocument,

            // internal meta data
            transaction_id: purchaseInternalId,

            // auth
            tenant_id: process.env.PARTNER_PAGSTAR_TENANT_ID!,
        };

        let responseBody: PagstarCreatePixPaymentResponseBody =
            await PagstarPaymentIntegrationService.Post(
                'wallet/partner/transactions/generate-anonymous-pix',
                requestBody);

        if (responseBody)
        {
            // console.log(
            //     '############ responseBody = ',
            //     responseBody,
            // );

            if (responseBody.message == 'Pagamento PIX gerado com sucesso.')
            {
                // console.log('# pix creation has been succeed!');
            }
            else
            {
                console.error(
                    '$$$ > Suitpay | CreatePixPayment failed!' + '\n' +
                    'responseBody = ' + '\n',
                    responseBody,
                );
            }
        }

        return responseBody;
    }

    static FAKE_CreatePixPayment = async (
        value: number,
        userFullname: string,
        userIdDocument: string,
        userEmail: string,
        purchaseInternalId: string,
    ): Promise<PagstarCreatePixPaymentResponseBody> =>
    {
        let fakePurhcaseId = 'FAKE-' + uuidv4() + '-FAKE';

        let responseBody: PagstarCreatePixPaymentResponseBody =
        {
            message: 'Pagamento PIX gerado com sucesso.',
            "data": {
                "qr_code_url": 'https://google.com',
                "favoured": 'https://google.com',
                "external_reference": fakePurhcaseId,
                "checkout": '',
                "pix_key": fakePurhcaseId,
            }
        };

        PagstarPaymentIntegrationService.FAKE_SendFakeConfimationAsync(purchaseInternalId, responseBody.data.external_reference);

        return responseBody;
    }

    static FAKE_SendFakeConfimationAsync = async (
        purchaseInternalId: string,
        externalTransactionId: string,
    ) =>
    {
        // let waitSeconds = 3;
        // await Delay(waitSeconds);

        await PaymentService.FinishItemPurchaseRequest(purchaseInternalId, externalTransactionId);
    }
}

export const Delay = (waitSeconds: number) => new Promise(res => setTimeout(res, waitSeconds * 1000));

export interface AccessToken 
{
    access_token: string,
    expires_in: Date,
    refresh_token: string,
    admin_type: 1
}

export interface ResponseBody 
{
    message: string,
    data: any,
}

export interface CreatePixResponse
{
    "qr_code_url": string,
    "favoured": string,
    "external_reference": string,
    "checkout": string,
    "pix_key": string,
}

export interface PagstarCreatePixPaymentResponseBody
{
    "message": string,
    "data": {
        "qr_code_url": string,
        "favoured": string,
        "external_reference": string,
        "checkout": string,
        "pix_key": string,
    }
}
