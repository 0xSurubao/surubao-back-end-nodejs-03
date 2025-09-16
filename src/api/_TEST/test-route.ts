// base
import { Express, Request, Response } from "express";

// from project
import { _ativitiesService, ActivitiesDocument, ActivitiesDocument_PUBLIC } from "../../features/activities-service/activities-service";
import { GetUserIdByToken, SetDocData } from "../../features/firebase-admin/firebase-admin";
import { _pushNotificationService } from "../../features/push-notification-service/push-notification-service";
import { EnvironmentHandler } from "../../features/environment-handler/environment-handler";


export default class TestRoute
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        // baseExpressApp.post('/test-push-notificiation-01', async (request: Request, response: Response) =>
        // {
        //     const { title, content } = request.body as TestNotificationRequest;

        //     let clientsTokens: string[] = [
        //         // 'fg3oorz6yNx3gUoJuKcLU9:APA91bHKSm1EuI01czx6sR5V9vIGrvJF4_FJMV4m2bt4aso9qpHchyCsTntjOzfXDoDGMqHlf7lxKo07YLvdB3UQ4qZs5VlAqNEkexqGn6pMgJO2BztnJlLSDqHRVNq36dH3twMa6P2E',
        //         'fg3oorz6yNx3gUoJuKcLU9:APA91bHJ0bOsVjdA_-FKvXZTZ60j4fNZC8_hkbHbeQXmgj-0LoAYWlnuYevxtBhTaXSsQautaBvpa3bVSzs_998QWVhK3xJ9AOWe0PzaGcviB6Mw4CVNPfv4pch1mLKRM2dgX-CXw6JJ',
        //     ];

        //     await _pushNotificationService.SendNotifcation(clientsTokens, title, content);

        //     response.status(201).send({});
        // });

        baseExpressApp.post('/debug/fake-time', async (request: Request, response: Response) =>
        {
            const fakeTimeRequest = request.body as FakeTimeRequest;

            console.log(
                'fakeTimeRequest = ',
                fakeTimeRequest,
            );

            let fakeUtcNotDate = new Date(fakeTimeRequest.FakeTimeDate);

            let document: FakeTimeDocument =
            {
                FakeUtcNotDate: fakeUtcNotDate.toISOString(),
            }

            await SetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'DEBUG-public-fake-time',
                "fake-time",
                document,
            );

            response.status(201).send({});
        });
    }
}

export interface TestNotificationRequest
{
    title: string,
    content: string,
}

export interface FakeTimeRequest
{
    FakeTimeDate: string,
}

interface FakeTimeDocument
{
    FakeUtcNotDate: string,
}
