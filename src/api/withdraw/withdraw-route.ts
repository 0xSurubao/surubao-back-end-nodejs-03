// base
import { Express, Request, Response } from "express";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
import { WriteResult } from "firebase-admin/firestore";
import { Server } from "socket.io";
import { AnimalStoreItem, SlotStoreItem, StoreConfigDocument, StoreService, WithdrawParameters } from '../../features/store-service/store-service';

// from project
import { _storeService } from "../../features/store-service/store-service";
import { _animalService, AnimalService } from "../../features/animals-service/animals-service";
import { Delay } from "../../features/utils/project-utils";
import { v4 as uuidv4 } from 'uuid';
import { _timeService } from "../../features/time-service/time-service";
import { IncomesService, AnimalSellResult, IncomesDocument } from '../../features/incomes-service/incomes-service';
import { PagstarCreatePixPaymentResponseBody, PagstarPaymentIntegrationService } from "../../features/payment-integration-service/pagstar-payment-integration-service/pagstar-payment-integration-service";
import { _usersService, UsersService } from "../../features/users-service/users-service";
import { PaymentService } from "../../features/payment-service/payment-service";
import { SuitPayCreatePixPaymentResponseBody, SuitpayPaymentIntegrationService } from "../../features/payment-integration-service/suitpay-payment-integration-service/suitpay-payment-integration-service";
import { _affiliatesClubService, AffiliatesClubService } from "../../features/affiliates-service/affiliates-club-service";
import { WithdrawService } from "../../features/withdraw-service/withdraw-service";
import { _appConfigService, AppConfigService, WithdrawConfig } from '../../features/app-config-service/app-config-service';


export default class WithdrawRoute
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        baseExpressApp.post('/withdraw', async (request: Request, response: Response) =>
        {
            const authHeader = request.headers['authorization'];
            const withdrawRequest = request.body as WithdrawRequest;

            let isAuthenticated: boolean = false;

            let responseObject: WithdrawResponse = { Success: false, Errors: [], }

            if (authHeader)
            {
                const userId = await GetUserIdByToken(authHeader);

                if (userId)
                {
                    isAuthenticated = true;

                    // console.log(
                    //     '_appConfigService.GetAppConfigDocument() = ',
                    //     _appConfigService.GetAppConfigDocument(),
                    // )

                    let minClubActiveMembersAmountToWithdraw = AppConfigService.GetAppConfigDocument().WithdrawConfig.MinClubActiveMembersAmountToWithdraw;
                    let minWithdrawAmount = AppConfigService.GetAppConfigDocument().WithdrawConfig.MinWithdrawValue;
                    let withdrawTaxType = AppConfigService.GetAppConfigDocument().WithdrawConfig.WithdrawFeesType;
                    let withdrawTaxValue = AppConfigService.GetAppConfigDocument().WithdrawConfig.WithdrawFeesValue;

                    let publicIncomesDocument = await IncomesService.GetPublicIncomesDocument(userId);

                    if (publicIncomesDocument)
                    {
                        let hasMinClubActiveMembersAmount = false;

                        if (minClubActiveMembersAmountToWithdraw <= 0)
                            hasMinClubActiveMembersAmount = true;
                        else
                        {
                            let clubActiveMembersAmountToWithdraw = await _affiliatesClubService.GetActiveClubMembersAmount(userId);

                            hasMinClubActiveMembersAmount = clubActiveMembersAmountToWithdraw >= minClubActiveMembersAmountToWithdraw;
                        }

                        if (hasMinClubActiveMembersAmount)
                        {
                            let availableIcomesSum = await IncomesService.GetAvailableIcomesSum(userId, publicIncomesDocument);
                            let hasMinWithdrawAmount = availableIcomesSum >= minWithdrawAmount;

                            if (hasMinWithdrawAmount)
                            {
                                let privateUserProfile = await _usersService.GetPrivateUserProfileDocument(userId);

                                if (privateUserProfile)
                                {
                                    let finalWithdrawTax = 0;

                                    switch (withdrawTaxType)
                                    {
                                    case 'percentage':
                                        finalWithdrawTax = availableIcomesSum * withdrawTaxValue;
                                        break;

                                    case 'fixed-value':
                                        finalWithdrawTax = withdrawTaxValue;
                                        break;

                                    case 'none':
                                        finalWithdrawTax = 0;
                                        break;
                                    }

                                    let incomesIds: string[] = [];
                                    let availableIcomes = await IncomesService.GetAvailableIcomes(userId, publicIncomesDocument);
                                    let utcNow = _timeService.GetUtcNow();

                                    let hasToPayFees = finalWithdrawTax > 0;

                                    let withdrawParameters: WithdrawParameters =
                                    {
                                        WithdrawPixKey: withdrawRequest.WithdrawPixKey,
                                        WithdrawPixKeyType: withdrawRequest.WithdrawPixKeyType,
                                        FeesValue: withdrawTaxValue,
                                        SourceIncomesIds: incomesIds,
                                    }

                                    if (hasToPayFees)
                                    {
                                        let purchaseInternalId = uuidv4();
                                        let expirationInMinutes = 5;
                                        let utcNowInMs = utcNow.getTime();
                                        let expirationInMs = utcNowInMs + expirationInMinutes * 1000 * 60;
                                        let purchaseExpirationDate: Date = new Date(expirationInMs);
                                        let expirationDateUtc = purchaseExpirationDate.toISOString();

                                        availableIcomes.map((income) => incomesIds.push(income.Id));

                                        await PaymentService.RegisterWithdrawPurchaseRequest(purchaseInternalId, userId, withdrawParameters);

                                        let createPixPaymentResponseBody: SuitPayCreatePixPaymentResponseBody =
                                            await SuitpayPaymentIntegrationService
                                                .CreatePixPayment(
                                                    finalWithdrawTax,
                                                    privateUserProfile.FullName,
                                                    privateUserProfile.CPF,
                                                    privateUserProfile.Email,
                                                    purchaseInternalId,
                                                );

                                        if (createPixPaymentResponseBody == undefined)
                                        {
                                            // 500 == "Internal Server Error" (no private user profile was found)
                                            response.status(500).send({});
                                            return;
                                        }

                                        let responseObject: WithdrawFeesResponse =
                                        {
                                            Id: uuidv4(),
                                            CreatedAtDate: utcNow.toISOString(),

                                            Success: false,

                                            Status: WithdrawResponseStatus.Pending,

                                            HasToPayFees: true,
                                            FeesValue: withdrawTaxValue,

                                            PurchaseInternalId: purchaseInternalId,
                                            ExpirationDate: expirationDateUtc,
                                            PaymentUrl: '',
                                            PaymentUrlKey: '',

                                            Errors: [],
                                        };

                                        let responseStatusCode = 200;

                                        if (createPixPaymentResponseBody.data.response == 'OK')
                                        {
                                            responseObject.Success = true;
                                            responseObject.Status = WithdrawResponseStatus.Pending;

                                            responseObject.PaymentUrl = createPixPaymentResponseBody.data.paymentCode;
                                            responseObject.PaymentUrlKey = createPixPaymentResponseBody.data.paymentCode;
                                        }
                                        else
                                        {
                                            responseStatusCode = 500;
                                            responseObject.Status = WithdrawResponseStatus.Error;
                                            responseObject.Errors.push(createPixPaymentResponseBody.statusText);
                                        }

                                        response.status(responseStatusCode).send(responseObject);
                                    }
                                    else
                                    {
                                        await WithdrawService.RegisterWithdrawRequest(
                                            userId,
                                            withdrawParameters,
                                            false,
                                            'n/a',
                                            'n/a',
                                        );

                                        let responseObject: WithdrawFeesResponse =
                                        {
                                            Id: uuidv4(),
                                            CreatedAtDate: utcNow.toISOString(),

                                            Success: true,
                                            Status: WithdrawResponseStatus.Finished,

                                            HasToPayFees: false,
                                            FeesValue: 0,

                                            PurchaseInternalId: '',
                                            ExpirationDate: '',
                                            PaymentUrl: '',
                                            PaymentUrlKey: '',

                                            Errors: [],
                                        };

                                        response.status(200).send(responseObject);
                                    }

                                }
                                else
                                {
                                    // 404 == "Not found" (not enough available icomes)
                                    responseObject.Errors.push('user-not-found')
                                    response.status(404).send(responseObject)
                                }
                            }
                            else
                            {
                                // 403 == "Forbidden" (not enough available icomes)
                                responseObject.Errors.push('not-enough-available-icomes')
                                responseObject.Errors.push(minWithdrawAmount.toFixed(2).replace('.', ','))
                                response.status(403).send(responseObject)
                            }
                        }
                        else
                        {
                            // 403 == "Forbidden" (not enough active members on club)
                            responseObject.Errors.push('not-enough-active-members-on-club')
                            responseObject.Errors.push(minClubActiveMembersAmountToWithdraw.toString())
                            response.status(403).send(responseObject)
                        }
                    }
                    else
                    {
                        // 404 == "Not found" (publicIncomesDocument not found)
                        responseObject.Errors.push('public-incomes-not-found')
                        response.status(404).send(responseObject)
                    }
                }
            }

            if (!isAuthenticated)
            {
                // 401 == "Unauthorized" (not autheticated)
                console.log("$$$ > isAuthenticated is FALSE!");
                response.status(401).send(responseObject);
            }
        });
    }
}








export interface WithdrawRequest
{
    WithdrawPixKey: string,
    WithdrawPixKeyType: string,
}

export interface WithdrawResponse
{
    Success: boolean,
    Errors: string[],
}

export interface WithdrawFeesResponse extends WithdrawResponse
{
    type?: 'WithdrawFeesResponse'

    Id: string;
    CreatedAtDate: string,

    Status: WithdrawResponseStatus,

    HasToPayFees: boolean,
    FeesValue: number,

    PurchaseInternalId: string,
    ExpirationDate: string,
    PaymentUrl: string,
    PaymentUrlKey: string,
}

export enum WithdrawResponseStatus
{
    UNDEFINED = -1,

    FakeTemporary,
    Pending,
    Finished,
    Error,
}
