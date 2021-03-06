require('../prototypes');

const path = require('path');
const number = require('../helpers/number');
const country = require('../helpers/country');
const chart = require('../helpers/chart');
const color = require('../helpers/color');

const usersTopCountriesChart = async (userData, totalUsers, title, file, subtitle = null) => {
    const config = chart.config(1000, 1000, [{
        type: 'bar',
        indexLabelFontSize: 24,
        indexLabelFontFamily: '\'Inter\', sans-serif',
        dataPoints: userData.limit(10).map((data, i) => {
            const colors = [
                chart.colors.blue, chart.colors.pink, chart.colors.crimson,
            ];
            const dataColor = colors[i % colors.length];
            return {
                y: data.count,
                color: dataColor,
                indexLabel: `${country.getCountryName(data._id)} (${(data.count / totalUsers * 100).toFixed(2)}%)`,
                indexLabelFontColor: color.isBright(dataColor) ? chart.colors.background : chart.colors.white,
            };
        }).reverse(),
    }]);
    config.axisY = {
        ...config.axisY,
        labelFontSize: 34,
    };
    config.axisX = {
        ...config.axisX,
        tickThickness: 0,
        labelFormatter: function () {
            return '';
        },
    };
    config.title = {
        text: title,
        fontColor: chart.colors.text,
        fontFamily: '\'VT323\', monospace',
        fontWeight: 'bold',
        fontSize: 64,
        padding: subtitle ? 10 : 5,
        margin: subtitle ? 5 : 10,
        verticalAlign: 'top',
        horizontalAlign: subtitle ? 'left' : 'center',
        maxWidth: subtitle ? 600 : 900,
    };
    if (subtitle) {
        config.subtitles = [{
            text: subtitle,
            fontColor: chart.colors.blue,
            fontFamily: '\'VT323\', monospace',
            fontSize: 28,
            padding: 5,
            verticalAlign: 'bottom',
            horizontalAlign: 'right',
            dockInsidePlotArea: true,
            maxWidth: 350,
            backgroundColor: chart.colors.darkBackground,
        }];
    }
    await chart.save(
        path.join(__dirname, `../../generated/${file}.png`),
        await chart.render(config),
        subtitle ? { width: 200, x: 890, y: 100 }
                 : { width: 200, x: 880, y: 820 },
    );
};

module.exports = async (db, log) => {
    /***************
     * User Stats
     ***************/
    log('\n\n----\nUser Stats\n----');

    // Total users
    const totalUsers = await db.collection('users').find({}).count();
    const totalUsersByPRs = await db.collection('pull_requests').aggregate([
        {
            '$match': {
                'app.state': 'eligible',
            },
        },
        {
            '$group': {
                _id: '$user.id',
                count: { '$sum': 1 },
            },
        },
        {
            '$group': {
                _id: '$count',
                count: { '$sum': 1 },
            },
        },
    ], { allowDiskUse: true }).toArray();
    const totalUsersWithPRs = totalUsersByPRs.map(score => score['_id'] > 0 ? score.count : 0).sum();
    const totalWinnerUsers = totalUsersByPRs.map(score => score['_id'] >= 4 ? score.count : 0).sum();
    const totalWinnerStateUsers = await db.collection('users').find({ 'app.state': { '$in': ['completed', 'won_shirt', 'won_sticker'] } }).count();
    log('');
    log(`Total Users: ${number.commas(totalUsers)}`);
    log(`  Users that submitted 1+ valid PR: ${number.commas(totalUsersWithPRs)} (${(totalUsersWithPRs / totalUsers * 100).toFixed(2)}%)`);
    log(`  Users that won (4+ PRs): ${number.commas(totalWinnerUsers)} (${(totalWinnerUsers / totalUsers * 100).toFixed(2)}%)`);
    log(`  Users that won (winning state): ${number.commas(totalWinnerStateUsers)} (${(totalWinnerStateUsers / totalUsers * 100).toFixed(2)}%)`);

    // Users by PRs
    log('');
    log('Users by number of PRs submitted:');
    Object.entries(totalUsersByPRs.reduce(function (result, item) {
        if (item['_id'] > 10) {
            result['10+ PRs'][0] += item.count;
        } else {
            result[`${item['_id']} PR${item['_id'] === 1 ? '' : 's'}`] = [item.count, item['_id']];
        }
        return result;
    }, { '10+ PRs': [0, 11] })).sort((a, b) => a[1][1] - b[1][1]).forEach(item => {
        log(`  ${item[0]}: ${number.commas(item[1][0])} (${(item[1][0] / totalUsers * 100).toFixed(2)}%)`);
    });

    const totalUsersByPRsExtConfig = chart.config(2500, 1000, [{
        type: 'column',
        dataPoints: Object.entries(totalUsersByPRs.reduce(function (result, item) {
            let color;
            switch (item['_id']) {
                case 0:
                case 1:
                case 2:
                case 3:
                    color = chart.colors.blue;
                    break;
                case 4:
                    color = chart.colors.pink;
                    break;
            }

            if (item['_id'] > 10) {
                result['10+ PRs'][0] += item.count;
            } else {
                result[`${item['_id']} PR${item['_id'] === 1 ? '' : 's'}`] = [item.count, color, item['_id']];
            }

            return result;
        }, { '10+ PRs': [0, chart.colors.crimson, 11] }))
            .map(data => {
                return {
                    y: data[1][0],
                    color: data[1][1],
                    order: data[1][2], // Ordering
                    label: data[0], // Display
                };
            })
            .sort((a, b) => a.order - b.order),
    }]);
    totalUsersByPRsExtConfig.axisX = {
        ...totalUsersByPRsExtConfig.axisX,
        labelFontSize: 38,
    };
    totalUsersByPRsExtConfig.title = {
        text: 'Users: Valid Pull Requests',
        fontColor: chart.colors.text,
        fontFamily: '\'VT323\', monospace',
        fontSize: 72,
        padding: 5,
        verticalAlign: 'top',
        horizontalAlign: 'center',
    };
    await chart.save(
        path.join(__dirname, '../../generated/users_by_prs_extended_column.png'),
        await chart.render(totalUsersByPRsExtConfig),
        { width: 200, x: 1250, y: 180 },
    );

    const totalUsersByPRsConfig = chart.config(1000, 1000, [{
        type: 'column',
        dataPoints: Object.entries(totalUsersByPRs.reduce(function (result, item) {
            let color;
            switch (item['_id']) {
                case 0:
                case 1:
                case 2:
                case 3:
                    color = chart.colors.blue;
                    break;
                case 4:
                    color = chart.colors.pink;
                    break;
            }

            if (item['_id'] > 4) {
                result['5+ PRs'][0] += item.count;
            } else {
                result[`${item['_id']} PR${item['_id'] === 1 ? '' : 's'}`] = [item.count, color, item['_id']];
            }

            return result;
        }, { '5+ PRs': [0, chart.colors.crimson, 5] }))
            .map(data => {
                return {
                    y: data[1][0],
                    color: data[1][1],
                    order: data[1][2], // Ordering
                    label: data[0], // Display
                };
            })
            .sort((a, b) => a.order - b.order),
    }]);
    totalUsersByPRsConfig.axisX = {
        ...totalUsersByPRsConfig.axisX,
        labelFontSize: 38,
    };
    totalUsersByPRsConfig.title = {
        text: 'Users: Valid Pull Requests',
        fontColor: chart.colors.text,
        fontFamily: '\'VT323\', monospace',
        fontWeight: 'bold',
        fontSize: 72,
        padding: 5,
        margin: 20,
        verticalAlign: 'top',
        horizontalAlign: 'center',
    };
    await chart.save(
        path.join(__dirname, '../../generated/users_by_prs_column.png'),
        await chart.render(totalUsersByPRsConfig),
        { width: 200, x: 500, y: 180 },
    );

    // Registrations by country
    const totalRegistrationsByCountry = await db.collection('users').aggregate([
        {
            '$match': {
                'app.state': {
                    '$nin': ['new'],
                },
            },
        },
        {
            '$project': {
                country: {
                    '$cond': {
                        if: {
                            '$in': [
                                '$app.country',
                                [null, ''],
                            ],
                        },
                        then: null,
                        else: '$app.country',
                    },
                },
            },
        },
        {
            '$group': {
                _id: '$country',
                count: { '$sum': 1 },
            },
        },
        { '$sort': { count: -1 } },
        { '$limit': 15 },
    ]).toArray();
    log('');
    log('Top countries by registrations:');
    totalRegistrationsByCountry.forEach(data => {
        log(`  ${country.getCountryName(data._id)} | ${number.commas(data.count)} (${(data.count / totalUsers * 100).toFixed(2)}%)`);
    });
    await usersTopCountriesChart(
        totalRegistrationsByCountry,
        totalUsers,
        'Users (registered): Top Countries',
        'users_registrations_top_countries_bar',
    );
    await usersTopCountriesChart(
        totalRegistrationsByCountry.filter(x => ![null, 'US', 'IN'].includes(x._id)),
        totalUsers,
        'Users (registered): Top Countries',
        'users_registrations_top_countries_bar_excl',
        'Excluding the United States, India and users that did not specify their country.',
    );

    // Completions by country
    const totalCompletionsByCountry = await db.collection('users').aggregate([
        {
            '$match': {
                'app.state': {
                    '$in': ['completed', 'won_shirt', 'won_sticker'],
                },
            },
        },
        {
            '$project': {
                country: {
                    '$cond': {
                        if: {
                            '$in': [
                                '$app.country',
                                [null, ''],
                            ],
                        },
                        then: 'Not given',
                        else: '$app.country',
                    },
                },
            },
        },
        {
            '$group': {
                _id: '$country',
                count: { '$sum': 1 },
            },
        },
        { '$sort': { count: -1 } },
        { '$limit': 15 },
    ]).toArray();
    log('');
    log('Top countries by completions:');
    totalCompletionsByCountry.forEach(data => {
        log(`  ${country.getCountryName(data._id)} | ${number.commas(data.count)} (${(data.count / totalUsers * 100).toFixed(2)}%)`);
    });
    await usersTopCountriesChart(
        totalCompletionsByCountry,
        totalUsers,
        'Users (completions): Top Countries',
        'users_completions_top_countries_bar',
    );
    await usersTopCountriesChart(
        totalCompletionsByCountry.filter(x => ![null, 'US', 'IN'].includes(x._id)),
        totalUsers,
        'Users (completions): Top Countries',
        'users_completions_top_countries_bar_excl',
        'Excluding the United States, India and users that did not specify their country.',
    );
};
