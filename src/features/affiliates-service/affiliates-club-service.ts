import { AnimalStoreItem } from '../store-service/store-service';
// base
import { v4 as uuidv4 } from 'uuid';
import { CreateRequest, getAuth } from 'firebase-admin/auth';

// from project
import { _ativitiesService } from "../activities-service/activities-service";
import { _incomesService } from '../incomes-service/incomes-service';
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey, GetRandomInt, HandleAnyDateFormat } from '../utils/project-utils';
import { _usersService, UsersService, PublicUserProfileDocument } from '../users-service/users-service';
import { PushNotificationToken } from '../push-notification-service/push-notification-service';
import { _timeService } from '../time-service/time-service';
import { MailService, MailData, MailType } from '../mail-service/mail-service';
import { _appConfigService, AppConfigService } from '../app-config-service/app-config-service';
import { EnvironmentHandler } from '../environment-handler/environment-handler';


export class AffiliatesClubService
{
    HasClubWithCode = async (clubCode: string): Promise<boolean> =>
    {
        let value = false;

        let document: AffiliatesClubDocument | undefined = await this.GetClubDocument(clubCode);

        if (document)
            value = true;
        else
            value = false;

        // console.log("$> HasClubWithCode | clubCode = " + clubCode + " value = " + value)

        return value;
    }

    SetClubDocument = async (clubCode: string, document: AffiliatesClubDocument) =>
    {
        let lowerCaseClubCode = clubCode.toLowerCase();
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'affiliates-club-public',
            lowerCaseClubCode,
            document,
        );
    }

    GetClubDocument = async (clubCode: string) =>
    {
        let lowerCaseClubCode = clubCode.toLowerCase();
        let document: AffiliatesClubDocument | undefined =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'affiliates-club-public',
                lowerCaseClubCode,
            ) as (AffiliatesClubDocument | undefined);

        if (document)
        {
            if (!document.PushNotificationTokensByToken)
                document.PushNotificationTokensByToken = {};
        }

        return document;
    }

    CreateClubOnRegister = async (ownerId: string): Promise<string> =>
    {
        let randomCode = '';

        let hasClubWithCode = true;

        while (hasClubWithCode)
        {
            randomCode = GetRandomCode(6);
            hasClubWithCode = await this.HasClubWithCode(randomCode);
        }

        let utcNow = _timeService.GetUtcNow();

        let document: AffiliatesClubDocument =
        {
            Code: randomCode,
            OwnerId: ownerId,
            MembersById: {},
            CreatedAtDate: utcNow.toISOString(),

            PushNotificationTokensByToken: {},
        }

        this.SetClubDocument(randomCode, document);

        return randomCode;
    }

    AddMemberOnClub = async (clubCode: string, newMemberId: string, newMemberUsername: string) =>
    {
        let document = await this.GetClubDocument(clubCode);

        if (document)
        {
            let utcNow = _timeService.GetUtcNow();
            let newMember: AffiliatesClubMember =
            {
                UserId: newMemberId,
                Username: newMemberUsername,

                IsActivive: false,
                CreatedAtDate: utcNow.toISOString(),
                LastActivityDate: utcNow.toISOString(),
                LastClubActivityDate: new Date(0).toISOString(),
            }

            document.MembersById[newMemberId] = newMember;

            let clubOwnerId = document.OwnerId;

            let newMemberMail = this.GetNewMemberMail(clubOwnerId, newMemberUsername,)
            let mailsList = [newMemberMail];

            await MailService.TryToAddMailsList(clubOwnerId, mailsList);
            await MailService.SendMailsListAsNotification(clubOwnerId, mailsList);

            await this.SetClubDocument(clubCode, document);
        }
        else
        {
            let debugText =
                '$> ' +
                'ERROR trying to add AddMemberOnClub!' + '\n' +
                'club NOT FOUND!' + '\n' +
                'clubCode = ' + clubCode + '\n' +
                'newMemberId = ' + newMemberId + '\n' +
                '';
            console.error(debugText);
        }
    }

    GetNewMemberMail = (
        ownerId: string,
        indicatedUsername: string,
    ): MailData =>
    {
        let title = 'Novo membro no clube!';
        let description: string[] =
            [
                'Parabéns! Agora o jogador ',
                '@' + indicatedUsername,
                ' faz parte do seu clube de fazendeiros'
            ]

        let mailType: MailType = MailType.Warning;
        let utcNow = _timeService.GetUtcNow();

        let value: MailData =
        {
            Id: uuidv4(),
            OwnerId: ownerId,

            Title: title,
            // even index == normal text
            // odd index == bold text
            Description: description,

            Type: mailType,
            CreationDateTime: utcNow.toISOString(),

            WasRead: false,
        }

        return value;
    }

    UpdateMemberClubActivity = async (memberId: string, clubCode: string | undefined = undefined) =>
    {
        if (!clubCode)
        {

        }

        if (clubCode)
        {
            let clubDocument = await this.GetClubDocument(clubCode);

            if (clubDocument)
            {
                let member: AffiliatesClubMember | undefined = clubDocument.MembersById[memberId];

                if (member)
                {
                    let utcNow = _timeService.GetUtcNow();

                    member.LastActivityDate = utcNow.toISOString();
                    clubDocument.MembersById[memberId] = member;

                    await this.SetClubDocument(clubCode, clubDocument);
                }
            }
        }
    }



    GetUserLevel = async (
        ownerId: string | undefined = undefined,
        userOwnClubCode: string | undefined = undefined,
        affiliatesClubDocument: AffiliatesClubDocument | undefined = undefined,
    ) =>
    {
        let value = 1;

        if (affiliatesClubDocument == undefined)
        {
            if (userOwnClubCode == undefined)
            {
                if (ownerId)
                {
                    let userDocument = await _usersService.GetPublicUserProfileDocument(ownerId);

                    if (userDocument)
                        userOwnClubCode = userDocument.OwnIndicationCode;
                    else
                        console.error('$$ > ERROR trying to GetUserLevel!! | userDocument WAS NOT FOUND | ownerId = ', ownerId);
                }
                else
                    console.error('$$ > ERROR trying to GetUserLevel!! | ownerId IS UNDEFINED!');
            }

            if (userOwnClubCode)
                affiliatesClubDocument = await this.GetClubDocument(userOwnClubCode);
            else
                console.error('$$ > ERROR trying to GetUserLevel!! | userOwnClubCode IS UNDEFINED!');
        }

        if (affiliatesClubDocument)
        {
            let activeClubMembersAmount = await this.GetActiveClubMembersAmount(undefined, undefined, affiliatesClubDocument);

            if (activeClubMembersAmount < 6)
                value = 1;
            else if (activeClubMembersAmount < 9)
                value = 2;
            else if (activeClubMembersAmount < 12)
                value = 3;
            else if (activeClubMembersAmount < 15)
                value = 4;
            else
                value = 5;
        }
        else
            console.error('$$ > ERROR trying to GetUserLevel!! | affiliatesClubDocument IS UNDEFINED!');

        return value;
    }

    GetActiveClubMembersAmount = async (
        userId: string | undefined = undefined,
        userOwnClubCode: string | undefined = undefined,
        affiliatesClubDocument: AffiliatesClubDocument | undefined = undefined,
    ) =>
    {
        let value = 0;

        if (affiliatesClubDocument == undefined)
        {
            if (userOwnClubCode == undefined)
            {
                if (userId)
                {
                    let publicUserProfile = await _usersService.GetPublicUserProfileDocument(userId);

                    if (publicUserProfile)
                        userOwnClubCode = publicUserProfile.OwnIndicationCode;
                    else
                    {
                        console.error(
                            '$$ > ' +
                            'ERROR trying to GetActiveClubMembersAmount!' + '\n' +
                            'publicUserProfile IS UNDEFINED!');
                    }
                }
                else
                {
                    console.error(
                        '$$ > ' +
                        'ERROR trying to GetActiveClubMembersAmount!' + '\n' +
                        'userId IS UNDEFINED!');
                }
            }

            if (userOwnClubCode)
                affiliatesClubDocument = await this.GetClubDocument(userOwnClubCode);
            else
            {
                console.error(
                    '$$ > ' +
                    'ERROR trying to GetActiveClubMembersAmount!' + '\n' +
                    'userOwnClubCode IS UNDEFINED!');
            }
        }

        if (affiliatesClubDocument)
        {
            Object.keys(affiliatesClubDocument.MembersById).map(
                (key: string) =>
                {
                    let member: AffiliatesClubMember = affiliatesClubDocument.MembersById[key];

                    let utcNow = _timeService.GetUtcNow();
                    let lastClubActivityDate = new Date(HandleAnyDateFormat(member.LastClubActivityDate));

                    let maxActivityInDays = AppConfigService.GetAppConfigDocument().AffiliatesClubConfig.ActivityDurationInDays;

                    let activityDiff = utcNow.getTime() - lastClubActivityDate.getTime();
                    let dayOffset = 24 * 60 * 60 * 1000;

                    if (activityDiff < maxActivityInDays * dayOffset)
                        value++;
                })

            // ! DEBUG ONLY!!!
            // ! DEBUG ONLY!!!
            // ! DEBUG ONLY!!!
            // value = 3;
            // ! DEBUG ONLY!!!
            // ! DEBUG ONLY!!!
            // ! DEBUG ONLY!!!
        }
        else
        {
            console.error(
                '$$ > ERROR trying to GetUserLevel!' + '\n',
                'affiliatesClubDocument IS UNDEFINED!', '\n',
                'userId = ', userId, '\n',
                'userOwnClubCode = ', userOwnClubCode, '\n',
            );
        }


        // if (this.AffiliatesClubSubscription.Content.getValue() != undefined)
        // {
        //     let affiliatesClubDocument: AffiliatesClubDocument = this.AffiliatesClubSubscription.Content.getValue()!;


        // }

        return value;
    }
}


export let _affiliatesClubService: AffiliatesClubService = new AffiliatesClubService();



export interface AffiliatesClubDocument
{
    Code: string,
    OwnerId: string,

    CreatedAtDate: string,

    MembersById: { [key: string]: AffiliatesClubMember },
    PushNotificationTokensByToken: { [key: string]: PushNotificationToken },
}

export interface AffiliatesClubMember
{
    UserId: string,
    Username: string,

    CreatedAtDate: string,

    IsActivive: boolean,
    LastActivityDate: string,
    LastClubActivityDate: string,
}


function GetRandomCode(length: number)
{
    let result = '';

    const characters = 'abcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;

    if (length < 0)
        length = 0;

    let counter = 0;

    while (counter < length)
    {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }

    return result;
}
