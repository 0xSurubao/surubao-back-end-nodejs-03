// base
// ...

// from project
import { UserRegisterRequest } from "../auth-service/auth-service";
import { EnvironmentHandler } from "../environment-handler/environment-handler";
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { PushNotificationToken } from "../push-notification-service/push-notification-service";
import { _timeService } from "../time-service/time-service";


export class UsersService
{
    RegisterUserProfileData = async (
        baseUserId: string,
        userRegisterRequest: UserRegisterRequest,
        ownIndicationCode: string) =>
    {
        let utcNow = _timeService.GetUtcNow();

        let publicUserProfile: PublicUserProfileDocument =
        {
            Id: baseUserId,

            Username: userRegisterRequest.Username,
            Level: 1,
            IndicationCode: userRegisterRequest.HasNoIndicationCode ? '' : userRegisterRequest.IndicationCode.toLowerCase(),
            OwnIndicationCode: ownIndicationCode.toLowerCase(),
            HasNoIndicationCode: userRegisterRequest.HasNoIndicationCode,
            CreatedAtDate: utcNow.toISOString(),

            PushNotificationTokensByToken: {},
        };

        let privateUserProfile: PrivateUserProfileDocument =
        {
            Email: userRegisterRequest.Email,
            FullName: userRegisterRequest.FullName,
            CPF: userRegisterRequest.CPF,
            CreatedAtDate: utcNow.toISOString(),
        };

        await this.SetPublicUserProfileDocument(baseUserId, publicUserProfile);
        await this.SetPrivateUserProfileDocument(baseUserId, privateUserProfile);
    }

    SetPublicUserProfileDocument = async (baseUserId: string, document: PublicUserProfileDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-public',
            baseUserId,
            document,
        );
    }

    GetPublicUserProfileDocument = async (baseUserId: string) =>
    {
        let document: PublicUserProfileDocument | undefined =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-public',
                baseUserId,
            ) as (PublicUserProfileDocument | undefined);

        if (document)
        {
            if (!document.Id)
                document.Id = baseUserId;

            if (!document.PushNotificationTokensByToken)
                document.PushNotificationTokensByToken = {};
        }

        return document;
    }

    SetPrivateUserProfileDocument = async (baseUserId: string, document: PrivateUserProfileDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-private',
            baseUserId,
            document,
        );
    }

    GetPrivateUserProfileDocument = async (baseUserId: string) =>
    {
        let document: PrivateUserProfileDocument | undefined =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-private',
                baseUserId,
            ) as (PrivateUserProfileDocument | undefined);

        return document;
    }

    IsUserNameAvailable = async (username: string): Promise<boolean> =>
    {
        let value: boolean = false;

        let userDoc: (RegisteredUsernameDocument | undefined) = await this.GetUsernameDoc(username);

        if (userDoc)
            value = false;
        else
            value = true;

        // console.log("$> IsUserNameAvailable | username = " + username + " value = " + value);

        return value;
    }

    SetUsernameDoc = async (ownerId: string, username: string) =>
    {
        let lowerCaseUserName = username.toLowerCase();

        // console.log("$> SetUsernameDoc | lowerCaseUserName = " + lowerCaseUserName);

        let registeredUsernameDocument: RegisteredUsernameDocument =
        {
            OriginalUsername: username,
            OwnerId: ownerId,
        }

        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'registered-username-private',
            lowerCaseUserName,
            registeredUsernameDocument,
        );
    }

    GetUsernameDoc = async (username: string): (Promise<RegisteredUsernameDocument | undefined>) =>
    {
        let lowerCaseUserName = username.toLowerCase();
        return await GetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'registered-username-private',
            lowerCaseUserName,
        ) as RegisteredUsernameDocument;
    }
}

export let _usersService: UsersService = new UsersService();



export interface PublicUserProfileDocument
{
    Id: string,

    Username: string,
    OwnIndicationCode: string,
    IndicationCode: string,
    HasNoIndicationCode: boolean,
    Level: number,

    CreatedAtDate: string,

    PushNotificationTokensByToken: { [key: string]: PushNotificationToken },
}

export interface PrivateUserProfileDocument
{
    Email: string,
    FullName: string,
    CPF: string,

    CreatedAtDate: string,
}


export interface RegisteredUsernameDocument
{
    OriginalUsername: string,
    OwnerId: string;
}
