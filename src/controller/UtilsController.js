const dayjs = require('dayjs')

class UtilsController
{
	static getCurrentDate(req, res)
	{
		try
		{
			const currentDate = dayjs().format('YYYY-MM-DD');
			return res.json({ status: true, data: currentDate });
		}
		catch (error)
		{
			console.error(`[UtilsController.getCurrentDate] -> ${error.message}`);
			return res.json({ status: false, message: 'Error' });
		}
	}

	static getCurrentDatetime(req, res)
	{
		try
		{
			const currentDatetime = dayjs().valueOf()
			return res.json({ status: true, data: currentDatetime })
		}
		catch (error)
		{
			console.error(`[UtilsController.getCurrentDatetime] -> ${error.message}`);
			return res.json({ status: false, message: 'Error' })
		}
	}
}

module.exports = UtilsController;