// base
import http from "node:http";
import { v4 as uuidv4 } from 'uuid';

// from project
import { UserRegisterRequest } from "../auth-service/auth-service";
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { _pushNotificationService, PushNotificationToken, PushNotificationEntry, PushNotificationServce as PushNotificationService } from '../push-notification-service/push-notification-service';
import { _timeService, TimeService } from '../time-service/time-service';
import { _usersService, PublicUserProfileDocument } from "../users-service/users-service";
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey } from "../utils/project-utils";
import { AnimalService } from "../animals-service/animals-service";
import { SendPurchaseConfimationAsync, SendPurchaseValidationWarnAsync } from "../../api/store/store-route";
import { AnimalStoreItem, SlotStoreItem, WithdrawParameters } from "../store-service/store-service";
import { _incomesService, Income, IncomesDocument, IncomesService } from '../incomes-service/incomes-service';
import { SuitpayPaymentIntegrationService } from "../payment-integration-service/suitpay-payment-integration-service/suitpay-payment-integration-service";
import { _appConfigService, AppConfigService } from "../app-config-service/app-config-service";
import { MailData, MailService, MailType } from '../mail-service/mail-service';
import { EnvironmentHandler } from "../environment-handler/environment-handler";



export class WithdrawService
{
    static GetWithdrawRegisterDocument = async () =>
    {
        let document: WithdrawRegisterDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'dashboard-private',
                'withdraw-register-private',
            ) as WithdrawRegisterDocument;

        // console.log(
        //     '### GetPurchaseRegisterDocument | document = ' + '\n',
        //     document,
        // );

        if (!document)
        {
            document =
            {
                WithdrawRegisterListByBrazilianDate: {},
            }
        }

        return document;
    }

    static SetWithdrawRegisterDocument = async (document: WithdrawRegisterDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'dashboard-private',
            'withdraw-register-private',
            document,
        );
    }

    static RegisterWithdrawRequest = async (
        userId: string,
        withdrawParameters: WithdrawParameters,
        hasFees: boolean,
        feesInternalId: string,
        feesExternalTransactionId: string,
    ) =>
    {
        let maxAutomaticWithdrawAmount = AppConfigService.GetAppConfigDocument().WithdrawConfig.MaxAutomaticWithdrawValue;

        let publicIncomesDocument = await IncomesService.GetPublicIncomesDocument(userId);
        let publicUserDocument = await _usersService.GetPublicUserProfileDocument(userId);
        let privateUserDocument = await _usersService.GetPrivateUserProfileDocument(userId);

        if (publicIncomesDocument && publicUserDocument && privateUserDocument)
        {
            // let relatedIncomes: Income[] = [];
            let withdrawSourcesIds: string[] = [];

            let relatedIncomes = publicIncomesDocument.IncomesList.filter((item) => withdrawParameters.SourceIncomesIds.includes(item.Id));

            let incomesSum = 0;

            relatedIncomes.map(
                (income) =>
                {
                    if (!income.WasRedeemed)
                    {
                        income.WasRedeemed = true;

                        incomesSum += income.Value;
                        withdrawSourcesIds.push(income.Id);
                    }
                })

            console.log('####' + '\n' + 'withdrawParameters = ', withdrawParameters, '\n');
            console.log('####' + '\n' + 'publicIncomesDocument.IncomesList = ', publicIncomesDocument.IncomesList, '\n');
            console.log('####' + '\n' + 'relatedIncomes = ', relatedIncomes, '\n');
            console.log('####' + '\n' + 'incomesSum = ', incomesSum, '\n');

            if (incomesSum > 0)
            {
                let withdrawId = uuidv4();
                let wasApproved = false;
                let wasDenied = false;
                let wasProcessed = false;
                let hasAutomaticWithdraw = incomesSum <= maxAutomaticWithdrawAmount;
                let approverId = '';

                if (hasAutomaticWithdraw)
                {
                    wasApproved = true;
                    approverId = 'n/a';
                }

                let utcNow = _timeService.GetUtcNow();
                let todayBrazilianKey = ConvertUtcDateToBrazilianDayKey(utcNow);

                let registerDocument: WithdrawRegisterDocument = await WithdrawService.GetWithdrawRegisterDocument();

                let listsByDate: { [key: string]: DayWithdrawRegister } = registerDocument.WithdrawRegisterListByBrazilianDate;
                let todayRegisters: DayWithdrawRegister = { RegisterById: {} };

                if (todayBrazilianKey in listsByDate)
                    todayRegisters = listsByDate[todayBrazilianKey];
                else
                    listsByDate[todayBrazilianKey] = todayRegisters;

                let newRegister: WithdrawRequestRegister =
                {
                    Id: withdrawId,
                    CreatedAtDate: utcNow.toISOString(),
                    ExternalTransactionId: '',

                    WithdrawParameters: withdrawParameters,
                    // WithdrawPixKey: withdrawParameters.WithdrawPixKey,
                    // WithdrawPixKeyType: withdrawParameters.WithdrawPixKeyType,
                    WithdrawValue: incomesSum,

                    HasFees: hasFees,
                    // FeesValues: withdrawParameters.FeesValue,
                    FeesInternalId: feesInternalId,
                    FeesExternalTransactionId: feesExternalTransactionId,

                    UserId: userId,
                    Username: publicUserDocument.Username,
                    Fullname: privateUserDocument.FullName,
                    SourcesIds: withdrawSourcesIds,

                    HadAutomaticApproval: hasAutomaticWithdraw,
                    WasApproved: wasApproved,
                    WasDenied: wasDenied,
                    WasProcessed: wasProcessed,
                    ApproverId: approverId,
                }

                todayRegisters.RegisterById[withdrawId] = (newRegister);

                if (hasAutomaticWithdraw)
                {
                    let suitPayCreatePixWithdraResponseBody =
                        await SuitpayPaymentIntegrationService.CreatePixWithdraw(
                            incomesSum,
                            withdrawParameters,
                            privateUserDocument.CPF,
                        )

                    if (suitPayCreatePixWithdraResponseBody.data.response == 'OK')
                    {
                        newRegister.WasProcessed = true;
                        newRegister.ExternalTransactionId = suitPayCreatePixWithdraResponseBody.data.idTransaction;
                    }
                    else
                    {
                        console.error(
                            '$$$ > RegisterWithdrawRequest | ERROR trying to CreatePixWithdraw' + '\n',
                            'userId = ', userId, '\n',
                            'incomesSum = ', incomesSum, '\n',
                            'withdrawParameters = ', '\n',
                            withdrawParameters,
                            'privateUserDocument.CPF = ', privateUserDocument.CPF, '\n',
                            'suitPayCreatePixWithdraResponseBody = ', '\n',
                            suitPayCreatePixWithdraResponseBody,
                        )
                    }
                }

                let mailData: MailData;

                if (newRegister.WasProcessed)
                {
                    let incomesSumText = 'R$' + incomesSum.toFixed(2).replace('.', ',');
                    mailData = WithdrawService.GetWithdrawExecutionMail(userId, incomesSumText);
                }
                else
                    mailData = WithdrawService.GetWithdrawRequestCreationMail(userId);

                relatedIncomes.map((income) => income.WasRedeemed = true)
                await IncomesService.SetPublicIncomesDocument(userId, publicIncomesDocument);

                await WithdrawService.SetWithdrawRegisterDocument(registerDocument);
                WithdrawService.SendMailAndNotificationAsync(userId, mailData);
            }
        }
        else
        {
            if (publicIncomesDocument == undefined)
                throw new Error('User incomes not found!')

            if (privateUserDocument == undefined)
                throw new Error('User not found!')
        }
    }

    static ApproveWithdrawRequest = async (
        withdrawId: string,
        createdAtDate: string,
        approverId: string,
    ) =>
    {
        let dayBrazilianKey = ConvertUtcDateToBrazilianDayKey(new Date(createdAtDate));

        let registerDocument: WithdrawRegisterDocument = await WithdrawService.GetWithdrawRegisterDocument();
        let listsByDate: { [key: string]: DayWithdrawRegister } = registerDocument.WithdrawRegisterListByBrazilianDate;

        if (dayBrazilianKey in listsByDate)
        {
            let todayRegisters = listsByDate[dayBrazilianKey];

            if (withdrawId in todayRegisters.RegisterById)
            {
                let register = todayRegisters.RegisterById[withdrawId];
                let userId = register.UserId;
                let incomesSum = register.WithdrawValue;
                let withdrawParameters = register.WithdrawParameters;
                let privateUserDocument = await _usersService.GetPrivateUserProfileDocument(userId);

                if (!register.WasApproved)
                {
                    register.WasApproved = true;
                    register.ApproverId = approverId;
                }

                if (!register.WasProcessed && privateUserDocument)
                {
                    let suitPayCreatePixWithdraResponseBody =
                        await SuitpayPaymentIntegrationService.CreatePixWithdraw(
                            incomesSum,
                            withdrawParameters,
                            privateUserDocument.CPF,
                        )

                    if (suitPayCreatePixWithdraResponseBody.data.response == 'OK')
                    {
                        register.WasProcessed = true;
                        register.ExternalTransactionId = suitPayCreatePixWithdraResponseBody.data.idTransaction;
                    }
                    else
                    {
                        console.error(
                            '$$$ > RegisterWithdrawRequest | ERROR trying to CreatePixWithdraw' + '\n',
                            'userId = ', userId, '\n',
                            'incomesSum = ', incomesSum, '\n',
                            'withdrawParameters = ', '\n',
                            withdrawParameters,
                            'privateUserDocument.CPF = ', privateUserDocument.CPF, '\n',
                            'suitPayCreatePixWithdraResponseBody = ', '\n',
                            suitPayCreatePixWithdraResponseBody,
                        )
                    }

                    let incomesSumText = 'R$' + incomesSum.toFixed(2).replace('.', ',');
                    let mailData: MailData = WithdrawService.GetWithdrawExecutionMail(userId, incomesSumText);
                    WithdrawService.SendMailAndNotificationAsync(userId, mailData);
                }

                await WithdrawService.SetWithdrawRegisterDocument(registerDocument);
            }
            else
                throw new Error('Register not found in day Date list!');
        }
        else
            throw new Error('Date day list not found!');
    }

    static DenyWithdrawRequest = async (
        withdrawId: string,
        createdAtDate: string,
        approverId: string,
    ) =>
    {
        let dayBrazilianKey = ConvertUtcDateToBrazilianDayKey(new Date(createdAtDate));

        let registerDocument: WithdrawRegisterDocument = await WithdrawService.GetWithdrawRegisterDocument();
        let listsByDate: { [key: string]: DayWithdrawRegister } = registerDocument.WithdrawRegisterListByBrazilianDate;

        if (dayBrazilianKey in listsByDate)
        {
            let todayRegisters = listsByDate[dayBrazilianKey];

            if (withdrawId in todayRegisters.RegisterById)
            {
                let register = todayRegisters.RegisterById[withdrawId];
                let userId = register.UserId;
                let incomesSum = register.WithdrawValue;
                let withdrawParameters = register.WithdrawParameters;
                let privateUserDocument = await _usersService.GetPrivateUserProfileDocument(userId);

                if (!register.WasProcessed && !register.WasApproved)
                {
                    register.WasDenied = true;
                    register.ApproverId = approverId;
                    await WithdrawService.SetWithdrawRegisterDocument(registerDocument);
                }
                else
                    throw new Error('Can not deny! Register was alread processed/approved!');
            }
            else
                throw new Error('Register not found in day Date list!');
        }
        else
            throw new Error('Date day list not found!');
    }

    static GetWithdrawRequestCreationMail = (
        userId: string,
    ) =>
    {
        let title = 'Saque solicitado!';
        let description = ['Seu saque foi solicitado com sucesso! Assim que ele for efetuado iremos te avisar :)'];
        let utcNow = _timeService.GetUtcNow();

        let value: MailData =
        {
            Id: uuidv4(),
            OwnerId: userId,

            Title: title,
            // even index == normal text
            // odd index == bold text
            Description: description,

            Type: MailType.Warning,
            CreationDateTime: utcNow.toISOString(),

            WasRead: false,
        }

        return value;
    }

    static GetWithdrawExecutionMail = (
        userId: string,
        valueText: string,
    ) =>
    {
        let title = 'Saque efetuado!';
        let description =
            [
                'Seu saque foi efetuado com sucesso! (',
                valueText,
                ')',
            ];
        let utcNow = _timeService.GetUtcNow();

        let value: MailData =
        {
            Id: uuidv4(),
            OwnerId: userId,

            Title: title,
            // even index == normal text
            // odd index == bold text
            Description: description,

            Type: MailType.Warning,
            CreationDateTime: utcNow.toISOString(),

            WasRead: false,
        }

        return value;
    }

    static SendMailAndNotificationAsync = async (
        userId: string,
        mailData: MailData,
        baseUserPushNotificationTokens: string[] | undefined = undefined,
    ) =>
    {
        await MailService.TryToAddMailsList(userId, [mailData]);
        MailService.SendMailsListAsNotification(userId, [mailData]);
    }
}

export interface WithdrawRegisterDocument
{
    WithdrawRegisterListByBrazilianDate: { [key: string]: DayWithdrawRegister }
}

export interface DayWithdrawRegister
{
    RegisterById: { [key: string]: WithdrawRequestRegister }
}

export interface WithdrawRequestRegister
{
    Id: string,
    CreatedAtDate: string,
    ExternalTransactionId: string,

    WithdrawParameters: WithdrawParameters,
    // WithdrawPixKey: string,
    // WithdrawPixKeyType: string,
    WithdrawValue: number,

    HasFees: boolean,
    // FeesValues: number,
    FeesInternalId: string,
    FeesExternalTransactionId: string,

    UserId: string,
    Username: string,
    Fullname: string,
    SourcesIds: string[],

    HadAutomaticApproval: boolean,
    WasApproved: boolean,
    WasDenied: boolean,
    WasProcessed: boolean,
    ApproverId: string,
}
