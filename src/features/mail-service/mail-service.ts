// base
// ...

// from project
import { Transaction } from "firebase-admin/firestore";
import { UserRegisterRequest } from "../auth-service/auth-service";
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { _pushNotificationService, PushNotificationToken, PushNotificationEntry, PushNotificationServce as PushNotificationService } from '../push-notification-service/push-notification-service';
import { _usersService, PublicUserProfileDocument } from "../users-service/users-service";
import { EnvironmentHandler } from "../environment-handler/environment-handler";


export class MailService
{
    static SetMailsDocument = async (
        baseUserId: string,
        document: MailsDocument,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-mail-public',
            baseUserId,
            document,
            baseTransaction,
        );
    }

    static GetMailsDocument = async (
        baseUserId: string,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        let document = await GetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-mail-public',
            baseUserId,
            baseTransaction,
        ) as (MailsDocument | undefined);

        if (!document)
            document = { MailsList: [] }

        return document;
    }

    static TryToAddMail = async (baseUserId: string, mailData: MailData) =>
    {
        let document = await MailService.GetMailsDocument(baseUserId);

        if (!document)
            document = { MailsList: [] }

        document.MailsList.push(mailData);

        await MailService.SetMailsDocument(baseUserId, document);
    }

    static TryToAddMailsList = async (
        baseUserId: string,
        mailDataList: MailData[],
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        let document = await MailService.GetMailsDocument(baseUserId, baseTransaction);

        // console.log(
        //     "#> " +
        //     "(" + baseUserId + ") TryToAddMailsList" + '\n' +
        //     '\n' + 'mailDataList = ',
        //     mailDataList,
        //     '\n' + 'document = ',
        //     document,
        // );

        if (!document)
            document = { MailsList: [] }

        document.MailsList = document.MailsList.concat(mailDataList);

        await MailService.SetMailsDocument(baseUserId, document, baseTransaction);
    }

    static SendMailsListAsNotification = async (
        baseUserId: string,
        mailDataList: MailData[],
        baseUserPushNotificationTokens: string[] | undefined = undefined,
    ) =>
    {
        let pushNotificationEntries: PushNotificationEntry[] = [];

        if (!baseUserPushNotificationTokens || baseUserPushNotificationTokens.length == 0)
        {
            baseUserPushNotificationTokens = [];

            let publicUserProfileD: PublicUserProfileDocument | undefined =
                await _usersService.GetPublicUserProfileDocument(baseUserId);

            if (publicUserProfileD)
            {
                let pushNotificationTokensByToken = publicUserProfileD.PushNotificationTokensByToken;

                Object.keys(pushNotificationTokensByToken).forEach(
                    (key) =>
                    {
                        let token = pushNotificationTokensByToken[key];

                        if (token)
                            baseUserPushNotificationTokens!.push(token.ClientToken);
                    })
            }
        }

        mailDataList.map(
            (baseMailData) =>
            {
                let notificationTitle = MailService.GetMailTypeText(baseMailData.Type) + ' | ' + baseMailData.Title;
                let notificationContent = baseMailData.Description.join('');

                let pushNotificationEntry: PushNotificationEntry =
                {
                    ClientTokens: baseUserPushNotificationTokens,
                    Title: notificationTitle,
                    Content: notificationContent,
                }

                pushNotificationEntries.push(pushNotificationEntry);
            });

        await PushNotificationService.SendNotificationsList(pushNotificationEntries);
    }

    static GetMailTypeText = (mailType: MailType) =>
    {
        let value = '';

        switch (mailType)
        {
        case MailType.Bonus:
            value = "Bônus"
            break;

        case MailType.Commission:
            value = "Comissão"
            break;

        case MailType.Warning:
            value = "Aviso"
            break;

        default:
            {
                console.error(
                    '$> ' +
                    'ERROR trying to GetMailTypeText!' + '\n' +
                    'UNEXPECTED mailType!' + '\n' +
                    'mailType = ' + mailType.toString() + '\n' +
                    '');

                value = mailType.toString();
                break;
            }
        }

        return value;
    }

}

export let _mailService: MailService = new MailService();


export interface MailsDocument
{
    MailsList: Array<MailData>,
}

export interface MailData
{
    Id: string,
    OwnerId: string,

    Title: string,
    // even index == normal text
    // odd index == bold text
    Description: Array<string>,

    Type: MailType,
    CreationDateTime: string,

    WasRead: boolean,
}

export enum MailType
{
    UNDEFINED = -1,

    Bonus,
    Commission,
    Warning,
}
