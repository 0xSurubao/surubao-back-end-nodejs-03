

export let ConvertUtcDateToBrazilianDayDateStart = (baseUtcDate: Date) =>
{
    let dayStartDate: Date;

    let fakeDate = new Date(baseUtcDate.getTime() - 3 * 60 * 60 * 1000);
    dayStartDate = new Date(fakeDate.toISOString().split('T')[0] + ' GMT-0300');

    return dayStartDate;
}

export let HandleAnyDateFormat = (baseUtcDateText: string, forceDebug = false): Date =>
{
    let value: Date = new Date();

    if (forceDebug)
        console.log('HandleAnyDateFormat | 01 | baseUtcDateText = \"' + baseUtcDateText + '\"');

    switch (baseUtcDateText.length)
    {

    // 2024-04-27
    case 10:
        baseUtcDateText = baseUtcDateText + 'T00:00:00.000Z';
        break;

    // 2024-04-27T14:59:59.999Z
    case 24:
        break;

    // 2024-01-27T11:59:59-03:00
    case 25:
        break;
    }

    baseUtcDateText = baseUtcDateText.substring(0, 10) + 'T' + baseUtcDateText.substring(11, baseUtcDateText.length);

    // baseUtcDateText = baseUtcDateText.replace(/-/g, '/');

    if (forceDebug)
        console.log('HandleAnyDateFormat | 02 | baseUtcDateText = \"' + baseUtcDateText + '\"');

    value = new Date(baseUtcDateText);

    return value;
}

export let ConvertUtcDateToBrazilianDayKey = (baseUtcDate: Date) =>
{
    let dayKey: string = '';

    let dayStartDate = ConvertUtcDateToBrazilianDayDateStart(baseUtcDate);
    dayKey = dayStartDate.toISOString().split('T')[0];

    return dayKey;
}


/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
export function GetRandomInt(minInclusive: number, maxInclusive: number)
{
    minInclusive = Math.ceil(minInclusive);
    maxInclusive = Math.floor(maxInclusive);
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}


export const Delay = (waitSeconds: number) => new Promise(res => setTimeout(res, waitSeconds * 1000));


// let DateWithTimeZone = (timeZone: string, year: number, month: number, day: number, hour: number, minute: number, second: number) =>
// {
//     let date = new Date(Date.UTC(year, month, day, hour, minute, second));

//     let utcDate = new Date(date.toLocaleString('en-US', { timeZone: "UTC" }));
//     let tzDate = new Date(date.toLocaleString('en-US', { timeZone: timeZone }));
//     let offset = utcDate.getTime() - tzDate.getTime();

//     date.setTime(date.getTime() + offset);

//     return date;
// };
