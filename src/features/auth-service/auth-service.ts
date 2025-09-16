import { AnimalStoreItem } from './../store-service/store-service';
// base
import { v4 as uuidv4 } from 'uuid';
import { CreateRequest, getAuth } from 'firebase-admin/auth';

// from project
import { _ativitiesService } from "../activities-service/activities-service";
import { _incomesService } from '../incomes-service/incomes-service';
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey, GetRandomInt } from '../utils/project-utils';
import { isCPF } from './auth-utils';
import { _affiliatesClubService } from '../affiliates-service/affiliates-club-service';
import { PrivateUserProfileDocument, PublicUserProfileDocument } from '../users-service/users-service';
import { _usersService } from '../users-service/users-service';
import { FirebaseError } from 'firebase-admin';


export class AuthService
{
    TryToRegisterUser = async (
        userRegisterRequest: UserRegisterRequest,
        resultCallback: (result: UserRegisterResponse) => void) =>
    {
        let requestErrors = await this.IsValidRequest(userRegisterRequest);

        if (requestErrors.length == 0)
        {
            let createRequest: CreateRequest =
            {
                email: userRegisterRequest.Email,
                emailVerified: false,
                password: userRegisterRequest.Password,
                disabled: false,
            }

            let idk = await getAuth().createUser(createRequest)
                .then(async (userRecord) =>
                {
                    // See the UserRecord reference doc for the contents of userRecord.
                    let userId = userRecord.uid;
                    // console.log('Successfully created new user: ', userId);

                    let ownIndicationCode = await _affiliatesClubService.CreateClubOnRegister(userId);
                    await _usersService.RegisterUserProfileData(userId, userRegisterRequest, ownIndicationCode);
                    await _usersService.SetUsernameDoc(userId, userRegisterRequest.Username);

                    if (!userRegisterRequest.HasNoIndicationCode)
                    {
                        await _affiliatesClubService.AddMemberOnClub(
                            userRegisterRequest.IndicationCode,
                            userId,
                            userRegisterRequest.Username);
                    }

                    let result: UserRegisterResponse =
                    {
                        Success: true,
                        Errors: [],
                    }

                    resultCallback(result);
                })
                .catch((error: FirebaseError) =>
                {
                    let errors: string[] = [];

                    switch (error.code)
                    {

                    case 'auth/email-already-exists':
                        errors.push('unavailable-email');
                        break;

                    default:
                        {
                            console.error('$> ERROR trying to TryToRegisterUser | error = ', error);

                            errors.push(error.code);
                            break;
                        }

                    }

                    let result: UserRegisterResponse =
                    {
                        Success: false,
                        Errors: errors,
                    }

                    resultCallback(result);
                });
        }
        else
        {
            let result: UserRegisterResponse =
            {
                Success: false,
                Errors: requestErrors,
            }

            resultCallback(result);
        }
    }


    IsValidRequest = async (userRegisterRequest: UserRegisterRequest) =>
    {
        let value: string[] = [];

        if (value.length == 0)
        {
            if (userRegisterRequest.CPF == '')
                value.push('empity-cpf');
            else if (!this.IsValidCpf(userRegisterRequest))
                value.push('invalid-cpf');
        }

        if (value.length == 0)
        {
            if (userRegisterRequest.Password == '')
                value.push('empity-password');
            else if (!this.IsValidPassword(userRegisterRequest))
                value.push('invalid-password');
        }

        if (value.length == 0)
        {
            if (userRegisterRequest.PasswordConfirmation == '')
                value.push('empity-password-confirmation');
            else if (!this.IsValidPasswordConfirmation(userRegisterRequest))
                value.push('invalid-password-confirmation');
        }

        if (value.length == 0)
        {
            if (userRegisterRequest.Email == '')
                value.push('empity-email');
            else if (!this.IsEmailValid(userRegisterRequest))
                value.push('invalid-email');
        }

        if (value.length == 0)
        {
            if (userRegisterRequest.FullName == '')
                value.push('empity-full-name');
            else if (!this.IsFullNameValid(userRegisterRequest))
                value.push('invalid-full-name');
        }

        if (value.length == 0)
            {
                if (userRegisterRequest.PhoneNumber == '')
                    value.push('empity-phone-number');
                else if (!this.IsValidPhoneNumber(userRegisterRequest.PhoneNumber))
                    value.push('invalid-phone-number');
            }
    

        if (value.length == 0)
        {
            if (userRegisterRequest.Username == '')
                value.push('empity-username');
            else if (!this.IsUserNameValid(userRegisterRequest))
                value.push('invalid-username');
        }

        if (value.length == 0)
        {
            if (userRegisterRequest.Username == '')
                value.push('empity-username');
            else 
            {
                let isUserNameAvailable = await this.IsUserNameAvailable(userRegisterRequest)

                if (!isUserNameAvailable)
                    value.push('unavailable-username');
            }
        }

        if (value.length == 0)
        {
            let isValidIndicationCode = this.IsIndicationCodeValid(userRegisterRequest);

            if (!isValidIndicationCode)
                value.push('invalid-indication-code');
            else
            {
                if (!userRegisterRequest.HasNoIndicationCode)
                {
                    let hasClubWithCode = await _affiliatesClubService.HasClubWithCode(userRegisterRequest.IndicationCode);

                    if (!hasClubWithCode)
                        value.push('not-found-indication-code');
                }
            }
        }

        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!
        // if (value.length == 0)
        //     value.push('force-fail');
        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!
        // !!! DEBUG ONLY!!!!!

        return value;
    }

    IsUserNameValid(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        // var pattern = /^[a-zA-Z0-9]+$/;
        // var pattern = /^[a-zA-Z0-9]{4,}$/;
        var pattern = /^[a-zA-Z0-9]{4,}$/;

        value = pattern.test(userRegisterRequest.Username);

        return value;
    }

    IsUserNameAvailable = async (userRegisterRequest: UserRegisterRequest): Promise<boolean> =>
    {
        let value: boolean = false;

        value = await _usersService.IsUserNameAvailable(userRegisterRequest.Username);

        return value;
    }

    IsEmailValid(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        var pattern = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
        value = pattern.test(userRegisterRequest.Email);

        return value;
    }

    IsFullNameValid(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        var pattern = /^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/;
        value = pattern.test(userRegisterRequest.FullName);

        return value;
    }

    IsValidPhoneNumber(baseValue: string): boolean
    {
        let value: boolean = false;

        var pattern = /^(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))$/;
        value = pattern.test(baseValue);

        return value;
    }

    IsValidCpf(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        value = isCPF(userRegisterRequest.CPF);

        return value;
    }

    IsValidPassword(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        var pattern = /^[a-zA-Z0-9@$!%*?&]{6,}$/;
        value = pattern.test(userRegisterRequest.Password);

        return value;
    }

    IsValidPasswordConfirmation(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        var pattern = /^[a-zA-Z0-9@$!%*?&]{6,}$/;
        value =
            pattern.test(userRegisterRequest.PasswordConfirmation) &&
            userRegisterRequest.Password == userRegisterRequest.PasswordConfirmation;

        return value;
    }

    IsIndicationCodeValid(userRegisterRequest: UserRegisterRequest): boolean
    {
        let value: boolean = false;

        // var pattern = /^[a-zA-Z0-9]+$/;
        // var pattern = /^[a-zA-Z0-9]{4,}$/;
        var pattern = /^[a-zA-Z0-9]{4,}$/;

        value = userRegisterRequest.HasNoIndicationCode || pattern.test(userRegisterRequest.IndicationCode);

        return value;
    }
}

export let _authService: AuthService = new AuthService();


export interface UserRegisterRequest
{
    // auth-only
    Password: string,
    PasswordConfirmation: string,

    // public data
    Username: string,
    IndicationCode: string,
    HasNoIndicationCode: boolean,

    // private data
    Email: string,
    FullName: string,
    CPF: string,
    PhoneNumber: string,
}

export interface UserRegisterResponse
{
    Success: boolean,
    Errors: Array<string>,
}
