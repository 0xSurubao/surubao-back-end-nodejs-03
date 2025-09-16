import { UserRegisterResponse } from './../../features/auth-service/auth-service';
// base
import { v4 as uuidv4 } from 'uuid';
import { Express, Request, Response } from "express";

// from project
import { _authService, UserRegisterRequest } from '../../features/auth-service/auth-service';


export async function SetupRoute(baseExpressApp: Express)
{
    baseExpressApp.post('/users', async (request: Request, response: Response) =>
    {
        const userRegisterRequest = request.body as UserRegisterRequest;

        let registerResultCallback = (userRegisterResponse: UserRegisterResponse) =>
        {
            if (userRegisterResponse.Success)
            {
                // 201 - Created
                response.status(201).send(userRegisterResponse);
            }
            else
            {
                // 400 - Bad Request
                response.status(400).send(userRegisterResponse);
            }
        }

        _authService.TryToRegisterUser(userRegisterRequest, registerResultCallback);
    });
}
