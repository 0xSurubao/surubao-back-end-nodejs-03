import { Express, Request, Response } from "express";
// import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
// import { WriteResult } from "firebase-admin/firestore";

export async function SetupRoute(baseExpressApp: Express)
{
    baseExpressApp.get('/health', async (request: Request, response: Response) =>
    {
        response.status(200).send();
    });
}
