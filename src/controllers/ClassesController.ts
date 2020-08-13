import { Request, Response } from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
    week_day: number,
    from: string,
    to: string
}

export default class ClassesController {

    async index(request: Request, response: Response) {

        const filters = request.query;

        const subject = filters.subject as string;
        const week_day = filters.week_day as string;
        const time = filters.time as string;
        // const fromTime = filters.from as string;
        // const toTime = filters.to as string;

        if(!filters.week_day || !filters.subject || !filters.time) {
        // if(!filters.week_day || !filters.subject || !filters.from || !filters.to) {
            return response.status(400).json({
                error: 'Missing filters to search classes.'
            })
        }

        // const timeInMinutesFrom = convertHourToMinutes(filters.from as string);
        // const timeInMinutesTo = convertHourToMinutes(filters.to as string);
        const timeInMinutes = convertHourToMinutes(filters.time as string);

        const classes = await db('classes')
            .whereExists(function() {
                this.select('classes_schedule.*')
                    .from('classes_schedule')
                    .whereRaw('`classes_schedule`.`class_id` = `classes`.`id`')
                    .whereRaw('`classes_schedule`.`week_day` = ??', [Number(week_day)])
                    .whereRaw('`classes_schedule`.`to` > ??', [timeInMinutes])
                    // .whereRaw('`classes_schedule`.`from` <= ??', [timeInMinutesFrom])
                    // .whereRaw('`classes_schedule`.`to` > ??', [timeInMinutesTo])
            })
            .where('classes.subject', '=', subject)
            .join('users', 'classes.use_id', '=', 'users.id')
            .select(['classes.*', 'users.*'])
        
        return response.json(classes);

    }

    async create(request: Request, response: Response) {

        const { name, avatar, whatsapp, bio, subject, cost, schedule } = request.body;

        const trx = await db.transaction();

        try {

            const insertUsersIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio
            });
            const use_id = insertUsersIds[0];

            const insertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                use_id
            })
            const class_id = insertedClassesIds[0];

            const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHourToMinutes(scheduleItem.from),
                    to: convertHourToMinutes(scheduleItem.to),
                }
            })

            await trx('classes_schedule').insert(classSchedule);

            await trx.commit();

            return response.status(201).send()
        } catch (err) {
            await trx.rollback();
            console.error(err)
            return response.status(400).json({
                error: 'Unexpected error while creating new class',
            })
        }

    }
}