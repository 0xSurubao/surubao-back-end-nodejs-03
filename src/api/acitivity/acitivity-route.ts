// base
import { Express, Request, Response } from "express";

// from project
import { _ativitiesService, ActivitiesService, ActivitiesDocument, ActivitiesDocument_PUBLIC } from "../../features/activities-service/activities-service";
import { GetUserIdByToken } from "../../features/firebase-admin/firebase-admin";


export let SetupRoute = async (baseExpressApp: Express) =>
{
    baseExpressApp.get('/activity/public-list', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];

        let isAuthenticated: boolean = false;

        let responseObject = {}

        if (authHeader)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                responseObject = await ActivitiesService.GetPublicActivitiesDocument(userId);
                response.status(200).send(responseObject);
            }
        }

        if (!isAuthenticated)
        {
            // 401 == "Unauthorized" (not autheticated)
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });

    baseExpressApp.patch('/activity/public-list', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        const forceActivitiesValidationRequest = request.body as ForceActivitiesValidationRequest;

        let isAuthenticated: boolean = false;

        let responseObject: ForceActivitiesValidationResponse = {
            Success: false,
            Action: '',
        }

        let isValidOperation: boolean = forceActivitiesValidationRequest.Action == 'force-activities-validation';
        let hasToIncludeCurrentDay: boolean = forceActivitiesValidationRequest.HasToIncludeCurrentDay;

        if (authHeader && isValidOperation)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                let success = await ActivitiesService.ForceActivitiesValidation(userId, hasToIncludeCurrentDay);

                responseObject.Success = success;

                if (success)
                    response.status(200).send(responseObject);
                else
                    response.status(500).send(responseObject);
            }
        }

        if (!isAuthenticated)
        {
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });

    baseExpressApp.patch('/activity', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        let { ActivitiesIdsList } = request.body as MarkAsDoneRequest;

        // remove duplicates
        ActivitiesIdsList = [...new Set(ActivitiesIdsList)];

        let isAuthenticated: boolean = false;

        let responseObject: MarkAsDoneResponse = {
            ActivitiesIdsList: ActivitiesIdsList,
        }

        if (authHeader)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                let successActivitiesIdsList: string[] =
                    await _ativitiesService.MarkActivitiesAsDone(userId, ActivitiesIdsList);

                if (successActivitiesIdsList.length == ActivitiesIdsList.length)
                {
                    let responseObject: MarkAsDoneResponse = {
                        ActivitiesIdsList: successActivitiesIdsList,
                    }

                    response.status(200).send(responseObject);
                }
                else
                {
                    console.error(
                        '$$ > ', '\n',
                        'ERROR handling [PATCH]/activity', '\n',
                        'ActivitiesIdsList = ', ActivitiesIdsList, '\n',
                        'successActivitiesIdsList = ', successActivitiesIdsList,
                    )

                    successActivitiesIdsList = ActivitiesIdsList.filter(
                        (item) => !successActivitiesIdsList.includes(item));

                    let responseObject: MarkAsDoneResponse = {
                        ActivitiesIdsList: successActivitiesIdsList,
                    }

                    response.status(500).send(responseObject);
                }
            }
        }

        if (!isAuthenticated)
        {
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });
}

interface MarkAsDoneRequest
{
    Action: string,
    ActivitiesIdsList: string[],
}

interface MarkAsDoneResponse
{
    ActivitiesIdsList: string[],
}


interface ForceActivitiesValidationRequest
{
    Action: string,
    HasToIncludeCurrentDay: boolean,
}

interface ForceActivitiesValidationResponse
{
    Success: boolean,
    Action: string,
}
