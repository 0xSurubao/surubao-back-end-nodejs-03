export default class DateFormatter
{
    static DateToUtc(data: Date): string
    {
        var year = data.getUTCFullYear();
        var month = (data.getUTCMonth() + 1).toString().padStart(2, '0');
        var day = data.getUTCDate().toString().padStart(2, '0');
        var hour = data.getUTCHours().toString().padStart(2, '0');
        var minute = data.getUTCMinutes().toString().padStart(2, '0');
        var seconds = data.getUTCSeconds().toString().padStart(2, '0');
        var offset = -data.getTimezoneOffset() / 60;

        return `${year}-${month}-${day}T${hour}:${minute}:${seconds}${offset >= 0 ? '+' : '-'}${Math.abs(offset).toString().padStart(2, '0')}:00`;
    }
}
