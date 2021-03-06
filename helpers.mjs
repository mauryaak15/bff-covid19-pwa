import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import htmlparser2 from 'htmlparser2';
import { readFileSync, writeFileSync } from 'fs';

const calcluateSummaryChangePer = (newCasesDistributionData) => {
    const activePerc = (
        (newCasesDistributionData.new_active /
            newCasesDistributionData.new_positive) *
        100
    ).toFixed(2);
    const dischargedPerc = (
        (newCasesDistributionData.new_cured /
            newCasesDistributionData.new_positive) *
        100
    ).toFixed(2);
    const deathPerc = (
        (newCasesDistributionData.new_death /
            newCasesDistributionData.new_positive) *
        100
    ).toFixed(2);
    return { activePerc, dischargedPerc, deathPerc };
};

const scrapData = async () => {
    const scrappedData = {};
    const response = await fetch('https://www.mohfw.gov.in/');
    const data = await response.text();
    const dom = htmlparser2.parseDocument(data);
    const $ = cheerio.load(dom);
    const lastUpdatedDateEleText = $('.site-stats .site-stats-count')
        .first()
        .prev()
        .children()
        .children()
        .first()
        .html();
    const machedLastUpdatedDate =
        lastUpdatedDateEleText.match(/(:)(.+?)(?=(IST))/);
    if (machedLastUpdatedDate.length >= 3) {
        const lastUpdatedDate = new Date(
            lastUpdatedDateEleText.match(/(:)(.+?)(?=(IST))/)[2].trim()
        );
        scrappedData.lastUpdatedDate = lastUpdatedDate.toString();
    }
    $('.site-stats .site-stats-count ul li').each(function () {
        if (!scrappedData.summary) {
            scrappedData.summary = [];
        }
        const summarData = {};
        $(this)
            .children('.mob-show')
            .each(function () {
                const contentNodes = $(this);
                if (contentNodes.children().length) {
                    if (!contentNodes.has('span.active_per').length) {
                        const casesStr = contentNodes.children('strong').text();
                        summarData.totalCase = +casesStr.substring(
                            0,
                            casesStr.indexOf('(')
                        );
                        summarData.newCase = +casesStr.substring(
                            casesStr.indexOf('(') + 1,
                            casesStr.indexOf(')')
                        );
                    }
                } else {
                    summarData.type = contentNodes.text().toLowerCase().trim();
                }
            });
        scrappedData.summary.push(summarData);
    });
    return scrappedData;
};

const fetchStateWiseData = async () => {
    const stateData = await fetch('https://www.mohfw.gov.in/data/datanew.json');
    const stateDataJson = await stateData.json();
    return stateDataJson;
};

const readStoredData = () => {
    const storedJsonData = readFileSync('./casesData.json', {
        encoding: 'utf8',
    });
    return storedJsonData ? JSON.parse(storedJsonData) : {};
};

const writeData = (casesData) => {
    writeFileSync('./casesData.json', casesData, {
        encoding: 'utf8',
    });
};

const isDataStaled = (lastUpdatedDate) => {
    const lastUpdatedDateObj =
        typeof lastUpdatedDate === 'string'
            ? new Date(lastUpdatedDate)
            : lastUpdatedDate;
    const currentDate = new Date();
    const diff = currentDate.getTime() - lastUpdatedDateObj.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    return dayInMs < diff;
};

const getData = async () => {
    const { lastUpdatedDate, ...rest } = readStoredData();
    if (!lastUpdatedDate || isDataStaled(lastUpdatedDate)) {
        const scrappedData = await scrapData();
        const stateData = await fetchStateWiseData();
        const total = stateData[stateData.length - 1];
        const summaryPerc = calcluateSummaryChangePer(total);
        scrappedData.summary.forEach((caseTypeData) => {
            switch (caseTypeData.type) {
                case 'active':
                    caseTypeData.changeFlow =
                        total.active > total.new_active ? 'down' : 'up';
                    caseTypeData.changePerc = summaryPerc.activePerc;
                    break;
                case 'discharged':
                    caseTypeData.changeFlow =
                        total.cured > total.new_cured ? 'down' : 'up';
                    caseTypeData.changePerc = summaryPerc.dischargedPerc;
                    break;
                case 'deaths':
                    caseTypeData.changeFlow =
                        total.death > total.new_death ? 'down' : 'up';
                    caseTypeData.changePerc = summaryPerc.deathPerc;
                    break;
                default:
            }
        });
        scrappedData.stateData = stateData;
        writeData(JSON.stringify(scrappedData, null, 4)); // can be made async also
        return scrappedData;
    } else {
        return { lastUpdatedDate, ...rest };
    }
};

const allowCrossDomain = (req, res, next) => {
    const whitelist = [
        'http://localhost:3000',
        'https://covid19-track-pwa.netlify.app',
    ];
    const origin = req.headers.origin;
    if (whitelist.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('X-FRAME-OPTIONS', 'ALLOW-FROM ' + origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Content-Length, X-Requested-With, accesstoken, latitude, longitude, source'
    );

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.sendStatus(200);
    } else {
        next();
    }
};

export {
    scrapData,
    fetchStateWiseData,
    readStoredData,
    writeData,
    isDataStaled,
    getData,
    allowCrossDomain,
};
