// base
// ...

// third
// ...

// from project
import { BatchResponse, Message, SendResponse } from 'firebase-admin/lib/messaging/messaging-api';
import { _affiliatesClubService, AffiliatesClubDocument } from '../affiliates-service/affiliates-club-service';
import { Messaging } from '../firebase-admin/firebase-admin';
import { _usersService, PublicUserProfileDocument } from '../users-service/users-service';
import { _timeService } from '../time-service/time-service';


export class PushNotificationServce
{
    RegisterNotificationToken = async (baseUserId: string, clientToken: string) =>
    {
        let publicUserProfile = await _usersService.GetPublicUserProfileDocument(baseUserId);

        if (publicUserProfile)
        {
            const userClubCode = publicUserProfile.OwnIndicationCode;

            let affiliatesClubDocument = await _affiliatesClubService.GetClubDocument(userClubCode);

            if (affiliatesClubDocument)
            {
                const utcNow = _timeService.GetUtcNow();

                let pushNotificationToken: PushNotificationToken =
                {
                    ClientToken: clientToken,
                    CreatedAtDate: utcNow.toISOString(),
                }

                await this.HandleUserTokensRegister(baseUserId, pushNotificationToken, publicUserProfile);
                await this.HandleClubTokensRegister(userClubCode, pushNotificationToken, affiliatesClubDocument);
            }
        }
    }

    HandleUserTokensRegister = async (
        baseUserId: string,
        pushNotificationToken: PushNotificationToken,
        publicUserProfile: PublicUserProfileDocument) =>
    {
        if (publicUserProfile)
        {
            if (!publicUserProfile.PushNotificationTokensByToken)
                publicUserProfile.PushNotificationTokensByToken = {};
        }

        let userTokens = publicUserProfile.PushNotificationTokensByToken;
        let isTokenRegisteredOnUserProfile = false;

        Object.keys(userTokens).forEach(
            (key) =>
            {
                if (key == pushNotificationToken.ClientToken)
                    isTokenRegisteredOnUserProfile = true;
            })

        if (!isTokenRegisteredOnUserProfile)
        {
            userTokens[pushNotificationToken.ClientToken] = pushNotificationToken;

            publicUserProfile.PushNotificationTokensByToken = userTokens;
            await _usersService.SetPublicUserProfileDocument(baseUserId, publicUserProfile);
        }
    }

    HandleClubTokensRegister = async (
        userClubCode: string,
        pushNotificationToken: PushNotificationToken,
        affiliatesClubDocument: AffiliatesClubDocument) =>
    {
        if (affiliatesClubDocument)
        {
            if (!affiliatesClubDocument.PushNotificationTokensByToken)
                affiliatesClubDocument.PushNotificationTokensByToken = {};
        }

        let clubTokens = affiliatesClubDocument.PushNotificationTokensByToken;
        let isTokenRegisteredOnClub = false;

        Object.keys(clubTokens).forEach(
            (key) =>
            {
                if (key == pushNotificationToken.ClientToken)
                    isTokenRegisteredOnClub = true;
            })

        if (!isTokenRegisteredOnClub)
        {
            clubTokens[pushNotificationToken.ClientToken] = pushNotificationToken;

            affiliatesClubDocument.PushNotificationTokensByToken = clubTokens;
            await _affiliatesClubService.SetClubDocument(userClubCode, affiliatesClubDocument);
        }
    }

    SendNotifcation = async (
        clientsTokens: string[],
        title: string,
        content: string) =>
    {
        // Messaging().send
        let messages: Message[] = [];

        clientsTokens.map(
            (clientsToken) =>
            {
                let message: Message = {
                    token: clientsToken,
                    notification:
                    {
                        title: title,
                        body: content
                    },

                    webpush:
                    {
                        headers:
                        {
                            image: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-pig-icon-01.png',
                        },
                        fcmOptions: {
                            link: 'https://animals-farm-01.web.app'
                        }
                    },

                    android: {
                        notification: {
                            imageUrl: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-sheep-icon-01.png'
                        }
                    },

                    apns: {
                        payload: {
                            aps: {
                                'mutable-content': 1
                            }
                        },
                        fcmOptions: {
                            imageUrl: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-sheep-icon-01.png'
                        }
                    },

                    data: {
                        "test01": "01",
                        "test02": "02",
                    },
                }

                // let message: IPushNotificacion =
                // {
                //     token: clientsToken,
                //     notification:
                //     {
                //         title: title,
                //         body: content,

                //         icon: 'assets/icons/apple-icon-180.png',
                //         data: {

                //         },
                //     }
                // }

                messages.push(message);
            })

        if (!messages.length)
        {
            // console.error(
            //     '$$$> ' +
            //     'ERROR trying to SendNotifcation' + '\n' +
            //     'EMPITY messages list!',
            // );
            return
        }

        // console.log("#> SendNotifcation | 01");

        await Messaging().sendAll(messages)
            .then(
                (response: BatchResponse) =>
                {
                    // console.log(`Successfully sent notification`)

                    response.responses.map(
                        (response: SendResponse) =>
                        {
                            // console.log(response);

                            if (!response.success)
                                console.error(response.error);
                        });
                })
            .catch(
                (error) =>
                {
                    console.log('Notification could not be sent ')
                    console.error(error)
                })

        // console.log("#> SendNotifcation | 02");
    }

    static SendNotificationsList = async (pushNotificationEntries: PushNotificationEntry[]) =>
    {
        let messages: Message[] = [];

        pushNotificationEntries.map(
            (pushNotificationEntry) =>
            {
                pushNotificationEntry.ClientTokens.map(
                    (clientToken) =>
                    {
                        let message: Message = {
                            token: clientToken,
                            notification:
                            {
                                title: pushNotificationEntry.Title,
                                body: pushNotificationEntry.Content,
                            },

                            webpush:
                            {
                                headers:
                                {
                                    image: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-pig-icon-01.png',
                                },
                                fcmOptions: {
                                    link: 'https://animals-farm-01.web.app'
                                }
                            },

                            android: {
                                notification: {
                                    imageUrl: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-sheep-icon-01.png'
                                }
                            },

                            apns: {
                                payload: {
                                    aps: {
                                        'mutable-content': 1
                                    }
                                },
                                fcmOptions: {
                                    imageUrl: 'https://animals-farm-01.web.app/assets/rd-af-01-lobby-animals-sheep-icon-01.png'
                                }
                            },

                            data: {
                                "test01": "01",
                                "test02": "02",
                            },
                        }

                        // let message: IPushNotificacion =
                        // {
                        //     token: clientsToken,
                        //     notification:
                        //     {
                        //         title: title,
                        //         body: content,

                        //         icon: 'assets/icons/apple-icon-180.png',
                        //         data: {

                        //         },
                        //     }
                        // }

                        messages.push(message);
                    })
            })


        if (!messages.length)
        {
            // console.error(
            //     '$$$> ' +
            //     'ERROR trying to SendNotifcation' + '\n' +
            //     'EMPITY messages list!',
            // );
            return
        }

        await Messaging().sendAll(messages)
            .then(
                (response: BatchResponse) =>
                {
                    // console.log(`Successfully sent notification`)

                    response.responses.map(
                        (response: SendResponse) =>
                        {
                            // console.log(response);

                            if (!response.success)
                                console.error(response.error);
                        });
                })
            .catch(
                (error) =>
                {
                    console.log('Notification could not be sent ')
                    console.error(error)
                })
    }
}

export let _pushNotificationService: PushNotificationServce = new PushNotificationServce();


////////////////////////////////////////////
export interface IPushNotificacion
{
    token: string,
    notification: {
        title: string,
        body: string,

        icon: string,
        data: any,
    }
}

// export const sendMessage = (messages: IPushNotificacion[]) =>
// {
//     if (!messages.length)
//         return

//     Messaging().sendAll(messages)
//         .then(response =>
//         {
//             console.log(`Successfully sent notification`)
//             console.log(response)
//         })
//         .catch(err =>
//         {
//             console.log('Notification could not be sent ')
//             console.log(err)
//         })
// }
////////////////////////////////////////////


export interface PushNotificationToken
{
    ClientToken: string,

    CreatedAtDate: string,
}

export interface PushNotificationEntry
{
    ClientTokens: string[],

    Title: string,
    Content: string,
}
